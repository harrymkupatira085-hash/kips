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
let serverOutput = '';
let deliveryOrderId;
let deliveryToken;
let takeawayOrderId;

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

before(async () => {
    dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'kips-order-flow-'));
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(phpBinary, ['-S', `127.0.0.1:${port}`, '-t', projectRoot], {
        cwd: projectRoot,
        env: { ...process.env, KIPS_DATA_DIR: dataDirectory },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.setEncoding('utf8').on('data', (text) => { serverOutput += text; });
    server.stderr.setEncoding('utf8').on('data', (text) => { serverOutput += text; });

    let statusResponse;
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (server.exitCode !== null) throw new Error(`PHP test server exited early:\n${serverOutput}`);
        try {
            statusResponse = await fetch(`${baseUrl}/api.php?action=status`);
            if (statusResponse.ok) break;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    assert.ok(statusResponse?.ok, `PHP test server did not start:\n${serverOutput}`);
    const status = await statusResponse.json();
    cookie = statusResponse.headers.get('set-cookie')?.split(';', 1)[0];
    csrfToken = status.csrf_token;
    assert.ok(cookie, 'PHP session cookie should be set');
    assert.ok(csrfToken, 'CSRF token should be issued');

    const downgrade = spawnSync(phpBinary, ['-r', `
        $db = new PDO('sqlite:' . getenv('KIPS_DATA_DIR') . DIRECTORY_SEPARATOR . 'restaurant.sqlite');
        $db->exec('ALTER TABLE orders DROP COLUMN delivery_address');
        $db->exec('UPDATE restaurant_schema_version SET version = 5');
    `], {
        env: { ...process.env, KIPS_DATA_DIR: dataDirectory },
        encoding: 'utf8'
    });
    assert.equal(downgrade.status, 0, `Could not prepare a v5 database for migration testing:\n${downgrade.stderr}`);
});

after(async () => {
    if (server && server.exitCode === null) {
        server.kill();
        await new Promise((resolve) => server.once('exit', resolve));
    }
    if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
});

test('requires a shared delivery location and accepts multiple items', async () => {
    const missingLocation = await apiRequest('create_order', {
        customer_name: 'Test Guest',
        customer_phone: '+265 991 000 001',
        items: [{ item_name: 'Chips & Chicken', quantity: 1 }],
        order_type: 'delivery'
    });
    assert.equal(missingLocation.response.status, 422);
    assert.match(missingLocation.body.error, /GPS location/);

    const writtenDirections = await apiRequest('create_order', {
        customer_name: 'Test Guest',
        customer_phone: '+265 991 000 001',
        items: [{ item_name: 'Chips & Chicken', quantity: 1 }],
        order_type: 'delivery',
        delivery_address: '12 Test Road, turn left after the church'
    });
    assert.equal(writtenDirections.response.status, 422);
    assert.match(writtenDirections.body.error, /Google Maps location link|directions/);

    const invalidPin = await apiRequest('create_order', {
        customer_name: 'Test Guest',
        customer_phone: '+265 991 000 001',
        items: [{ item_name: 'Chips & Chicken', quantity: 1 }],
        order_type: 'delivery',
        delivery_lat: 999,
        delivery_lng: 33.7741
    });
    assert.equal(invalidPin.response.status, 422);
    assert.match(invalidPin.body.error, /location pin/);

    const created = await apiRequest('create_order', {
        customer_name: 'Test Guest',
        customer_phone: '+265 991 000 001',
        items: [
            { item_name: 'Chips & Chicken', quantity: 2 },
            { item_name: 'Cake', quantity: 1 }
        ],
        order_type: 'delivery',
        delivery_lat: -13.9626,
        delivery_lng: 33.7741
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.total, 22000);
    assert.match(created.body.tracking_token, /^[a-f0-9]{64}$/);
    deliveryOrderId = created.body.order_id;
    deliveryToken = created.body.tracking_token;

    const tracking = await fetch(
        `${baseUrl}/api.php?action=customer_order&order=${created.body.order_id}&token=${created.body.tracking_token}`,
        { headers: { Cookie: cookie } }
    );
    assert.equal(tracking.status, 200);
    const result = await tracking.json();
    assert.equal(result.order.delivery_address, '');
    assert.equal(Number(result.order.delivery_confirmed), 0);
    assert.equal(result.order.staff_reply, '');
    assert.ok(Math.abs(Number(result.order.delivery_lat) - -13.9626) < 1e-6);
    assert.ok(Math.abs(Number(result.order.delivery_lng) - 33.7741) < 1e-6);
    assert.deepEqual(result.order.items.map(({ item_name, quantity }) => [item_name, Number(quantity)]), [
        ['Chips & Chicken', 2],
        ['Cake', 1]
    ]);
});

test('accepts a Google Maps link without GPS coordinates', async () => {
    const created = await apiRequest('create_order', {
        customer_name: 'Map Link Guest',
        customer_phone: '+265 991 000 003',
        items: [{ item_name: 'Cake', quantity: 1 }],
        order_type: 'delivery',
        delivery_address: 'https://www.google.com/maps/@-13.9626,33.7741,17z'
    });
    assert.equal(created.response.status, 201);

    const tracking = await fetch(
        `${baseUrl}/api.php?action=customer_order&order=${created.body.order_id}&token=${created.body.tracking_token}`,
        { headers: { Cookie: cookie } }
    );
    const result = await tracking.json();
    assert.ok(Math.abs(Number(result.order.delivery_lat) - -13.9626) < 1e-6);
    assert.ok(Math.abs(Number(result.order.delivery_lng) - 33.7741) < 1e-6);
});

test('allows takeaway orders without a delivery address', async () => {
    const created = await apiRequest('create_order', {
        customer_name: 'Takeaway Guest',
        customer_phone: '+265 991 000 002',
        items: [{ item_name: 'Cake', quantity: 1 }],
        order_type: 'takeaway'
    });
    assert.equal(created.response.status, 201);
    takeawayOrderId = created.body.order_id;

    const tracking = await fetch(
        `${baseUrl}/api.php?action=customer_order&order=${created.body.order_id}&token=${created.body.tracking_token}`,
        { headers: { Cookie: cookie } }
    );
    const result = await tracking.json();
    assert.equal(result.order.delivery_address, '');
});

test('lets staff confirm the delivery location and reply to the customer', async () => {
    const setup = await apiRequest('setup_admin', {
        name: 'Test Administrator',
        username: 'test-admin',
        password: 'a-test-password-longer-than-twelve'
    });
    assert.equal(setup.response.status, 200);
    cookie = setup.response.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(cookie, 'Administrator setup should rotate the session cookie');

    const response = await fetch(`${baseUrl}/api.php?action=dashboard`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const dashboard = await response.json();
    const deliveryOrder = dashboard.orders.find((order) => Number(order.id) === Number(deliveryOrderId));
    assert.ok(deliveryOrder, 'The dashboard should include the delivery order');
    assert.equal(Number(deliveryOrder.delivery_confirmed), 0);
    assert.ok(Math.abs(Number(deliveryOrder.delivery_lat) - -13.9626) < 1e-6, 'The dashboard should include the delivery GPS pin');
    assert.deepEqual(deliveryOrder.lines.map(({ item_name, quantity }) => [item_name, Number(quantity)]), [
        ['Chips & Chicken', 2],
        ['Cake', 1]
    ]);

    const takeaway = await apiRequest('confirm_delivery', { id: takeawayOrderId, reply: 'Hello' });
    assert.equal(takeaway.response.status, 422);
    assert.match(takeaway.body.error, /delivery orders/);

    const confirmation = await apiRequest('confirm_delivery', {
        id: deliveryOrderId,
        reply: 'Location confirmed. Your rider is on the way.'
    });
    assert.equal(confirmation.response.status, 200);
    assert.match(confirmation.body.message, /confirmed/i);

    const tracking = await fetch(
        `${baseUrl}/api.php?action=customer_order&order=${deliveryOrderId}&token=${deliveryToken}`,
        { headers: { Cookie: cookie } }
    );
    assert.equal(tracking.status, 200);
    const tracked = await tracking.json();
    assert.equal(Number(tracked.order.delivery_confirmed), 1);
    assert.equal(tracked.order.staff_reply, 'Location confirmed. Your rider is on the way.');
});
