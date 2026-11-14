import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phpBinary = process.env.PHP_BINARY || 'C:\\xampp\\php\\php.exe';
let server;
let baseUrl;
let cookie;
let csrfToken;
let dataDirectory;

const BASE_FEE = 500;
const PER_KM = 1000;
const RESTAURANT = { lat: -13.9626, lng: 33.7741 };
const ORDER_COORDS = { lat: -13.9626, lng: 33.7941 };

function haversineKm(from, to) {
    const radians = (degrees) => degrees * Math.PI / 180;
    const dLat = radians(to.lat - from.lat);
    const dLng = radians(to.lng - from.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const expectedFee = BASE_FEE + Math.round(haversineKm(RESTAURANT, ORDER_COORDS) * PER_KM);

function freePort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const { port } = probe.address();
            probe.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

async function apiRequest(action, payload) {
    const response = await fetch(`${baseUrl}/api.php?action=${encodeURIComponent(action)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
            'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(payload)
    });
    return { response, body: await response.json() };
}

function runSql(sql) {
    const result = spawnSync(phpBinary, ['-r', `$db = new PDO('sqlite:' . getenv('KIPS_DATA_DIR') . DIRECTORY_SEPARATOR . 'restaurant.sqlite'); $db->exec(${JSON.stringify(sql)});`], {
        env: { ...process.env, KIPS_DATA_DIR: dataDirectory },
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, `SQL failed: ${result.stderr}`);
}

before(async () => {
    dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'kips-delivery-fee-'));
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(phpBinary, ['-S', `127.0.0.1:${port}`, '-t', projectRoot], {
        cwd: projectRoot,
        env: { ...process.env, KIPS_DATA_DIR: dataDirectory },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stderr.setEncoding('utf8').on('data', () => {});

    let statusResponse;
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (server.exitCode !== null) throw new Error('PHP test server exited early.');
        try {
            statusResponse = await fetch(`${baseUrl}/api.php?action=status`);
            if (statusResponse.ok) break;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    assert.ok(statusResponse?.ok, 'PHP test server did not start.');
    const status = await statusResponse.json();
    cookie = statusResponse.headers.get('set-cookie')?.split(';', 1)[0];
    csrfToken = status.csrf_token;

    runSql(`INSERT INTO restaurant_settings (setting_key, setting_value) VALUES
        ('delivery_fee', '${BASE_FEE}'),
        ('delivery_fee_per_km', '${PER_KM}'),
        ('restaurant_lat', '${RESTAURANT.lat}'),
        ('restaurant_lng', '${RESTAURANT.lng}')
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value;`);
});

after(async () => {
    if (server && server.exitCode === null) {
        server.kill();
        await new Promise((resolve) => server.once('exit', resolve));
    }
    if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
});

test('charges a distance-based delivery fee', async () => {
    const created = await apiRequest('create_order', {
        customer_name: 'Test Guest',
        customer_phone: '+265 991 000 002',
        items: [{ item_name: 'Chips & Chicken', quantity: 1 }],
        order_type: 'delivery',
        delivery_lat: ORDER_COORDS.lat,
        delivery_lng: ORDER_COORDS.lng
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.delivery_fee, expectedFee);
    assert.equal(created.body.total, created.body.subtotal + expectedFee);
});

test('falls back to the base fee without restaurant coordinates', async () => {
    runSql("DELETE FROM restaurant_settings WHERE setting_key IN ('restaurant_lat', 'restaurant_lng');");
    const created = await apiRequest('create_order', {
        customer_name: 'Test Guest',
        customer_phone: '+265 991 000 003',
        items: [{ item_name: 'Chips & Chicken', quantity: 1 }],
        order_type: 'delivery',
        delivery_lat: ORDER_COORDS.lat,
        delivery_lng: ORDER_COORDS.lng
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.delivery_fee, BASE_FEE);
});

test('never charges a delivery fee on takeaway orders', async () => {
    runSql(`INSERT INTO restaurant_settings (setting_key, setting_value) VALUES
        ('restaurant_lat', '${RESTAURANT.lat}'), ('restaurant_lng', '${RESTAURANT.lng}')
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value;`);
    const created = await apiRequest('create_order', {
        customer_name: 'Test Guest',
        customer_phone: '+265 991 000 004',
        items: [{ item_name: 'Chips & Chicken', quantity: 1 }],
        order_type: 'takeaway'
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.delivery_fee, 0);
});
