const authPanel = document.getElementById('authPanel');
const authForm = document.getElementById('authForm');
const authName = document.getElementById('authName');
const authNameLabel = document.getElementById('authNameLabel');
const authTitle = document.getElementById('authTitle');
const authIntro = document.getElementById('authIntro');
const authSubmit = document.getElementById('authSubmit');
const authMessage = document.getElementById('authMessage');
const appShell = document.getElementById('appShell');
const appContent = document.getElementById('appContent');
const appToast = document.getElementById('appToast');
let csrfToken = document.querySelector('meta[name="csrf-token"]').content;
const rolePermissions = {
    administrator: ['*'],
    manager: ['dashboard', 'orders', 'kitchen', 'menu', 'reservations', 'tables', 'customers', 'inventory', 'suppliers', 'expenses', 'employees', 'payments', 'reports', 'audit'],
    waiter: ['dashboard', 'orders', 'kitchen', 'reservations', 'tables', 'customers'],
    chef: ['dashboard', 'orders', 'kitchen', 'inventory'],
    cashier: ['dashboard', 'orders', 'kitchen', 'customers', 'payments', 'reports']
};
const pageTitles = {
    dashboard: 'Overview', orders: 'Orders', kitchen: 'Kitchen display', menu: 'Menu management', reservations: 'Reservations',
    tables: 'Tables', customers: 'Customers', inventory: 'Inventory', suppliers: 'Suppliers',
    expenses: 'Expenses', employees: 'Team management', payments: 'Payments', reports: 'Reports', audit: 'Activity log',
    settings: 'Restaurant settings'
};
const dataSchemas = {
    reservations: [
        ['customer_name', 'Guest name', 'text', true], ['customer_phone', 'Phone', 'tel', true],
        ['customer_email', 'Email', 'email'], ['party_size', 'Party size', 'number', true],
        ['reservation_at', 'Date & time', 'datetime-local', true], ['table_number', 'Table', 'table'],
        ['notes', 'Notes', 'textarea'], ['status', 'Status', 'select', true, ['pending', 'confirmed', 'seated', 'completed', 'cancelled']]
    ],
    customers: [['name', 'Customer name', 'text', true], ['phone', 'Phone', 'tel', true], ['email', 'Email', 'email'], ['loyalty_points', 'Loyalty points', 'number']],
    suppliers: [['name', 'Supplier name', 'text', true], ['contact_name', 'Contact person', 'text'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['address', 'Address', 'textarea']],
    ingredients: [['name', 'Ingredient', 'text', true], ['unit', 'Unit (kg, L, pcs)', 'text', true], ['stock_quantity', 'Current stock', 'number', true], ['reorder_level', 'Low-stock threshold', 'number', true], ['unit_cost', 'Cost per unit (MK)', 'number', true], ['supplier_id', 'Supplier', 'supplier']],
    expenses: [['description', 'Description', 'text', true], ['category', 'Category', 'text', true], ['amount', 'Amount (MK)', 'number', true], ['expense_date', 'Date', 'date', true], ['supplier_id', 'Supplier', 'supplier'], ['notes', 'Notes', 'textarea']],
    tables: [['table_number', 'Table label', 'text', true], ['capacity', 'Seats', 'number', true], ['status', 'Status', 'select', true, ['available', 'occupied', 'reserved', 'maintenance']]],
    employees: [['name', 'Full name', 'text', true], ['username', 'Username', 'text', true], ['password', 'Password', 'password'], ['role', 'Role', 'select', true, ['manager', 'waiter', 'chef', 'cashier', 'administrator']], ['active', 'Account status', 'select', true, ['1', '0']]]
};
const listColumns = {
    reservations: [['customer_name', 'Guest'], ['customer_phone', 'Phone'], ['party_size', 'Guests'], ['reservation_at', 'Date & time'], ['table_number', 'Table'], ['status', 'Status']],
    customers: [['name', 'Customer'], ['phone', 'Phone'], ['email', 'Email'], ['loyalty_points', 'Points'], ['created_at', 'Joined']],
    suppliers: [['name', 'Supplier'], ['contact_name', 'Contact'], ['phone', 'Phone'], ['email', 'Email']],
    ingredients: [['image_path', 'Image'], ['name', 'Ingredient'], ['stock_quantity', 'On hand'], ['unit', 'Unit'], ['reorder_level', 'Reorder at'], ['supplier_name', 'Supplier']],
    expenses: [['description', 'Expense'], ['category', 'Category'], ['amount', 'Amount'], ['expense_date', 'Date']],
    tables: [['table_number', 'Table'], ['capacity', 'Seats'], ['status', 'Status']],
    employees: [['name', 'Team member'], ['username', 'Username'], ['role', 'Role'], ['active', 'Account status']],
    payments: [['id', 'Receipt'], ['order_id', 'Order'], ['customer_name', 'Customer'], ['amount', 'Amount'], ['method', 'Method'], ['reference', 'Reference'], ['created_at', 'Paid at']],
    audit: [['created_at', 'When'], ['actor_name', 'Team member'], ['action', 'Action'], ['entity', 'Area'], ['details', 'Details']],
    movements: [['created_at', 'When'], ['ingredient_name', 'Ingredient'], ['quantity_change', 'Change'], ['unit', 'Unit'], ['reason', 'Reason']],
    recipes: [['menu_name', 'Menu item'], ['ingredient_name', 'Ingredient'], ['quantity', 'Amount'], ['unit', 'Unit']],
    inventory: [['image_path', 'Image'], ['name', 'Ingredient'], ['stock_quantity', 'On hand'], ['unit', 'Unit'], ['reorder_level', 'Reorder at'], ['supplier_name', 'Supplier']]
};
const readOnlyResources = new Set(['payments', 'audit', 'movements', 'recipes']);
let setupMode = false;
let currentStaff = null;
let dashboardData = null;
let activeView = 'dashboard';
let moduleRecords = {};
let toastTimer;
let overviewSalesRange = 7;
let startupViewPending = true;
let knownOrderIds = new Set();
let ordersSeeded = false;
let unseenOrderCount = 0;
let titleFlashTimer = null;
let audioContext = null;
let baseDocumentTitle = document.title;
let timestampsAreUtc = false;
const alertPreferences = {
    enabled: localStorage.getItem('kips-alerts') !== 'off'
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function currencySymbol() {
    return dashboardData?.settings?.currency_symbol || 'MK';
}

function formatPrice(value) {
    return `${currencySymbol()} ${Number(value || 0).toLocaleString('en-US')}`;
}

function orderMapUrl(order) {
    if (order.delivery_lat === null || order.delivery_lat === '' || order.delivery_lng === null || order.delivery_lng === '') return '';
    const lat = Number(order.delivery_lat);
    const lng = Number(order.delivery_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return '';
    return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function canAccess(view) {
    const permissions = rolePermissions[currentStaff?.role] || [];
    return permissions.includes('*') || permissions.includes(view);
}

function dashboardIcon(name) {
    const icons = {
        sales: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
        orders: '<path d="M8 3h8l4 4v14H4V3z"/><path d="M8 11h8M8 15h8M8 7h4"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
        inventory: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5M12 13v8"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        chart: '<path d="M3 3v18h18"/><path d="M8 16v-4M13 16V7M18 16v-7"/>',
        arrowUp: '<path d="M7 17 17 7M7 7h10v10"/>',
        home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>',
        menu: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
        table: '<rect x="3" y="4" width="18" height="7" rx="2"/><path d="M5 11v9M19 11v9M9 15h6"/>',
        truck: '<path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="17.5" cy="18" r="1.5"/>',
        wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/>',
        report: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
        external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M19 13v7H4V5h7"/>',
        bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
        refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2"/>',
        logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
        close: '<path d="m18 6-12 12M6 6l12 12"/>'
    };
    return `<svg class="dashboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.menu}</svg>`;
}

async function request(action, payload = {}, method = 'POST') {
    const send = () => {
        const options = { method, headers: { 'X-CSRF-Token': csrfToken } };
        if (method === 'POST') {
            if (payload instanceof FormData) {
                options.body = payload;
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(payload);
            }
        }
        const query = method === 'GET'
            ? `${payload.resource ? `&resource=${encodeURIComponent(payload.resource)}` : ''}${payload.id ? `&id=${encodeURIComponent(payload.id)}` : ''}`
            : '';
        return fetch(`api.php?action=${encodeURIComponent(action)}${query}`, options);
    };
    let response = await send();
    if (response.status === 403 && method === 'POST') {
        const statusResponse = await fetch('api.php?action=status', { cache: 'no-store' });
        if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.csrf_token) {
                csrfToken = status.csrf_token;
                response = await send();
            }
        }
    }
    if (response.status === 401) {
        showAuth(false);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
}

function showAuth(isSetup) {
    setupMode = isSetup;
    authPanel.hidden = false;
    appShell.hidden = true;
    authName.hidden = !isSetup;
    authNameLabel.hidden = !isSetup;
    authName.required = isSetup;
    authTitle.textContent = isSetup ? 'Set up your restaurant' : 'Welcome back';
    authIntro.textContent = isSetup
        ? 'Create the first administrator account. Use a strong password of at least 12 characters.'
        : 'Sign in with your personal staff account to open your workspace.';
    authSubmit.textContent = isSetup ? 'Create administrator account' : 'Sign in securely';
    document.getElementById('authPassword').autocomplete = isSetup ? 'new-password' : 'current-password';
    document.getElementById('authPassword').minLength = isSetup ? 12 : 1;
    authMessage.textContent = '';
}

function toast(message, error = false) {
    appToast.textContent = message;
    appToast.classList.toggle('is-error', error);
    appToast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => appToast.classList.remove('visible'), 3600);
}

function parseTimestamp(value, utc = false) {
    if (!value) return null;
    let text = String(value).replace(' ', 'T');
    if (utc && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) text += 'Z';
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value, utc = false) {
    if (!value) return '—';
    const date = parseTimestamp(value, utc);
    return date ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : String(value);
}

function currencyCompact(value) {
    return `${currencySymbol()} ${Number(value || 0).toLocaleString('en-US')}`;
}

function whatsappGuestLink(phone, message) {
    let digits = String(phone || '').replace(/\D/g, '');
    const countryCode = String(dashboardData?.settings?.country_code || '265').replace(/\D/g, '') || '265';
    if (digits.startsWith('0')) digits = countryCode + digits.slice(1);
    if (digits.length < 8) return '';
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function guestStatusMessage(order) {
    const name = order.customer_name || 'there';
    const restaurant = dashboardData?.settings?.restaurant_name || 'KIPS';
    const total = formatPrice(order.total_price);
    const base = `Hello ${name}, this is ${restaurant}. Order #${order.id}`;
    if (order.status === 'verified') return `${base} is confirmed and we are getting it ready. Please be ready to receive your meal. Total: ${total}.`;
    if (order.status === 'preparing') return `${base} is being prepared. Please be ready to receive your meal. Total: ${total}.`;
    if (order.status === 'completed') return `${base} is ready. Please receive your meal. Thank you!`;
    if (order.status === 'awaiting_verification') return `${base} (${total}) has been received. Please confirm the details so we can start preparing it.`;
    return `${base}.`;
}

function guestNotifyLabel(order) {
    if (order.status === 'verified') return 'Tell guest: confirmed';
    if (order.status === 'preparing') return 'Tell guest: preparing';
    if (order.status === 'completed') return 'Tell guest: ready';
    return 'WhatsApp guest';
}

function applyBranding(settings = {}) {
    const name = settings.restaurant_name || 'KIPS';
    document.getElementById('brandName').textContent = name;
    document.getElementById('sidebarRestaurantName').textContent = `${name} Restaurant`;
    document.getElementById('brandMark').textContent = name.trim().charAt(0).toUpperCase() || 'K';
    document.getElementById('sidebarAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'K';
    const topbarBrand = document.getElementById('topbarBrand');
    if (topbarBrand) topbarBrand.textContent = name;
    baseDocumentTitle = `${name} · Restaurant operations`;
    document.title = unseenOrderCount ? `(${unseenOrderCount}) New order · ${baseDocumentTitle}` : baseDocumentTitle;
}

function renderAlertToggle() {
    const button = document.getElementById('alertToggleBtn');
    const label = document.getElementById('alertToggleLabel');
    if (!button) return;
    button.setAttribute('aria-pressed', String(alertPreferences.enabled));
    button.classList.toggle('is-off', !alertPreferences.enabled);
    if (label) label.textContent = alertPreferences.enabled ? 'Alerts on' : 'Alerts off';
}

function unlockAudio() {
    if (audioContext) {
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
        return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
        audioContext = new AudioContextClass();
    } catch {
        audioContext = null;
    }
}

function playOrderChime() {
    if (!alertPreferences.enabled) return;
    unlockAudio();
    if (!audioContext) return;
    try {
        const start = audioContext.currentTime;
        [880, 1174.66].forEach((frequency, index) => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const at = start + index * 0.18;
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
            oscillator.connect(gain).connect(audioContext.destination);
            oscillator.start(at);
            oscillator.stop(at + 0.34);
        });
    } catch {
        // Audio is a convenience; never block order handling on it.
    }
}

async function requestAlertPermission() {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    try {
        await Notification.requestPermission();
    } catch {
        // Some browsers only allow this during a click; the toggle click retries it.
    }
}

function showDesktopAlert(newOrders) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const first = newOrders[0];
    const title = `${newOrders.length} new order${newOrders.length === 1 ? '' : 's'} awaiting confirmation`;
    const body = newOrders.length === 1
        ? `#${first.id} · ${first.customer_name} · ${formatPrice(first.total_price)}`
        : `#${first.id} ${first.customer_name} and ${newOrders.length - 1} more guest${newOrders.length === 2 ? '' : 's'}.`;
    try {
        const notification = new Notification(title, { body, tag: 'kips-new-orders' });
        notification.onclick = () => {
            window.focus();
            notification.close();
            if (canAccess('orders')) navigate('orders');
        };
    } catch {
        // Notifications can be disabled at the OS level.
    }
}

function updateAlertTitle() {
    window.clearInterval(titleFlashTimer);
    titleFlashTimer = null;
    if (!unseenOrderCount) {
        document.title = baseDocumentTitle;
        return;
    }
    let showCount = true;
    const apply = () => {
        document.title = showCount
            ? `(${unseenOrderCount}) New order${unseenOrderCount === 1 ? '' : 's'} · ${baseDocumentTitle}`
            : baseDocumentTitle;
        showCount = !showCount;
    };
    apply();
    titleFlashTimer = window.setInterval(apply, 1400);
}

function clearUnseenOrders() {
    if (!unseenOrderCount) return;
    unseenOrderCount = 0;
    updateAlertTitle();
}

function trackOrders(data) {
    const orders = Array.isArray(data.orders) ? data.orders : [];
    if (!ordersSeeded) {
        ordersSeeded = true;
        knownOrderIds = new Set(orders.map((order) => Number(order.id)));
        return;
    }
    const awaiting = orders.filter((order) => order.status === 'awaiting_verification');
    const fresh = awaiting.filter((order) => !knownOrderIds.has(Number(order.id)));
    orders.forEach((order) => knownOrderIds.add(Number(order.id)));
    if (!fresh.length) return;
    unseenOrderCount += fresh.length;
    updateAlertTitle();
    if (alertPreferences.enabled) {
        playOrderChime();
        showDesktopAlert(fresh);
    }
    toast(`${fresh.length} new order${fresh.length === 1 ? '' : 's'} awaiting confirmation.`);
}

function initAlertControls() {
    renderAlertToggle();
    if ('Notification' in window && Notification.permission === 'default' && !alertPreferences.permissionAsked) {
        alertPreferences.permissionAsked = true;
        document.addEventListener('pointerdown', () => requestAlertPermission(), { once: true });
    }
}

document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('keydown', unlockAudio);

async function loadDashboard() {
    const data = await request('dashboard', {}, 'GET');
    dashboardData = data;
    currentStaff = data.staff;
    timestampsAreUtc = Boolean(data.timestamps_utc);
    applyBranding(data.settings);
    document.getElementById('staffName').textContent = data.staff.name || data.staff.username;
    document.getElementById('staffRole').textContent = data.staff.role.replaceAll('_', ' ');
    document.getElementById('staffAvatar').textContent = (data.staff.name || data.staff.username).trim().charAt(0).toUpperCase();
    document.getElementById('openOrderCount').textContent = data.summary.open_orders || '';
    document.getElementById('topbarDate').textContent = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('notificationDot').hidden = !data.notifications.length;
    document.querySelectorAll('.side-link[data-view]').forEach((button) => {
        button.hidden = !canAccess(button.dataset.view);
    });
    initAlertControls();
    trackOrders(data);
    if (startupViewPending) {
        startupViewPending = false;
        const requestedView = new URLSearchParams(window.location.search).get('view');
        if (requestedView && pageTitles[requestedView] && canAccess(requestedView)) {
            activeView = requestedView;
        }
    }
    authPanel.hidden = true;
    appShell.hidden = false;
    await navigate(activeView);
}

function setPageHeader(view) {
    document.getElementById('breadcrumbTitle').textContent = pageTitles[view] || 'Overview';
    document.querySelectorAll('.side-link[data-view]').forEach((button) => {
        button.classList.toggle('active', button.dataset.view === view);
    });
}

async function navigate(view) {
    if (!canAccess(view)) {
        toast('Your staff role cannot access this section.', true);
        return;
    }
    activeView = view;
    setPageHeader(view);
    if (view === 'orders' || view === 'kitchen') clearUnseenOrders();
    document.getElementById('appSidebar').classList.remove('sidebar-open');
    if (view === 'dashboard') {
        renderOverview();
    } else if (view === 'orders') {
        renderOrders();
    } else if (view === 'kitchen') {
        renderKitchen();
    } else if (view === 'menu') {
        renderMenu();
    } else if (view === 'reports') {
        await renderReports();
    } else if (view === 'settings') {
        await renderSettings();
    } else {
        await renderModule(view);
    }
}

function renderOverview() {
    const summary = dashboardData.summary;
    const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
    const latestOrders = dashboardData.orders.slice(0, 5);
    const grossVolume = Number(summary.gross_volume || 0);
    appContent.innerHTML = `<div class="page-heading overview-page-heading">
        <div><span class="app-eyebrow">RESTAURANT OPERATIONS</span><h1>${greeting}, ${escapeHtml(currentStaff.name || currentStaff.username)}</h1>
        <p>Here’s what’s happening across your restaurant today.</p></div>
        <div class="heading-actions overview-heading-actions"><div class="overview-range-switch" role="group" aria-label="Sales chart date range"><button type="button" data-chart-range="7" aria-pressed="${overviewSalesRange === 7}">7 days</button><button type="button" data-chart-range="30" aria-pressed="${overviewSalesRange === 30}">30 days</button></div><button class="app-primary overview-create-button" id="overviewNewOrderBtn">${dashboardIcon('plus')}<span>New order</span></button></div>
    </div>
    ${renderChecklist()}
    ${canAccess('reports') ? `<div class="overview-analytics-grid">
        <section class="app-panel payments-analytics-panel">
            <div class="panel-heading"><div><span class="app-eyebrow">REVENUE OVERVIEW</span><h2>Sales performance</h2><p>Completed payments by day</p></div><span class="panel-badge"><i></i>Live data</span></div>
            <div class="overview-chart-wrap"><canvas id="salesChart" role="img" aria-label="Daily completed sales for the selected date range"></canvas><div class="chart-tooltip" id="salesChartTooltip" role="status" hidden></div></div>
            <div class="chart-footnote"><span><i></i>Completed sales</span><span>${Number(summary.completed_payments || 0).toLocaleString()} successful payments · all time</span></div>
        </section>
        <aside class="app-panel gross-volume-panel">
            <div class="panel-heading"><div><span class="app-eyebrow">ALL-TIME TOTAL</span><h2>Gross volume</h2></div><span class="volume-mark">${dashboardIcon('arrowUp')}</span></div>
            <strong class="gross-volume-value">${formatPrice(grossVolume)}</strong>
            <p class="gross-volume-caption">Total recorded completed payments</p>
            <div class="volume-divider"></div>
            <h3>Payment methods</h3>
            <div class="volume-methods">${summary.payments_by_method.length ? summary.payments_by_method.map((item, index) => {
                const share = grossVolume ? Math.round(Number(item.total) / grossVolume * 100) : 0;
                return `<div class="volume-method"><div class="volume-method-heading"><span>${escapeHtml(item.method)}</span><strong>${formatPrice(item.total)}</strong></div><div class="volume-method-track"><i class="volume-method-fill method-color-${index % 4}" style="width:${share}%"></i></div><small>${Number(item.count).toLocaleString()} payment${Number(item.count) === 1 ? '' : 's'} · ${share}%</small></div>`;
            }).join('') : '<p class="empty-state">Completed payments will appear here.</p>'}</div>
        </aside>
    </div>` : ''}
    <div class="metric-grid overview-metrics">
        ${canAccess('reports') ? `<article class="metric-card"><span class="metric-icon metric-orange">${dashboardIcon('sales')}</span><span class="metric-label">Sales today</span><strong>${formatPrice(summary.sales_today)}</strong><small>Completed payments</small></article>` : ''}
        <article class="metric-card"><span class="metric-icon metric-green">${dashboardIcon('orders')}</span><span class="metric-label">Orders today</span><strong>${Number(summary.orders_today).toLocaleString()}</strong><small>${summary.open_orders} currently in progress</small></article>
        <article class="metric-card"><span class="metric-icon metric-violet">${dashboardIcon('calendar')}</span><span class="metric-label">Reservations today</span><strong>${Number(summary.reservations_today).toLocaleString()}</strong><small>Pending and confirmed</small></article>
        <article class="metric-card ${Number(summary.low_stock) ? 'metric-warning' : ''}"><span class="metric-icon metric-amber">${dashboardIcon('inventory')}</span><span class="metric-label">Low-stock items</span><strong>${Number(summary.low_stock).toLocaleString()}</strong><small>${Number(summary.low_stock) ? 'Needs your attention' : 'Inventory is looking good'}</small></article>
    </div>
    <div class="overview-support-grid">
        <section class="app-panel"><div class="panel-heading"><div><h2>Stock watch</h2><p>Ingredients at or below reorder level</p></div><button class="text-action" data-go="inventory">Inventory →</button></div><div class="stock-watch">${dashboardData.low_stock_items.length ? dashboardData.low_stock_items.map((item) => `<div class="stock-line"><span class="stock-dot"></span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.supplier_name || 'No supplier')}</small></span><b>${escapeHtml(item.stock_quantity)} ${escapeHtml(item.unit)}</b></div>`).join('') : '<p class="empty-state">No low-stock alerts. Nice work!</p>'}</div></section>
        <section class="app-panel recent-panel"><div class="panel-heading"><div><h2>Recent orders</h2><p>Your latest service activity</p></div><button class="text-action" data-go="orders">All orders →</button></div><div class="recent-orders">${latestOrders.length ? latestOrders.map((order) => `<div class="recent-order"><span class="order-initial">${escapeHtml(order.customer_name.charAt(0).toUpperCase())}</span><span class="recent-order-main"><strong>${escapeHtml(order.customer_name)}</strong><small>#${order.id} · ${escapeHtml(order.order_type)}</small></span><span class="recent-order-total">${formatPrice(order.total_price)}</span><span class="status-pill status-${escapeHtml(order.status)}">${escapeHtml(order.status.replaceAll('_', ' '))}</span></div>`).join('') : '<p class="empty-state">Your first order will appear here.</p>'}</div></section>
        <section class="app-panel quick-panel"><div class="panel-heading"><div><h2>Quick access</h2><p>Jump into your day</p></div></div><div class="quick-actions">
            ${canAccess('orders') ? `<button data-go="orders"><span>${dashboardIcon('plus')}</span><b>Start an order</b><small>Open a new ticket</small></button>` : ''}
            ${canAccess('reservations') ? `<button data-go="reservations"><span>${dashboardIcon('calendar')}</span><b>Reservations</b><small>Manage guest bookings</small></button>` : ''}
            ${canAccess('inventory') ? `<button data-go="inventory"><span>${dashboardIcon('inventory')}</span><b>Check inventory</b><small>Track ingredients</small></button>` : ''}
            ${canAccess('reports') ? `<button data-go="reports"><span>${dashboardIcon('chart')}</span><b>View reports</b><small>Understand your numbers</small></button>` : ''}
        </div></section>
    </div>`;
    drawOverviewChart(document.getElementById('salesChart'), dashboardData.sales, overviewSalesRange);
}

function renderChecklist() {
    const items = dashboardData.checklist || [];
    if (!items.length || items.every((item) => item.done)) return '';
    if (localStorage.getItem('kips-checklist-dismissed') === '1') return '';
    return `<section class="app-panel setup-checklist-panel">
        <div class="panel-heading"><div><span class="app-eyebrow">GET SET FOR SERVICE</span><h2>Finish setting up your restaurant</h2><p>Your workspace is ready. These steps make the first shift smoother.</p></div><button class="text-action" type="button" data-dismiss-checklist>Dismiss</button></div>
        <div class="setup-checklist">${items.map((item) => `<button type="button" class="setup-step ${item.done ? 'is-done' : ''}" data-go="${escapeHtml(item.view)}"><span class="setup-check" aria-hidden="true">${item.done ? '✓' : ''}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.hint)}</small></span><span class="setup-arrow" aria-hidden="true">→</span></button>`).join('')}</div>
    </section>`;
}

function drawOverviewChart(canvas, values, range = overviewSalesRange) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 700;
    const height = canvas.clientHeight || 310;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    const padding = { top: 18, right: 14, bottom: 38, left: 58 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const byDay = new Map(values.map((item) => [String(item.day).slice(0, 10), Number(item.total)]));
    const days = Array.from({ length: range }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (range - 1 - index));
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return {
            key,
            date,
            label: range === 7
                ? date.toLocaleDateString([], { weekday: 'short' })
                : (index % 5 === 0 || index === range - 1 ? date.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''),
            value: byDay.get(key) || 0
        };
    });
    const max = Math.max(1000, ...days.map((day) => day.value));
    const step = graphWidth / days.length;
    const tooltip = canvas.parentElement.querySelector('.chart-tooltip');
    const bars = [];
    context.clearRect(0, 0, width, height);
    context.font = '11px "DM Sans", sans-serif';
    context.textBaseline = 'middle';
    for (let line = 0; line <= 4; line += 1) {
        const y = padding.top + graphHeight * line / 4;
        context.strokeStyle = '#edf1ee';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();
        context.fillStyle = '#9aa49f';
        context.textAlign = 'right';
        const amount = max * (1 - line / 4);
        context.fillText(amount >= 1000 ? `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1).replace('.0', '')}k` : String(Math.round(amount)), padding.left - 11, y);
    }
    days.forEach((day, index) => {
        const barWidth = Math.min(range === 7 ? 35 : 12, step * (range === 7 ? .48 : .62));
        const barHeight = Math.max(day.value ? 4 : 0, graphHeight * day.value / max);
        const x = padding.left + step * index + (step - barWidth) / 2;
        const y = padding.top + graphHeight - barHeight;
        if (day.value > 0) {
            const gradient = context.createLinearGradient(0, y, 0, y + barHeight);
            gradient.addColorStop(0, '#e99a70');
            gradient.addColorStop(1, '#cf7049');
            context.fillStyle = gradient;
            context.beginPath();
            if (typeof context.roundRect === 'function') {
                context.roundRect(x, y, barWidth, Math.max(barHeight, 3), [Math.min(5, barWidth / 2), Math.min(5, barWidth / 2), 2, 2]);
            } else {
                context.rect(x, y, barWidth, Math.max(barHeight, 3));
            }
            context.fill();
        }
        bars.push({ ...day, x, y, width: barWidth, height: barHeight });
        if (day.label) {
            context.fillStyle = '#87918e';
            context.textAlign = 'center';
            context.fillText(day.label, x + barWidth / 2, height - 14);
        }
    });
    if (tooltip) {
        canvas.onmousemove = (event) => {
            const bounds = canvas.getBoundingClientRect();
            const pointerX = event.clientX - bounds.left;
            const hovered = bars.find((bar) => pointerX >= bar.x - step / 2 && pointerX <= bar.x + bar.width + step / 2);
            if (!hovered) {
                tooltip.hidden = true;
                return;
            }
            tooltip.textContent = `${hovered.date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${formatPrice(hovered.value)}`;
            tooltip.style.left = `${Math.max(8, Math.min(bounds.width - tooltip.offsetWidth - 8, hovered.x + hovered.width / 2 - tooltip.offsetWidth / 2))}px`;
            tooltip.style.top = `${Math.max(6, hovered.y - 36)}px`;
            tooltip.hidden = false;
        };
        canvas.onmouseleave = () => { tooltip.hidden = true; };
    }
}

function drawChart(canvas, values) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 240;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    const padding = { top: 16, right: 12, bottom: 30, left: 58 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const byDay = new Map(values.map((item) => [String(item.day).slice(0, 10), Number(item.total)]));
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { key, label: date.toLocaleDateString([], { weekday: 'short' }), value: byDay.get(key) || 0 };
    });
    const max = Math.max(1000, ...days.map((day) => day.value));
    context.clearRect(0, 0, width, height);
    context.font = '11px "DM Sans", sans-serif';
    context.textBaseline = 'middle';
    for (let line = 0; line <= 3; line += 1) {
        const y = padding.top + graphHeight * line / 3;
        context.strokeStyle = '#edf0f2';
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();
        context.fillStyle = '#89939e';
        context.textAlign = 'right';
        context.fillText(max === 1000 ? '0' : `${Math.round(max * (1 - line / 3) / 1000)}k`, padding.left - 10, y);
    }
    const points = days.map((day, index) => ({
        x: padding.left + graphWidth * index / (days.length - 1),
        y: padding.top + graphHeight * (1 - day.value / max),
        ...day
    }));
    const gradient = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(230, 126, 74, .22)');
    gradient.addColorStop(1, 'rgba(230, 126, 74, 0)');
    context.beginPath();
    context.moveTo(points[0].x, height - padding.bottom);
    points.forEach((point) => context.lineTo(point.x, point.y));
    context.lineTo(points[points.length - 1].x, height - padding.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    context.beginPath();
    points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = '#d97b52';
    context.lineWidth = 3;
    context.lineJoin = 'round';
    context.stroke();
    points.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 4, 0, Math.PI * 2);
        context.fillStyle = '#fff';
        context.fill();
        context.strokeStyle = '#d97b52';
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = '#89939e';
        context.textAlign = 'center';
        context.fillText(point.label, point.x, height - 12);
    });
}

function renderOrders() {
    const orders = dashboardData.orders;
    appContent.innerHTML = `<div class="page-heading"><div><span class="app-eyebrow">SERVICE &amp; KITCHEN</span><h1>Orders</h1><p>Contact the guest to confirm the order; approve it to unlock payment choice on their private link.</p></div><div class="heading-actions"><button class="app-secondary" data-export="orders">↓ Export CSV</button><button id="kitchenViewBtn" class="app-secondary">Kitchen display</button><button id="newOrderBtn" class="app-primary">＋ New order</button></div></div>
    <div class="order-summary-strip"><span><i class="order-key key-pending"></i>Awaiting confirmation <b>${orders.filter((order) => order.status === 'awaiting_verification').length}</b></span><span><i class="order-key key-queue"></i>In queue <b>${orders.filter((order) => order.status === 'verified').length}</b></span><span><i class="order-key key-kitchen"></i>Preparing <b>${orders.filter((order) => order.status === 'preparing').length}</b></span></div>
    <div class="order-board" id="orderBoard">${orders.length ? orders.map((order) => orderCard(order, orders)).join('') : '<div class="app-panel"><p class="empty-state">No orders yet. Create a new ticket to get started.</p></div>'}</div>`;
}

function orderCard(order, orders) {
    const queue = orders.filter((item) => item.status === 'verified');
    const firstVerifiedId = queue.length ? Number(queue[0].id) : null;
    const status = order.status;
    const paymentMethods = ['Cash', 'Bank Card', 'Airtel Money', 'TNM Mpamba', 'Bank Transfer'];
    const statusLabel = status === 'awaiting_verification' ? 'awaiting confirmation' : status.replaceAll('_', ' ');
    let actions = '';
    if (status === 'awaiting_verification') {
        actions = `${canAccess('orders') ? `<button class="mini-primary" data-action="verify" data-id="${order.id}">Confirm &amp; queue</button>` : ''}<button class="mini-quiet" data-action="cancel" data-id="${order.id}" data-current-status="awaiting_verification">Cancel</button>`;
    } else if (status === 'verified') {
        const index = queue.findIndex((item) => Number(item.id) === Number(order.id));
        actions = `<button class="mini-quiet" data-action="up" data-id="${order.id}" ${index === 0 ? 'disabled' : ''}>↑ Move up</button><button class="mini-quiet" data-action="down" data-id="${order.id}" ${index === queue.length - 1 ? 'disabled' : ''}>↓ Move down</button>${canAccess('orders') ? `<button class="mini-primary" data-action="preparing" data-current-status="verified" data-id="${order.id}" ${Number(order.id) !== firstVerifiedId ? 'disabled' : ''}>${Number(order.id) === firstVerifiedId ? 'Start next' : 'Waiting'}</button>` : ''}`;
    } else if (status === 'preparing') {
        actions = canAccess('orders') ? `<button class="mini-primary" data-action="complete" data-current-status="preparing" data-id="${order.id}">Complete order</button>` : '<span class="app-muted">In preparation</span>';
    }
    const guestWhatsApp = whatsappGuestLink(order.customer_phone, guestStatusMessage(order));
    if (guestWhatsApp) {
        actions += `<a class="mini-quiet" href="${escapeHtml(guestWhatsApp)}" target="_blank" rel="noopener noreferrer">${escapeHtml(guestNotifyLabel(order))}</a>`;
    }
    if (canAccess('payments') && Number(order.paid_amount) < Number(order.total_price)) {
        actions += `<select class="payment-method-select" aria-label="Payment method for order ${order.id}">${paymentMethods.map((method) => `<option ${order.payment_method === method ? 'selected' : ''}>${method}</option>`).join('')}</select><button class="mini-quiet" data-action="pay" data-id="${order.id}">Record payment</button>`;
    } else if (Number(order.paid_amount) >= Number(order.total_price)) {
        actions += `<button class="mini-quiet" data-action="receipt" data-id="${order.id}">View receipt</button>`;
    }
    const paymentState = Number(order.paid_amount) >= Number(order.total_price) ? 'Paid' : `${formatPrice(Number(order.total_price) - Number(order.paid_amount))} due`;
    const itemSummary = order.lines?.length
        ? order.lines.map((item) => `${item.item_name} × ${item.quantity}`).join(', ')
        : `${order.item_name} × ${order.quantity}`;
    const deliveryMapUrl = orderMapUrl(order);
    const deliveryAddress = order.order_type === 'delivery' && order.delivery_address
        ? `<p class="ticket-address"><strong>Delivery to:</strong> ${escapeHtml(order.delivery_address)}${deliveryMapUrl ? ` <a class="ticket-map-link" href="${deliveryMapUrl}" target="_blank" rel="noopener noreferrer">Open map ↗</a>` : ''}</p>`
        : '';
    return `<article class="ticket-card">
        <div class="ticket-top"><span class="ticket-id">#${order.id} <i class="order-type-dot type-${escapeHtml(order.order_type)}"></i>${escapeHtml(order.order_type)}${order.table_number ? ` · ${escapeHtml(order.table_number)}` : ''}</span><span class="status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel)}${status === 'verified' && order.queue_position ? ` · #${order.queue_position}` : ''}</span></div>
        <div class="ticket-customer"><span class="order-initial">${escapeHtml(order.customer_name.charAt(0).toUpperCase())}</span><span><strong>${escapeHtml(order.customer_name)}</strong><small>${escapeHtml(order.customer_phone)}</small></span></div>
        <div class="ticket-food"><strong>${escapeHtml(itemSummary)}</strong>${deliveryAddress}${order.notes ? `<p>${escapeHtml(order.notes)}</p>` : ''}</div>
        <div class="ticket-total"><span>${formatPrice(order.total_price)}</span><small>${paymentState} · ${escapeHtml(order.payment_method)}</small></div>
        <div class="ticket-meta"><span>${dateLabel(order.created_at, timestampsAreUtc)}</span></div>
        <div class="ticket-actions">${actions || '<span class="app-muted">No actions available</span>'}</div>
    </article>`;
}

function kitchenElapsed(createdAt) {
    const created = parseTimestamp(createdAt, timestampsAreUtc);
    if (!created) return '';
    const minutes = Math.max(0, Math.round((Date.now() - created.getTime()) / 60000));
    return minutes < 1 ? 'Just now' : `${minutes} min ago`;
}

function renderKitchen() {
    const orders = dashboardData.orders;
    const queue = orders.filter((order) => order.status === 'verified');
    const firstVerifiedId = queue.length ? Number(queue[0].id) : null;
    const columns = [
        { status: 'awaiting_verification', title: 'Awaiting confirmation', hint: 'Call or WhatsApp the guest, then confirm.' },
        { status: 'verified', title: 'Confirmed queue', hint: 'Start the first ticket when you are ready.' },
        { status: 'preparing', title: 'Preparing', hint: 'Mark ready when the food leaves the kitchen.' }
    ];
    appContent.innerHTML = `<div class="page-heading kitchen-heading">
        <div><span class="app-eyebrow">KITCHEN DISPLAY</span><h1>Live service board</h1><p>Updates every 15 seconds · alerts respect the Alerts button in the top bar.</p></div>
        <div class="heading-actions"><button id="kitchenFullscreenBtn" class="app-secondary">Full screen</button><button id="kitchenOrdersBtn" class="app-secondary">Order list</button></div>
    </div>
    <div class="kitchen-board">${columns.map((column) => {
        const columnOrders = orders.filter((order) => order.status === column.status);
        return `<section class="kitchen-column" aria-labelledby="kitchen-${column.status}">
            <header class="kitchen-column-head"><span class="status-pill status-${column.status}">${column.title}</span><span class="kitchen-count">${columnOrders.length}</span><p>${column.hint}</p></header>
            <div class="kitchen-column-body">${columnOrders.length ? columnOrders.map((order) => kitchenCard(order, firstVerifiedId)).join('') : '<p class="kitchen-empty">No orders in this column.</p>'}</div>
        </section>`;
    }).join('')}</div>`;
}

function kitchenCard(order, firstVerifiedId) {
    const status = order.status;
    const lines = order.lines?.length
        ? order.lines.map((item) => `<li><strong>${escapeHtml(item.item_name)}</strong><span>× ${item.quantity}</span></li>`).join('')
        : `<li><strong>${escapeHtml(order.item_name)}</strong><span>× ${order.quantity}</span></li>`;
    let actions = `<button class="mini-quiet" type="button" data-kitchen-print="${order.id}">Print ticket</button>`;
    if (status === 'awaiting_verification') {
        actions = `<button class="mini-primary" data-action="verify" data-id="${order.id}">Confirm order</button>` + actions;
    } else if (status === 'verified') {
        const isNext = Number(order.id) === firstVerifiedId;
        actions = `<button class="mini-primary" data-action="preparing" data-current-status="verified" data-id="${order.id}" ${isNext ? '' : 'disabled'}>${isNext ? 'Start preparing' : 'Waiting in queue'}</button>` + actions;
    } else if (status === 'preparing') {
        actions = `<button class="mini-primary" data-action="complete" data-current-status="preparing" data-id="${order.id}">Mark ready</button>` + actions;
    }
    const guestWhatsApp = whatsappGuestLink(order.customer_phone, guestStatusMessage(order));
    const kitchenMapUrl = orderMapUrl(order);
    const address = order.order_type === 'delivery' && order.delivery_address
        ? `<p class="kitchen-address"><strong>Deliver to:</strong> ${escapeHtml(order.delivery_address)}${kitchenMapUrl ? ` <a class="kitchen-map-link" href="${kitchenMapUrl}" target="_blank" rel="noopener noreferrer">Open map ↗</a>` : ''}</p>`
        : '';
    return `<article class="kitchen-card status-${escapeHtml(status)}">
        <div class="kitchen-card-head"><span class="kitchen-order-number">#${order.id}</span><span class="kitchen-timer">${escapeHtml(kitchenElapsed(order.created_at))}</span></div>
        <div class="kitchen-meta"><span>${escapeHtml(order.customer_name)}</span><span>${escapeHtml(order.order_type)}${order.table_number ? ` · ${escapeHtml(order.table_number)}` : ''}</span></div>
        <ul class="kitchen-food">${lines}</ul>
        ${order.notes ? `<p class="kitchen-note">${escapeHtml(order.notes)}</p>` : ''}
        ${address}
        <div class="kitchen-card-foot"><strong>${formatPrice(order.total_price)}</strong><span>${escapeHtml(dateLabel(order.created_at, timestampsAreUtc))}</span></div>
        <div class="kitchen-actions">${actions}${guestWhatsApp ? `<a class="mini-quiet" href="${escapeHtml(guestWhatsApp)}" target="_blank" rel="noopener noreferrer">${escapeHtml(guestNotifyLabel(order))}</a>` : ''}</div>
    </article>`;
}

function showKitchenTicket(orderId) {
    const order = dashboardData.orders.find((item) => Number(item.id) === Number(orderId));
    if (!order) return;
    const popup = window.open('', '_blank', 'width=420,height=640');
    if (!popup) {
        toast('Allow pop-ups to print kitchen tickets.', true);
        return;
    }
    const restaurantName = dashboardData.settings?.restaurant_name || 'KIPS';
    const lines = order.lines?.length
        ? order.lines.map((item) => `<tr><td>${escapeHtml(item.item_name)}</td><td>× ${item.quantity}</td></tr>`).join('')
        : `<tr><td>${escapeHtml(order.item_name)}</td><td>× ${order.quantity}</td></tr>`;
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><title>Kitchen ticket #${order.id}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:18px Arial,sans-serif;max-width:360px;margin:24px auto;color:#111;padding:0 16px}h1{font-size:26px;margin-bottom:4px}small{color:#555}h2{font-size:40px;margin:12px 0}table{width:100%;border-collapse:collapse;margin:16px 0}td{padding:8px 0;border-bottom:1px dashed #bbb}td:last-child{text-align:right}.address,.notes{border:2px solid #111;padding:8px;margin:12px 0}button{width:100%;background:#111;color:#fff;border:0;border-radius:8px;padding:12px;font-weight:bold;font-size:16px}@media print{button{display:none}body{margin:0;max-width:none}}</style></head><body><h1>${escapeHtml(restaurantName)}</h1><small>KITCHEN TICKET · ${escapeHtml(order.order_type)}${order.table_number ? ' · ' + escapeHtml(order.table_number) : ''}</small><h2>Order #${order.id}</h2><p>${escapeHtml(kitchenElapsed(order.created_at))}</p><table>${lines}</table>${order.notes ? `<p class="notes"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}${order.order_type === 'delivery' && order.delivery_address ? `<p class="address"><strong>Deliver to:</strong> ${escapeHtml(order.delivery_address)}</p>` : ''}${order.order_type === 'delivery' && orderMapUrl(order) ? `<p class="address"><a href="${orderMapUrl(order)}" target="_blank" rel="noopener noreferrer">Open delivery location in Google Maps</a></p>` : ''}<p><strong>${escapeHtml(order.customer_name)}</strong><br>${escapeHtml(order.customer_phone)}</p><button onclick="window.print()">Print ticket</button></body></html>`);
    popup.document.close();
}

async function renderSettings() {
    appContent.innerHTML = '<div class="loading-state">Loading restaurant settings…</div>';
    try {
        const data = await request('settings_get', {}, 'GET');
        const settings = data.settings || {};
        dashboardData.settings = settings;
        appContent.innerHTML = `<div class="page-heading"><div><span class="app-eyebrow">YOUR RESTAURANT</span><h1>Restaurant settings</h1><p>These details appear on the public menu, footer, receipts and WhatsApp messages.</p></div></div>
        <form id="settingsForm" class="settings-form">
            <section class="app-panel"><div class="panel-heading"><div><h2>Restaurant profile</h2><p>Name, contact details and opening hours.</p></div></div>
                <div class="settings-grid">
                    <label>Restaurant name<input name="restaurant_name" maxlength="100" required value="${escapeHtml(settings.restaurant_name || '')}"></label>
                    <label>Tagline<input name="restaurant_tagline" maxlength="140" value="${escapeHtml(settings.restaurant_tagline || '')}"></label>
                    <label>Phone shown to guests<input name="phone_display" maxlength="40" value="${escapeHtml(settings.phone_display || '')}" placeholder="0983 572 473"></label>
                    <label>WhatsApp number<input name="whatsapp_number" maxlength="30" inputmode="numeric" value="${escapeHtml(settings.whatsapp_number || '')}" placeholder="265991234567"><small>Include the country code. Used for WhatsApp chat and order confirmation.</small></label>
                    <label>Country calling code<input name="country_code" maxlength="6" inputmode="numeric" value="${escapeHtml(settings.country_code || '265')}"><small>Used to complete local guest numbers such as 0991…</small></label>
                    <label>Currency symbol<input name="currency_symbol" maxlength="6" value="${escapeHtml(settings.currency_symbol || 'MK')}"></label>
                    <label>Opening note<input name="opening_note" maxlength="60" value="${escapeHtml(settings.opening_note || '')}" placeholder="Open daily"></label>
                    <label>Opening hours<input name="opening_hours" maxlength="100" value="${escapeHtml(settings.opening_hours || '')}" placeholder="9:00 AM – 10:30 PM"></label>
                    <label>Facebook URL<input name="facebook_url" type="url" maxlength="500" value="${escapeHtml(settings.facebook_url || '')}" placeholder="https://facebook.com/…"></label>
                    <label>Instagram URL<input name="instagram_url" type="url" maxlength="500" value="${escapeHtml(settings.instagram_url || '')}" placeholder="https://instagram.com/…"></label>
                </div>
            </section>
            <section class="app-panel"><div class="panel-heading"><div><h2>Checkout charges</h2><p>Applied to new orders and shown on the customer's checkout and private order link.</p></div></div>
                <div class="settings-grid settings-grid-small">
                    <label>Delivery fee<input name="delivery_fee" type="number" min="0" max="100000000" step="1" value="${escapeHtml(settings.delivery_fee || '0')}"><small>Charged only on delivery orders.</small></label>
                    <label>VAT / tax rate (%)<input name="tax_rate" type="number" min="0" max="100" step="0.01" value="${escapeHtml(settings.tax_rate || '0')}"><small>Calculated on the food subtotal. Use 0 if prices already include tax.</small></label>
                </div>
                <p class="settings-note">The customer pays the subtotal plus delivery fee and tax. Staff discounts can be entered when creating an order at the counter.</p>
            </section>
            <div class="settings-actions"><span>Changes apply to new orders immediately.</span><button class="app-primary" type="submit">Save settings</button></div>
        </form>`;
    } catch (error) {
        appContent.innerHTML = `<p class="app-message">${escapeHtml(error.message)}</p>`;
    }
}

function renderMenu() {
    const items = dashboardData.menu;
    appContent.innerHTML = `<div class="page-heading"><div><span class="app-eyebrow">YOUR FOOD &amp; DRINKS</span><h1>Menu management</h1><p>Keep the menu fresh, accurate and in stock.</p></div>${canAccess('menu') ? '<button id="newMenuBtn" class="app-primary">＋ Add menu item</button>' : ''}</div>
    <div class="menu-admin-grid">${items.map((item) => `<article class="menu-admin-card">
        <div class="menu-admin-image ${escapeHtml(item.thumb)}">${item.image_path ? `<img src="api.php?action=menu_image&amp;id=${Number(item.id)}&amp;v=${encodeURIComponent(item.image_path)}" alt="${escapeHtml(item.name)}" loading="lazy">` : item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy">` : ''}<span class="menu-category">${escapeHtml(item.category || 'Mains')}</span><span class="menu-available ${Number(item.available) ? '' : 'unavailable'}">${Number(item.available) ? 'Available' : 'Hidden'}</span></div>
        <div class="menu-admin-info"><div><h3>${escapeHtml(item.name)}</h3><span>${formatPrice(item.price)}</span></div><p>${escapeHtml(item.description)}</p><div class="menu-admin-actions">${canAccess('menu') ? `<button class="mini-quiet" data-menu-action="edit" data-id="${item.id}">Edit details</button><button class="mini-quiet" data-menu-action="toggle" data-id="${item.id}" data-available="${Number(item.available) ? 0 : 1}">${Number(item.available) ? 'Mark unavailable' : 'Make available'}</button>` : ''}${canAccess('inventory') ? `<button class="mini-quiet" data-menu-action="recipe" data-id="${item.id}">Recipe</button>` : ''}</div></div>
    </article>`).join('')}</div>`;
}

function renderTable(rows, resource) {
    const columns = listColumns[resource] || [];
    if (!rows.length) return '<div class="app-panel"><p class="empty-state">Nothing here yet. Add your first record to get started.</p></div>';
    return `<div class="table-scroll"><table class="data-table"><thead><tr>${columns.map(([, title]) => `<th>${escapeHtml(title)}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr data-record-id="${row.id}">${columns.map(([field]) => `<td>${formatCell(field, row[field], row)}</td>`).join('')}<td class="table-actions">${!readOnlyResources.has(resource) ? `<button class="text-action" data-record-action="edit" data-id="${row.id}">Edit</button>` : ''}${resource === 'payments' ? `<button class="text-action" data-record-action="receipt" data-order-id="${row.order_id}">Receipt</button>` : ''}${resource === 'ingredients' ? `<button class="text-action" data-record-action="adjust" data-id="${row.id}">Adjust stock</button><button class="text-action" data-record-action="recipe" data-id="${row.id}">Use in recipe</button>` : ''}${resource === 'expenses' || resource === 'reservations' ? `<button class="text-action danger-text" data-record-action="delete" data-id="${row.id}">Remove</button>` : ''}${resource === 'employees' && Number(row.active) ? `<button class="text-action danger-text" data-record-action="delete" data-id="${row.id}">Deactivate</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

function formatCell(field, value, row) {
    if (value === null || value === undefined || value === '') return '<span class="app-muted">—</span>';
    if (field === 'image_path') return `<img class="inventory-thumbnail" src="api.php?action=inventory_image&amp;id=${Number(row.id)}" alt="${escapeHtml(row.name)} stock" loading="lazy">`;
    if (['amount', 'unit_cost', 'total_price'].includes(field)) return `<strong>${formatPrice(value)}</strong>`;
    if (field === 'active') return Number(value) ? '<span class="status-pill status-paid">Active</span>' : '<span class="status-pill status-cancelled">Inactive</span>';
    if (field === 'loyalty_points') return `<span class="loyalty-chip">✦ ${escapeHtml(value)} pts</span>`;
    if (field === 'stock_quantity') return `<strong class="${Number(value) <= Number(row.reorder_level) ? 'stock-low' : ''}">${escapeHtml(value)}</strong>`;
    if (field === 'created_at' || field === 'paid_at') return escapeHtml(dateLabel(value, timestampsAreUtc));
    if (field === 'reservation_at' || field === 'expense_date') return escapeHtml(dateLabel(value));
    if (field === 'status') return `<span class="status-pill status-${escapeHtml(String(value).replaceAll(' ', '_'))}">${escapeHtml(String(value).replaceAll('_', ' '))}</span>`;
    return escapeHtml(value);
}

async function renderModule(resource) {
    const title = pageTitles[resource] || resource;
    const isReadOnly = readOnlyResources.has(resource);
    appContent.innerHTML = `<div class="page-heading"><div><span class="app-eyebrow">RESTAURANT OPERATIONS</span><h1>${escapeHtml(title)}</h1><p>${moduleDescription(resource)}</p></div><div class="heading-actions">${resource === 'payments' || resource === 'expenses' ? `<button class="app-secondary" data-export="${resource}">↓ Export CSV</button>` : ''}${resource === 'inventory' ? '<button id="inventoryAdjustBtn" class="app-secondary">＋ Stock adjustment</button>' : ''}${!isReadOnly ? `<button id="newRecordBtn" class="app-primary">＋ ${newRecordLabel(resource === 'inventory' ? 'ingredients' : resource)}</button>` : ''}</div></div>
        ${resource === 'inventory' ? '<div id="recipePanel" class="app-panel recipe-panel"><div class="panel-heading"><div><h2>Recipe builder</h2><p>Link ingredients to a dish to deduct stock automatically as kitchen starts an order.</p></div><button class="text-action" data-dismiss="recipe">Close</button></div><form id="recipeForm" class="recipe-form"><label>Menu item<select name="menu_item_id" required></select></label><label>Ingredient<select name="ingredient_id" required></select></label><label>Quantity per dish<input name="quantity" type="number" step="0.001" min="0.001" required></label><button class="app-primary">Save recipe</button></form></div><div class="app-panel recipe-panel" id="adjustPanel"><div class="panel-heading"><div><h2>Adjust stock</h2><p>Record received stock, waste or a correction in the movement ledger.</p></div><button class="text-action" data-dismiss="adjust">Close</button></div><form id="adjustForm" class="recipe-form"><label>Ingredient<select name="id" required></select></label><label>Quantity change<input name="quantity_change" type="number" step="0.001" required placeholder="Use a negative number to reduce"></label><label>Reason<input name="reason" required maxlength="100" placeholder="Delivery, waste, count correction"></label><button class="app-primary">Save adjustment</button></form></div>' : ''}
        ${resource === 'reports' ? '' : ''}
        <section class="app-panel module-panel"><div id="moduleToolbar" class="module-toolbar">${resource === 'orders' ? '' : `<input id="moduleSearch" type="search" placeholder="Search ${escapeHtml(title.toLowerCase())}…" aria-label="Search ${escapeHtml(title)}"><span class="result-count" id="resultCount"></span>`}</div><div id="moduleTable"><div class="loading-state">Loading ${escapeHtml(title.toLowerCase())}…</div></div></section>
        ${resource === 'inventory' ? '<section class="app-panel module-panel"><div class="panel-heading"><div><h2>Ingredient movements</h2><p>Auditable stock receipts, corrections and automatic recipe deductions.</p></div></div><div id="movementTable"></div></section><section class="app-panel module-panel"><div class="panel-heading"><div><h2>Recipes</h2><p>Ingredient quantities per menu item.</p></div></div><div id="recipeTable"></div></section>' : ''}`;
    if (resource === 'orders') {
        renderOrders();
        return;
    }
    if (resource === 'inventory') {
        document.getElementById('recipePanel').hidden = true;
        document.getElementById('adjustPanel').hidden = true;
    }
    try {
        const apiResource = resource === 'inventory' ? 'ingredients' : resource;
        const data = await request('module_list', { resource: apiResource }, 'GET');
        moduleRecords[resource] = data.items;
        const table = document.getElementById('moduleTable');
        table.innerHTML = renderTable(data.items, resource);
        if (!isReadOnly && resource !== 'inventory') {
            document.getElementById('resultCount').textContent = `${data.items.length} records`;
        }
        if (resource === 'inventory') await populateInventoryTools(data.items);
        if (resource === 'expenses') {
            moduleRecords.suppliers = (await request('module_list', { resource: 'suppliers' }, 'GET')).items;
        }
        document.getElementById('moduleSearch')?.addEventListener('input', (event) => {
            const query = event.target.value.toLowerCase();
            const filtered = data.items.filter((item) => Object.values(item).some((value) => String(value ?? '').toLowerCase().includes(query)));
            table.innerHTML = renderTable(filtered, resource);
            document.getElementById('resultCount').textContent = `${filtered.length} records`;
        });
    } catch (error) {
        document.getElementById('moduleTable').innerHTML = `<p class="app-message">${escapeHtml(error.message)}</p>`;
    }
}

function moduleDescription(resource) {
    const descriptions = {
        reservations: 'Welcome guests with a thoughtfully planned table.', customers: 'Know your regulars and reward them for coming back.',
        suppliers: 'Keep trusted ingredient partners close at hand.', ingredients: 'Track stock, recipes and low-inventory alerts in one place.',
        expenses: 'Record operating costs and keep profit reports grounded.', tables: 'See service capacity and update table availability.',
        employees: 'Personal accounts keep every action accountable.', payments: 'A clear history of settled bills and receipt references.',
        audit: 'A reliable, time-stamped record of team actions.', reports: 'Understand sales, expenses and profit over the past 30 days.'
    };
    return descriptions[resource] || '';
}

function newRecordLabel(resource) {
    return ({ employees: 'Add team member', ingredients: 'Add ingredient', reservations: 'Add reservation', customers: 'Add customer', suppliers: 'Add supplier', expenses: 'Add expense', tables: 'Add table' })[resource] || 'Add record';
}

function renderForm(resource, record = {}) {
    const fields = dataSchemas[resource] || [];
    const isNew = !record.id;
    const formFields = fields.map(([name, label, type, required, options]) => {
        let value = record[name] ?? (name === 'active' ? 1 : '');
        if (type === 'datetime-local' && value) value = String(value).replace(' ', 'T').slice(0, 16);
        let control;
        if (type === 'textarea') {
            control = `<textarea name="${name}" ${required ? 'required' : ''} rows="3">${escapeHtml(value)}</textarea>`;
        } else if (type === 'select') {
            control = `<select name="${name}" ${required ? 'required' : ''}>${options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === option ? 'selected' : ''}>${escapeHtml(name === 'active' ? (option === '1' ? 'Active' : 'Inactive') : option.replaceAll('_', ' '))}</option>`).join('')}</select>`;
        } else if (type === 'supplier' || type === 'table') {
            const optionsList = type === 'supplier' ? (moduleRecords.suppliers || []) : (dashboardData.tables || []);
            control = `<select name="${name}"><option value="">${type === 'supplier' ? 'No supplier' : 'Assign later'}</option>${optionsList.map((item) => `<option value="${item.id}" ${String(value) === String(item.id) ? 'selected' : ''}>${escapeHtml(type === 'supplier' ? item.name : item.table_number)}</option>`).join('')}</select>`;
        } else {
            control = `<input name="${name}" type="${type}" value="${escapeHtml(type === 'password' ? '' : value)}" ${required && !(type === 'password' && !isNew) ? 'required' : ''} ${type === 'number' ? 'step="any" min="0"' : ''} ${type === 'password' ? `minlength="12" placeholder="${isNew ? 'At least 12 characters' : 'Leave blank to keep current password'}"` : ''}>`;
        }
        return `<label>${escapeHtml(label)}${control}</label>`;
    }).join('');
    const inventoryImageField = resource === 'ingredients'
        ? `<label class="inventory-image-field">Stock image <input name="image" type="file" accept=".jpg,.jpeg,.jfif,image/jpeg,.png,image/png,.webp,image/webp"><small>Optional · JPEG/JPG/JFIF, PNG or WebP · maximum 10 MB</small><img class="inventory-image-preview" alt="Stock image preview" ${record.image_path ? `src="api.php?action=inventory_image&amp;id=${Number(record.id)}"` : 'hidden'}></label>`
        : '';
    return `<div class="dialog-backdrop" id="recordDialog"><section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><button class="dialog-close" data-dismiss-dialog aria-label="Close">×</button><span class="app-eyebrow">KIPS OPERATIONS</span><h2 id="dialogTitle">${isNew ? 'Add' : 'Edit'} ${escapeHtml((pageTitles[resource] || resource).replace(' management', '').replace(/s$/, ''))}</h2><form id="recordForm" class="record-form" ${resource === 'ingredients' ? 'enctype="multipart/form-data"' : ''}><input type="hidden" name="id" value="${record.id || 0}"><input type="hidden" name="resource" value="${resource}">${formFields}${inventoryImageField}${resource === 'ingredients' ? '<p class="app-message" data-form-error role="alert"></p>' : ''}<div class="dialog-actions"><button type="button" class="app-secondary" data-dismiss-dialog>Cancel</button><button type="submit" class="app-primary">${isNew ? 'Save record' : 'Save changes'}</button></div></form></section></div>`;
}

function showMenuForm(record = {}) {
    const isNew = !record.id;
    const imagePreview = record.image_path
        ? `api.php?action=menu_image&amp;id=${Number(record.id)}&amp;v=${encodeURIComponent(record.image_path)}`
        : escapeHtml(record.image_url || '');
    appContent.insertAdjacentHTML('beforeend', `<div class="dialog-backdrop" id="recordDialog"><section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><button class="dialog-close" data-dismiss-dialog aria-label="Close">×</button><span class="app-eyebrow">KIPS MENU</span><h2 id="dialogTitle">${isNew ? 'Add a menu item' : 'Edit menu item'}</h2><form id="menuItemForm" class="record-form" enctype="multipart/form-data"><input type="hidden" name="id" value="${record.id || 0}"><label>Food name<input name="name" required maxlength="100" value="${escapeHtml(record.name || '')}"></label><label>Description<textarea name="description" rows="3" required maxlength="300">${escapeHtml(record.description || '')}</textarea></label><label>Price (MK)<input name="price" type="number" min="1" max="100000000" required value="${escapeHtml(record.price || '')}"></label><label>Category<input name="category" maxlength="60" required value="${escapeHtml(record.category || 'Mains')}"></label><label class="menu-image-upload">Upload food photo<input name="image" type="file" accept=".jpg,.jpeg,.jfif,image/jpeg,.png,image/png,.webp,image/webp"><small>Use a clear photo of the actual dish · JPEG, PNG or WebP · maximum 10 MB. Photos are resized and optimized to WebP with a 150 KB target when supported.</small><img class="menu-image-preview" alt="Food photo preview" ${imagePreview ? `src="${imagePreview}"` : 'hidden'}>${record.image_path ? '<span class="menu-image-remove"><input name="remove_image" type="checkbox" value="1"> Remove current uploaded photo</span>' : ''}</label><label>Or HTTPS image URL<input name="image_url" type="url" placeholder="Optional, used if no uploaded photo" value="${escapeHtml(record.image_url || '')}"></label><label>Image style<select name="thumb">${['thumb-one', 'thumb-two', 'thumb-three', 'thumb-four', 'thumb-five'].map((thumb, index) => `<option value="${thumb}" ${record.thumb === thumb ? 'selected' : ''}>${['Chips & chicken photo', 'Chips & beef photo', 'Nsima & chicken photo', 'Rice & beef photo', 'Cake photo'][index]}</option>`).join('')}</select></label><p class="app-message" data-form-error role="alert"></p><div class="dialog-actions"><button type="button" class="app-secondary" data-dismiss-dialog>Cancel</button><button type="submit" class="app-primary">${isNew ? 'Add to menu' : 'Save changes'}</button></div></form></section></div>`);
}

async function optimizeMenuPhoto(file) {
    const targetBytes = 150 * 1024;
    if (file.size <= targetBytes || typeof createImageBitmap !== 'function') return file;

    const bitmap = await createImageBitmap(file);
    try {
        let smallestBlob = null;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('This browser could not prepare the food photo.');

        for (const maxDimension of [1600, 1200, 900, 640]) {
            const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

            for (const quality of [0.82, 0.68, 0.54, 0.4]) {
                const blob = await new Promise((resolve, reject) => {
                    canvas.toBlob((result) => {
                        if (!result) {
                            reject(new Error('This browser could not optimize the food photo.'));
                            return;
                        }
                        resolve(result);
                    }, 'image/webp', quality);
                });
                if (blob.type !== 'image/webp') throw new Error('This browser does not support WebP photo uploads.');
                if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
                if (blob.size <= targetBytes) {
                    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'menu-photo'}.webp`, {
                        type: 'image/webp',
                        lastModified: file.lastModified
                    });
                }
            }
        }

        if (!smallestBlob) throw new Error('This browser could not optimize the food photo.');
        return new File([smallestBlob], `${file.name.replace(/\.[^.]+$/, '') || 'menu-photo'}.webp`, {
            type: 'image/webp',
            lastModified: file.lastModified
        });
    } finally {
        bitmap.close();
    }
}

async function populateInventoryTools(ingredients) {
    moduleRecords.inventory = ingredients;
    const supplierResult = await request('module_list', { resource: 'suppliers' }, 'GET');
    moduleRecords.suppliers = supplierResult.items;
    const menus = dashboardData.menu;
    const movementResult = await request('module_list', { resource: 'movements' }, 'GET');
    const recipeResult = await request('module_list', { resource: 'recipes' }, 'GET');
    document.getElementById('movementTable').innerHTML = renderTable(movementResult.items, 'movements');
    document.getElementById('recipeTable').innerHTML = renderTable(recipeResult.items, 'recipes');
    const recipeMenuSelect = document.querySelector('#recipeForm [name="menu_item_id"]');
    const recipeIngredientSelect = document.querySelector('#recipeForm [name="ingredient_id"]');
    const adjustIngredientSelect = document.querySelector('#adjustForm [name="id"]');
    recipeMenuSelect.innerHTML = menus.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
    const ingredientOptions = ingredients.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} (${escapeHtml(item.stock_quantity)} ${escapeHtml(item.unit)})</option>`).join('');
    recipeIngredientSelect.innerHTML = ingredientOptions;
    adjustIngredientSelect.innerHTML = ingredientOptions;
}

async function renderReports() {
    appContent.innerHTML = `<div class="page-heading"><div><span class="app-eyebrow">THE BIGGER PICTURE</span><h1>Reports &amp; analytics</h1><p>Make clear decisions from real payments and recorded expenses.</p></div><div class="heading-actions">${canAccess('orders') ? '<button class="app-secondary" data-export="orders">↓ Orders CSV</button>' : ''}${canAccess('payments') ? '<button class="app-secondary" data-export="payments">↓ Payments CSV</button>' : ''}${canAccess('expenses') ? '<button class="app-secondary" data-export="expenses">↓ Expenses CSV</button>' : ''}${currentStaff.role === 'administrator' ? '<button class="app-secondary" id="downloadBackupBtn">↓ Database backup</button>' : ''}</div></div><div id="reportContent" class="loading-state">Calculating your last 30 days…</div>`;
    try {
        const data = await request('reports', {}, 'GET');
        appContent.querySelector('#reportContent').innerHTML = `<div class="metric-grid report-metrics"><article class="metric-card"><span class="metric-label">Paid revenue · 30 days</span><strong>${formatPrice(data.revenue)}</strong><small>Completed payments</small></article><article class="metric-card"><span class="metric-label">Recorded expenses</span><strong>${formatPrice(data.expenses)}</strong><small>Entered operating costs</small></article><article class="metric-card"><span class="metric-label">Estimated food cost</span><strong>${formatPrice(data.food_cost)}</strong><small>Recipe-based stock deductions</small></article><article class="metric-card"><span class="metric-label">Net operating result</span><strong class="${data.profit < 0 ? 'negative-number' : ''}">${formatPrice(data.profit)}</strong><small>Revenue less recorded costs</small></article></div><div class="overview-grid report-grid"><section class="app-panel sales-panel"><div class="panel-heading"><div><h2>Daily paid sales</h2><p>Last 30 days · MK</p></div></div><div class="chart-wrap report-chart"><canvas id="reportChart" aria-label="Daily sales chart"></canvas></div></section><section class="app-panel"><div class="panel-heading"><div><h2>Payment mix</h2><p>Settled payments by method</p></div></div><div class="payment-mix">${data.payments_by_method.length ? data.payments_by_method.map((item) => `<div class="mix-row"><div><strong>${escapeHtml(item.method)}</strong><span>${item.count} transaction${Number(item.count) === 1 ? '' : 's'}</span></div><b>${formatPrice(item.total)}</b><div class="mix-bar"><i style="width:${data.revenue ? Math.max(3, Number(item.total) / data.revenue * 100) : 0}%"></i></div></div>`).join('') : '<p class="empty-state">Payments will appear here once they are recorded.</p>'}</div></section></div><section class="app-panel module-panel"><div class="panel-heading"><div><h2>Digital receipts</h2><p>Latest completed transactions</p></div><button class="text-action" data-go="payments">All payments →</button></div></section>`;
        const canvas = document.getElementById('reportChart');
        drawChart(canvas, data.daily_sales.map((item) => ({ day: item.day, total: item.total })));
    } catch (error) {
        appContent.querySelector('#reportContent').innerHTML = `<p class="app-message">${escapeHtml(error.message)}</p>`;
    }
}

async function handleRecordAction(button, resource) {
    const id = Number(button.dataset.id);
    const apiResource = resource === 'inventory' ? 'ingredients' : resource;
    const record = (moduleRecords[resource] || moduleRecords[apiResource] || []).find((item) => Number(item.id) === id);
    if (button.dataset.recordAction === 'receipt') {
        await showReceipt(Number(button.dataset.orderId));
        return;
    }
    if (button.dataset.recordAction === 'edit' && record) {
        if (resource === 'ingredients' && !moduleRecords.suppliers) await populateInventoryTools(moduleRecords.inventory || []);
        appContent.insertAdjacentHTML('beforeend', renderForm(apiResource, record));
        return;
    }
    if (button.dataset.recordAction === 'delete') {
        if (!window.confirm('Remove or deactivate this record? This action will be recorded.')) return;
        try {
            const result = await request('module_delete', { id, resource });
            toast(result.message);
            await refreshDashboard();
            await navigate(activeView);
        } catch (error) {
            toast(error.message, true);
        }
        return;
    }
    if (button.dataset.recordAction === 'adjust') {
        document.getElementById('adjustPanel').hidden = false;
        document.querySelector('#adjustForm [name="id"]').value = String(id);
        document.getElementById('adjustPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (button.dataset.recordAction === 'recipe' && record) showRecipeForm(null, record.id);
}

function showRecipeForm(menuId = null, ingredientId = null) {
    const menuOptions = dashboardData.menu.map((item) => `<option value="${item.id}" ${Number(menuId) === Number(item.id) ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
    const ingredients = moduleRecords.inventory || [];
    const ingredientOptions = ingredients.map((item) => `<option value="${item.id}" ${Number(ingredientId) === Number(item.id) ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(item.unit)}</option>`).join('');
    appContent.insertAdjacentHTML('beforeend', `<div class="dialog-backdrop" id="recordDialog"><section class="app-dialog" role="dialog" aria-modal="true"><button class="dialog-close" data-dismiss-dialog aria-label="Close">×</button><span class="app-eyebrow">KITCHEN INVENTORY</span><h2>Set a recipe ingredient</h2><form id="singleRecipeForm" class="record-form"><label>Menu item<select name="menu_item_id" required>${menuOptions}</select></label><label>Ingredient<select name="ingredient_id" required>${ingredientOptions}</select></label><label>Amount used per dish<input name="quantity" type="number" min="0.001" step="0.001" required></label><div class="dialog-actions"><button type="button" class="app-secondary" data-dismiss-dialog>Cancel</button><button class="app-primary">Save recipe</button></div></form></section></div>`);
}

function showOrderForm() {
    const menuOptions = dashboardData.menu.filter((item) => Number(item.available)).map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} · ${formatPrice(item.price)}</option>`).join('');
    const tableOptions = (dashboardData.tables || []).filter((item) => item.status === 'available').map((item) => `<option value="${escapeHtml(item.table_number)}">${escapeHtml(item.table_number)} · ${item.capacity} seats</option>`).join('');
    appContent.insertAdjacentHTML('beforeend', `<div class="dialog-backdrop" id="recordDialog"><section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><button class="dialog-close" data-dismiss-dialog aria-label="Close">×</button><span class="app-eyebrow">SERVICE COUNTER</span><h2 id="dialogTitle">Start a new order</h2><form id="newOrderForm" class="record-form"><label>Guest name<input name="customer_name" required maxlength="100"></label><label>Phone<input name="customer_phone" required maxlength="30" type="tel"></label><div class="pos-lines-field"><span class="field-label">Order items</span><div id="posOrderLines">${orderLineMarkup(menuOptions, true)}</div><button id="addOrderLineBtn" class="add-order-line" type="button">＋ Add another item</button></div><label>Service type<select name="order_type"><option value="dine-in">Dine-in</option><option value="takeaway">Takeaway</option><option value="delivery">Delivery</option></select></label><label class="table-select-field">Table<select name="table_number">${tableOptions}</select></label><label class="delivery-address-field" hidden>Delivery address<textarea name="delivery_address" maxlength="500" rows="3" placeholder="Street, area, city and directions"></textarea></label><label>Payment method<select name="payment_method"><option>Cash</option><option>Bank Card</option><option>Airtel Money</option><option>TNM Mpamba</option><option>Bank Transfer</option></select></label><label>Order notes<textarea name="notes" maxlength="1000" rows="2"></textarea></label><div class="dialog-actions"><button type="button" class="app-secondary" data-dismiss-dialog>Cancel</button><button class="app-primary">Send to kitchen queue</button></div></form></section></div>`);
    const typeSelect = document.querySelector('#newOrderForm [name="order_type"]');
    const tableField = document.querySelector('.table-select-field');
    const addressField = document.querySelector('.delivery-address-field');
    const addressInput = addressField.querySelector('textarea');
    const updateOrderFields = () => {
        tableField.hidden = typeSelect.value !== 'dine-in';
        addressField.hidden = typeSelect.value !== 'delivery';
        addressInput.required = typeSelect.value === 'delivery';
    };
    typeSelect.addEventListener('change', updateOrderFields);
    updateOrderFields();
}

function orderLineMarkup(menuOptions, onlyLine = false) {
    return `<div class="pos-order-line"><label>Food<select class="pos-menu-item" required>${menuOptions}</select></label><label>Qty<input class="pos-quantity" type="number" min="1" max="50" value="1" required></label>${onlyLine ? '' : '<button type="button" class="remove-order-line" data-remove-order-line aria-label="Remove item">×</button>'}</div>`;
}

async function downloadCsv(type) {
    const labels = { orders: 'Orders', payments: 'Payments', expenses: 'Expenses' };
    try {
        const response = await fetch(`api.php?action=export&type=${encodeURIComponent(type)}`, { headers: { 'X-CSRF-Token': csrfToken } });
        if (!response.ok) {
            let message = `${labels[type] || 'Data'} export failed.`;
            try {
                message = (await response.json()).error || message;
            } catch {
                // Non-JSON error body.
            }
            throw new Error(message);
        }
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `kips-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        toast(`${labels[type] || 'Data'} CSV downloaded.`);
    } catch (error) {
        toast(error.message, true);
    }
}

function showPasswordDialog() {
    appContent.insertAdjacentHTML('beforeend', `<div class="dialog-backdrop" id="recordDialog"><section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><button class="dialog-close" data-dismiss-dialog aria-label="Close">×</button><span class="app-eyebrow">ACCOUNT SECURITY</span><h2 id="dialogTitle">Change my password</h2><form id="passwordForm" class="record-form"><label>Current password<input name="current_password" type="password" autocomplete="current-password" required></label><label>New password<input name="new_password" type="password" autocomplete="new-password" minlength="12" required><small>Use at least 12 characters.</small></label><label>Confirm new password<input name="confirm_password" type="password" autocomplete="new-password" minlength="12" required></label><p class="app-message" data-form-error role="alert"></p><div class="dialog-actions"><button type="button" class="app-secondary" data-dismiss-dialog>Cancel</button><button type="submit" class="app-primary">Update password</button></div></form></section></div>`);
    document.querySelector('#passwordForm [name="current_password"]')?.focus();
}

async function showReceipt(orderId) {
    const data = await request('receipt', { id: orderId }, 'GET');
    const popup = window.open('', '_blank', 'width=480,height=720');
    if (!popup) {
        toast('Allow pop-ups to open the digital receipt.', true);
        return;
    }
    const settings = dashboardData.settings || {};
    const order = data.order;
    const payment = data.payment;
    const restaurantName = settings.restaurant_name || 'KIPS';
    const lines = data.items.map((item) => `<tr><td>${escapeHtml(item.item_name)} <span class="qty">× ${item.quantity}</span></td><td>${formatPrice(item.line_total)}</td></tr>`).join('');
    const balance = Number(order.total_price) - Number(payment.amount);
    const taxLabel = Number(settings.tax_rate) ? `Tax (${escapeHtml(String(settings.tax_rate))}%)` : 'Tax';
    const breakdown = [
        `<tr class="sub"><td>Subtotal</td><td>${formatPrice(order.subtotal || order.total_price)}</td></tr>`,
        Number(order.delivery_fee) ? `<tr class="sub"><td>Delivery fee</td><td>${formatPrice(order.delivery_fee)}</td></tr>` : '',
        Number(order.tax_amount) ? `<tr class="sub"><td>${taxLabel}</td><td>${formatPrice(order.tax_amount)}</td></tr>` : '',
        Number(order.discount) ? `<tr class="sub discount"><td>Staff discount</td><td>− ${formatPrice(order.discount)}</td></tr>` : ''
    ].join('');
    const contact = [settings.phone_display, settings.opening_hours].filter(Boolean).map((value) => escapeHtml(value)).join(' · ');
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(restaurantName)} receipt #${order.id}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
        *{box-sizing:border-box}
        body{font:15px/1.5 "Segoe UI",Arial,sans-serif;max-width:380px;margin:32px auto;color:#202936;padding:0 18px}
        .brand{text-align:center;border-bottom:2px dashed #d8dee5;padding-bottom:16px}
        .brand h1{font-size:24px;margin:0 0 4px}
        .brand small{color:#667085;display:block}
        .meta{display:flex;justify-content:space-between;gap:12px;color:#667085;font-size:13px;margin:14px 0}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        td{padding:8px 0;border-bottom:1px solid #eef1f4;vertical-align:top}
        td:last-child{text-align:right;white-space:nowrap}
        .qty{color:#667085;font-size:13px}
        tr.sub td{border-bottom:0;padding:3px 0;color:#4b5563}
        tr.discount td{color:#b45309}
        tr.total td{border-top:2px solid #202936;border-bottom:0;padding-top:12px;font-size:18px;font-weight:700}
        .payment{margin-top:18px;padding:12px;background:#f6f8fa;border-radius:10px;font-size:13px}
        .payment strong{color:#202936}
        .footer{text-align:center;color:#667085;font-size:12px;margin-top:24px}
        button{width:100%;background:#cf7049;color:#fff;border:0;border-radius:10px;padding:13px;font-weight:700;font-size:15px;margin-top:20px;cursor:pointer}
        @media print{body{margin:0 auto;padding:0 10px;max-width:340px}button{display:none}.payment{background:none;border:1px solid #ccc}}
    </style></head><body>
        <header class="brand"><h1>${escapeHtml(restaurantName)}</h1>${settings.restaurant_tagline ? `<small>${escapeHtml(settings.restaurant_tagline)}</small>` : ''}${contact ? `<small>${contact}</small>` : ''}</header>
        <div class="meta"><span>Receipt #${payment.id}</span><span>Order #${order.id}</span></div>
        <div class="meta"><span>${dateLabel(payment.created_at, timestampsAreUtc)}</span><span>${escapeHtml(order.order_type)}${order.table_number ? ` · ${escapeHtml(order.table_number)}` : ''}</span></div>
        <p><strong>${escapeHtml(order.customer_name)}</strong><br>${escapeHtml(order.customer_phone)}</p>
        <table>${lines}${breakdown}<tr class="total"><td>${balance > 0 ? 'Total due' : 'Total paid'}</td><td>${formatPrice(order.total_price)}</td></tr></table>
        <div class="payment"><strong>Paid via ${escapeHtml(payment.method)}</strong><br>${dateLabel(payment.created_at, timestampsAreUtc)}${payment.reference ? `<br>Ref: ${escapeHtml(payment.reference)}` : ''}${balance > 0 ? `<br>Balance remaining: ${formatPrice(balance)}` : ''}<br>Served by ${escapeHtml(payment.staff_name || restaurantName + ' staff')}</div>
        <p class="footer">Thank you for dining with ${escapeHtml(restaurantName)}. Keep this receipt for your records.</p>
        <button onclick="window.print()">Print receipt</button>
    </body></html>`);
    popup.document.close();
}

async function refreshDashboard() {
    await loadDashboard();
}

authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    authMessage.textContent = '';
    const formData = new FormData(authForm);
    const action = setupMode ? 'setup_admin' : 'login';
    try {
        await request(action, { name: formData.get('name'), username: formData.get('username'), password: formData.get('password') });
        authForm.reset();
        await loadDashboard();
    } catch (error) {
        authMessage.textContent = error.message;
    }
});

document.querySelectorAll('.side-link[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
document.getElementById('refreshBtn').addEventListener('click', async () => {
    try {
        await refreshDashboard();
        toast('Workspace refreshed.');
    } catch (error) {
        toast(error.message, true);
    }
});
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await request('logout');
        currentStaff = null;
        showAuth(false);
    } catch (error) {
        toast(error.message, true);
    }
});
document.getElementById('mobileMenuBtn').addEventListener('click', () => document.getElementById('appSidebar').classList.toggle('sidebar-open'));
document.getElementById('alertToggleBtn').addEventListener('click', async () => {
    alertPreferences.enabled = !alertPreferences.enabled;
    localStorage.setItem('kips-alerts', alertPreferences.enabled ? 'on' : 'off');
    renderAlertToggle();
    if (alertPreferences.enabled) {
        await requestAlertPermission();
        unlockAudio();
        playOrderChime();
        toast('New-order alerts are on. Keep this tab open to hear new orders.');
    } else {
        toast('New-order alerts are off.');
    }
});
document.getElementById('changePasswordBtn').addEventListener('click', showPasswordDialog);
window.addEventListener('focus', () => {
    if (activeView === 'orders' || activeView === 'kitchen') clearUnseenOrders();
});
document.getElementById('notificationBtn').addEventListener('click', async () => {
    const alerts = dashboardData.notifications;
    if (!alerts.length) {
        toast('You’re all caught up.');
        return;
    }
    toast(alerts.map((item) => `${item.title}: ${item.message}`).join(' · '));
    try {
        await request('mark_notifications_read');
        await refreshDashboard();
    } catch (error) {
        toast(error.message, true);
    }
});

appContent.addEventListener('click', async (event) => {
    const rangeButton = event.target.closest('[data-chart-range]');
    if (rangeButton) {
        overviewSalesRange = Number(rangeButton.dataset.chartRange);
        appContent.querySelectorAll('[data-chart-range]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button === rangeButton));
        });
        drawOverviewChart(document.getElementById('salesChart'), dashboardData.sales, overviewSalesRange);
        return;
    }
    if (event.target.closest('#overviewNewOrderBtn')) {
        try {
            if (!dashboardData.tables) {
                const data = await request('module_list', { resource: 'tables' }, 'GET');
                dashboardData.tables = data.items;
            }
            showOrderForm();
        } catch (error) {
            toast(error.message, true);
        }
        return;
    }
    const dismiss = event.target.closest('[data-dismiss-dialog], [data-dismiss]');
    if (dismiss) {
        const dialog = dismiss.closest('#recordDialog');
        if (dialog) dialog.remove();
        const kind = dismiss.dataset.dismiss;
        if (kind) document.getElementById(`${kind}Panel`).hidden = true;
        return;
    }
    const go = event.target.closest('[data-go]');
    if (go) {
        await navigate(go.dataset.go);
        return;
    }
    const exportButton = event.target.closest('[data-export]');
    if (exportButton) {
        await downloadCsv(exportButton.dataset.export);
        return;
    }
    const printTicket = event.target.closest('[data-kitchen-print]');
    if (printTicket) {
        showKitchenTicket(Number(printTicket.dataset.kitchenPrint));
        return;
    }
    const dismissChecklist = event.target.closest('[data-dismiss-checklist]');
    if (dismissChecklist) {
        localStorage.setItem('kips-checklist-dismissed', '1');
        dismissChecklist.closest('.setup-checklist-panel')?.remove();
        return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'newOrderBtn') {
        if (!dashboardData.tables) {
            const data = await request('module_list', { resource: 'tables' }, 'GET');
            dashboardData.tables = data.items;
        }
        showOrderForm();
    } else if (button.id === 'kitchenViewBtn') {
        await navigate('kitchen');
    } else if (button.id === 'kitchenOrdersBtn') {
        await navigate('orders');
    } else if (button.id === 'kitchenFullscreenBtn') {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await (document.getElementById('appShell') || document.documentElement).requestFullscreen();
            }
        } catch {
            toast('This browser cannot enter full screen.', true);
        }
    } else if (button.id === 'addOrderLineBtn') {
        const options = dashboardData.menu.filter((item) => Number(item.available)).map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} · ${formatPrice(item.price)}</option>`).join('');
        document.getElementById('posOrderLines').insertAdjacentHTML('beforeend', orderLineMarkup(options));
    } else if (button.hasAttribute('data-remove-order-line')) {
        button.closest('.pos-order-line').remove();
    } else if (button.id === 'newMenuBtn') {
        showMenuForm();
    } else if (button.id === 'newRecordBtn') {
        if (activeView === 'ingredients') {
            const supplierData = await request('module_list', { resource: 'suppliers' }, 'GET');
            moduleRecords.suppliers = supplierData.items;
        }
        if (activeView === 'reservations' && !dashboardData.tables) {
            dashboardData.tables = (await request('module_list', { resource: 'tables' }, 'GET')).items;
        }
        appContent.insertAdjacentHTML('beforeend', renderForm(activeView === 'inventory' ? 'ingredients' : activeView));
    } else if (button.id === 'inventoryAdjustBtn') {
        document.getElementById('adjustPanel').hidden = false;
        document.getElementById('adjustPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (button.id === 'downloadBackupBtn') {
        try {
            const response = await fetch('api.php?action=backup', { headers: { 'X-CSRF-Token': csrfToken } });
            if (!response.ok) throw new Error((await response.json()).error || 'Backup download failed.');
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `kips-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            toast('Database backup downloaded.');
        } catch (error) {
            toast(error.message, true);
        }
    } else if (button.dataset.menuAction) {
        const item = dashboardData.menu.find((entry) => Number(entry.id) === Number(button.dataset.id));
        if (button.dataset.menuAction === 'edit' && item) showMenuForm(item);
        if (button.dataset.menuAction === 'recipe' && item) {
            const data = await request('module_list', { resource: 'ingredients' }, 'GET');
            moduleRecords.inventory = data.items;
            showRecipeForm(item.id);
        }
        if (button.dataset.menuAction === 'toggle' && item) {
            try {
                const result = await request('toggle_menu_item', { id: item.id, available: button.dataset.available === '1' });
                toast(result.message);
                await refreshDashboard();
                renderMenu();
            } catch (error) {
                toast(error.message, true);
            }
        }
    } else if (button.dataset.action) {
        const order = dashboardData.orders.find((item) => Number(item.id) === Number(button.dataset.id));
        const action = button.dataset.action;
        try {
            let result;
            if (action === 'verify') {
                result = await request('verify_order', { id: Number(button.dataset.id) });
            } else if (action === 'up' || action === 'down') {
                result = await request('move_order', { id: Number(button.dataset.id), direction: action });
            } else if (action === 'pay') {
                const method = button.parentElement.querySelector('.payment-method-select').value;
                result = await request('pay_order', { order_id: Number(button.dataset.id), method });
                await refreshDashboard();
                await showReceipt(Number(button.dataset.id));
                toast(result.message);
                return;
            } else if (action === 'receipt') {
                await showReceipt(Number(button.dataset.id));
                return;
            } else {
                const currentStatus = button.dataset.currentStatus || (action === 'preparing' ? 'verified' : 'preparing');
                const status = action === 'preparing' ? 'preparing' : action === 'complete' ? 'completed' : 'cancelled';
                result = await request('set_order_status', { id: Number(button.dataset.id), current_status: currentStatus, status });
            }
            if (action === 'verify' && order) {
                const confirmationUrl = whatsappGuestLink(order.customer_phone, guestStatusMessage({ ...order, status: 'verified' }));
                if (confirmationUrl && window.confirm(`Order #${order.id} is confirmed. Send the confirmation to ${order.customer_name} on WhatsApp now?`)) {
                    window.open(confirmationUrl, '_blank', 'noopener,noreferrer');
                }
            }
            const notifyHint = ['verify', 'preparing', 'complete'].includes(action)
                ? ' Use "Tell guest" to send them the update.'
                : '';
            toast(result.message + notifyHint);
            await refreshDashboard();
            await navigate(activeView);
        } catch (error) {
            toast(error.message, true);
        }
    } else if (button.dataset.recordAction) {
        await handleRecordAction(button, activeView);
    }
});

appContent.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const formId = form.getAttribute('id');
    const submitButton = form.querySelector('button[type="submit"]');
    const submitLabel = submitButton?.textContent;
    const errorMessage = form.querySelector('[data-form-error]');
    if (errorMessage) errorMessage.textContent = '';
    try {
        const imageFile = form.querySelector('input[name="image"]')?.files?.[0];
        if (imageFile && imageFile.size > 10 * 1024 * 1024) {
            if (errorMessage) errorMessage.textContent = 'Choose an image smaller than 10 MB.';
            else toast('Choose an image smaller than 10 MB.', true);
            return;
        }
        if (submitButton && ['recordForm', 'menuItemForm', 'settingsForm', 'passwordForm'].includes(formId)) {
            submitButton.disabled = true;
            submitButton.textContent = 'Saving…';
        }
        let result;
        if (formId === 'recordForm') {
            const formData = new FormData(form);
            const values = Object.fromEntries(formData);
            const resource = values.resource;
            if (resource === 'ingredients') {
                result = await request('module_save', formData);
            } else {
                values.id = Number(values.id);
                delete values.resource;
                result = await request('module_save', { ...values, resource });
            }
            form.closest('#recordDialog').remove();
            toast(result.message);
            await refreshDashboard();
            await navigate(activeView);
        } else if (formId === 'menuItemForm') {
            const formData = new FormData(form);
            formData.set('id', String(Number(formData.get('id'))));
            formData.set('price', String(Number(formData.get('price'))));
            const menuPhoto = formData.get('image');
            if (menuPhoto instanceof File && menuPhoto.size > 0 && menuPhoto.size > 150 * 1024) {
                if (submitButton) submitButton.textContent = 'Optimizing photo…';
                formData.set('image', await optimizeMenuPhoto(menuPhoto), menuPhoto.name);
            }
            if (submitButton) submitButton.textContent = 'Saving…';
            result = await request('save_menu_item', formData);
            form.closest('#recordDialog').remove();
            toast(result.message);
            await refreshDashboard();
            renderMenu();
        } else if (formId === 'settingsForm') {
            result = await request('settings_save', Object.fromEntries(new FormData(form)));
            dashboardData.settings = result.settings;
            toast(result.message);
            await refreshDashboard();
        } else if (formId === 'passwordForm') {
            result = await request('change_password', Object.fromEntries(new FormData(form)));
            form.closest('#recordDialog').remove();
            toast(result.message);
        } else if (formId === 'newOrderForm') {
            const values = Object.fromEntries(new FormData(form));
            values.items = Array.from(form.querySelectorAll('.pos-order-line')).map((line) => ({
                item_name: line.querySelector('.pos-menu-item').value,
                quantity: Number(line.querySelector('.pos-quantity').value)
            }));
            delete values.item_name;
            delete values.quantity;
            result = await request('create_order', values);
            form.closest('#recordDialog').remove();
            toast(`Order #${result.order_id} opened · ${formatPrice(result.total)}.`);
            await refreshDashboard();
            await navigate('orders');
        } else if (formId === 'recipeForm' || formId === 'singleRecipeForm') {
            const values = Object.fromEntries(new FormData(form));
            values.menu_item_id = Number(values.menu_item_id);
            values.ingredient_id = Number(values.ingredient_id);
            values.quantity = Number(values.quantity);
            result = await request('save_recipe', values);
            const dialog = form.closest('#recordDialog');
            if (dialog) dialog.remove();
            toast(result.message);
            if (activeView === 'inventory') await navigate('inventory');
        } else if (formId === 'adjustForm') {
            const values = Object.fromEntries(new FormData(form));
            values.id = Number(values.id);
            values.quantity_change = Number(values.quantity_change);
            result = await request('inventory_adjust', values);
            toast(result.message);
            form.reset();
            document.getElementById('adjustPanel').hidden = true;
            await refreshDashboard();
            await navigate('inventory');
        }
    } catch (error) {
        if (errorMessage) errorMessage.textContent = error.message;
        else toast(error.message, true);
    } finally {
        if (submitButton?.isConnected && submitLabel !== undefined) {
            submitButton.disabled = false;
            submitButton.textContent = submitLabel;
        }
    }
});

appContent.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== 'image' || !input.files?.[0]) return;
    const preview = input.form?.querySelector('.menu-image-preview, .inventory-image-preview');
    if (!preview) return;
    if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    const objectUrl = URL.createObjectURL(input.files[0]);
    preview.src = objectUrl;
    preview.dataset.objectUrl = objectUrl;
    preview.hidden = false;
    const errorMessage = input.form?.querySelector('[data-form-error]');
    if (errorMessage) errorMessage.textContent = '';
});

appContent.addEventListener('change', (event) => {
    if (event.target.matches('#newOrderForm [name="order_type"]')) {
        document.querySelector('.table-select-field').hidden = event.target.value !== 'dine-in';
    }
});

window.addEventListener('resize', () => {
    if (activeView === 'dashboard') drawOverviewChart(document.getElementById('salesChart'), dashboardData?.sales || [], overviewSalesRange);
});

window.setInterval(async () => {
    if (!currentStaff || document.getElementById('recordDialog')) return;
    try {
        const data = await request('dashboard', {}, 'GET');
        dashboardData = data;
        timestampsAreUtc = Boolean(data.timestamps_utc);
        trackOrders(data);
        if (activeView === 'orders' || activeView === 'kitchen') clearUnseenOrders();
        document.getElementById('openOrderCount').textContent = data.summary.open_orders || '';
        document.getElementById('notificationDot').hidden = !data.notifications.length;
        if (activeView === 'dashboard') renderOverview();
        if (activeView === 'orders') renderOrders();
        if (activeView === 'kitchen') renderKitchen();
    } catch (error) {
        toast(error.message, true);
    }
}, 15000);

(async () => {
    try {
        const status = await request('status', {}, 'GET');
        if (status.logged_in) {
            await loadDashboard();
        } else {
            showAuth(!status.admin_exists);
        }
    } catch (error) {
        showAuth(false);
        authMessage.textContent = error.message;
    }
})();
