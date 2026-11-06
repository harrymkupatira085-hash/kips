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
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
const rolePermissions = {
    administrator: ['*'],
    manager: ['dashboard', 'orders', 'menu', 'reservations', 'tables', 'customers', 'inventory', 'suppliers', 'expenses', 'employees', 'payments', 'reports', 'audit'],
    waiter: ['dashboard', 'orders', 'reservations', 'tables', 'customers'],
    chef: ['dashboard', 'orders', 'inventory'],
    cashier: ['dashboard', 'orders', 'customers', 'payments', 'reports']
};
const pageTitles = {
    dashboard: 'Overview', orders: 'Orders', menu: 'Menu management', reservations: 'Reservations',
    tables: 'Tables', customers: 'Customers', inventory: 'Inventory', suppliers: 'Suppliers',
    expenses: 'Expenses', employees: 'Team management', payments: 'Payments', reports: 'Reports', audit: 'Activity log'
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

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function formatPrice(value) {
    return `MK ${Number(value || 0).toLocaleString('en-US')}`;
}

function canAccess(view) {
    const permissions = rolePermissions[currentStaff?.role] || [];
    return permissions.includes('*') || permissions.includes(view);
}

async function request(action, payload = {}, method = 'POST') {
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
    const response = await fetch(`api.php?action=${encodeURIComponent(action)}${query}`, options);
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

function dateLabel(value) {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function currencyCompact(value) {
    return `MK ${Number(value || 0).toLocaleString('en-US')}`;
}

async function loadDashboard() {
    const data = await request('dashboard', {}, 'GET');
    dashboardData = data;
    currentStaff = data.staff;
    document.getElementById('staffName').textContent = data.staff.name || data.staff.username;
    document.getElementById('staffRole').textContent = data.staff.role.replaceAll('_', ' ');
    document.getElementById('staffAvatar').textContent = (data.staff.name || data.staff.username).trim().charAt(0).toUpperCase();
    document.getElementById('openOrderCount').textContent = data.summary.open_orders || '';
    document.getElementById('topbarDate').textContent = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('notificationDot').hidden = !data.notifications.length;
    document.querySelectorAll('.side-link[data-view]').forEach((button) => {
        button.hidden = !canAccess(button.dataset.view);
    });
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
    document.getElementById('appSidebar').classList.remove('sidebar-open');
    if (view === 'dashboard') {
        renderOverview();
    } else if (view === 'orders') {
        renderOrders();
    } else if (view === 'menu') {
        renderMenu();
    } else if (view === 'reports') {
        await renderReports();
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
        <div><span class="app-eyebrow">KIPS RESTAURANT</span><h1>Overview</h1>
        <p>${greeting}, ${escapeHtml(currentStaff.name || currentStaff.username)}. Here’s your restaurant at a glance.</p></div>
        <div class="heading-actions"><span class="overview-period"><span></span>Last 7 days</span><button class="app-secondary" data-go="orders">View orders <span>→</span></button></div>
    </div>
    ${canAccess('reports') ? `<div class="overview-analytics-grid">
        <section class="app-panel payments-analytics-panel">
            <div class="panel-heading"><div><span class="app-eyebrow">PERFORMANCE</span><h2>Payments</h2><p>Completed sales · last 7 days</p></div><span class="panel-badge">Last 7 days</span></div>
            <div class="overview-chart-wrap"><canvas id="salesChart" role="img" aria-label="Daily completed sales over the past seven days"></canvas></div>
            <div class="chart-footnote"><span><i></i>Completed sales</span><span>${Number(summary.completed_payments || 0).toLocaleString()} successful payments</span></div>
        </section>
        <aside class="app-panel gross-volume-panel">
            <div class="panel-heading"><div><span class="app-eyebrow">ALL-TIME</span><h2>Gross volume</h2></div><span class="volume-mark">↗</span></div>
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
        ${canAccess('reports') ? `<article class="metric-card"><span class="metric-icon metric-orange">↗</span><span class="metric-label">Sales today</span><strong>${formatPrice(summary.sales_today)}</strong><small>Completed payments</small></article>` : ''}
        <article class="metric-card"><span class="metric-icon metric-green">▤</span><span class="metric-label">Orders today</span><strong>${Number(summary.orders_today).toLocaleString()}</strong><small>${summary.open_orders} currently in progress</small></article>
        <article class="metric-card"><span class="metric-icon metric-violet">▦</span><span class="metric-label">Reservations today</span><strong>${Number(summary.reservations_today).toLocaleString()}</strong><small>Pending and confirmed</small></article>
        <article class="metric-card ${Number(summary.low_stock) ? 'metric-warning' : ''}"><span class="metric-icon metric-amber">▣</span><span class="metric-label">Low-stock items</span><strong>${Number(summary.low_stock).toLocaleString()}</strong><small>${Number(summary.low_stock) ? 'Needs your attention' : 'Inventory is looking good'}</small></article>
    </div>
    <div class="overview-support-grid">
        <section class="app-panel"><div class="panel-heading"><div><h2>Stock watch</h2><p>Ingredients at or below reorder level</p></div><button class="text-action" data-go="inventory">Inventory →</button></div><div class="stock-watch">${dashboardData.low_stock_items.length ? dashboardData.low_stock_items.map((item) => `<div class="stock-line"><span class="stock-dot"></span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.supplier_name || 'No supplier')}</small></span><b>${escapeHtml(item.stock_quantity)} ${escapeHtml(item.unit)}</b></div>`).join('') : '<p class="empty-state">No low-stock alerts. Nice work!</p>'}</div></section>
        <section class="app-panel recent-panel"><div class="panel-heading"><div><h2>Recent orders</h2><p>Your latest service activity</p></div><button class="text-action" data-go="orders">All orders →</button></div><div class="recent-orders">${latestOrders.length ? latestOrders.map((order) => `<div class="recent-order"><span class="order-initial">${escapeHtml(order.customer_name.charAt(0).toUpperCase())}</span><span class="recent-order-main"><strong>${escapeHtml(order.customer_name)}</strong><small>#${order.id} · ${escapeHtml(order.order_type)}</small></span><span class="recent-order-total">${formatPrice(order.total_price)}</span><span class="status-pill status-${escapeHtml(order.status)}">${escapeHtml(order.status.replaceAll('_', ' '))}</span></div>`).join('') : '<p class="empty-state">Your first order will appear here.</p>'}</div></section>
        <section class="app-panel quick-panel"><div class="panel-heading"><div><h2>Quick access</h2><p>Jump into your day</p></div></div><div class="quick-actions">
            ${canAccess('orders') ? '<button data-go="orders"><span>＋</span><b>Start an order</b><small>Open a new ticket</small></button>' : ''}
            ${canAccess('reservations') ? '<button data-go="reservations"><span>▦</span><b>Reservations</b><small>Manage guest bookings</small></button>' : ''}
            ${canAccess('inventory') ? '<button data-go="inventory"><span>▣</span><b>Check inventory</b><small>Track ingredients</small></button>' : ''}
            ${canAccess('reports') ? '<button data-go="reports"><span>▥</span><b>View reports</b><small>Understand your numbers</small></button>' : ''}
        </div></section>
    </div>`;
    drawOverviewChart(document.getElementById('salesChart'), dashboardData.sales);
}

function drawOverviewChart(canvas, values) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 700;
    const height = canvas.clientHeight || 300;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    const padding = { top: 20, right: 16, bottom: 34, left: 56 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const byDay = new Map(values.map((item) => [String(item.day).slice(0, 10), Number(item.total)]));
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { label: date.toLocaleDateString([], { weekday: 'short' }), value: byDay.get(key) || 0 };
    });
    const max = Math.max(1000, ...days.map((day) => day.value));
    const step = graphWidth / days.length;
    context.clearRect(0, 0, width, height);
    context.font = '12px "DM Sans", sans-serif';
    context.textBaseline = 'middle';
    for (let line = 0; line <= 3; line += 1) {
        const y = padding.top + graphHeight * line / 3;
        context.strokeStyle = '#edf1f5';
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();
        context.fillStyle = '#8995a5';
        context.textAlign = 'right';
        context.fillText(max < 1000 ? '0' : `${Math.round(max * (1 - line / 3) / 1000)}k`, padding.left - 10, y);
    }
    days.forEach((day, index) => {
        const barWidth = Math.min(42, step * .48);
        const barHeight = Math.max(day.value ? 3 : 0, graphHeight * day.value / max);
        const x = padding.left + step * index + (step - barWidth) / 2;
        const y = padding.top + graphHeight - barHeight;
        const gradient = context.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#3485f6');
        gradient.addColorStop(1, '#2853d9');
        context.fillStyle = day.value ? gradient : '#eef3fa';
        context.beginPath();
        context.roundRect(x, y, barWidth, Math.max(barHeight, 2), [6, 6, 2, 2]);
        context.fill();
        context.fillStyle = '#788698';
        context.textAlign = 'center';
        context.fillText(day.label, x + barWidth / 2, height - 12);
    });
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
    appContent.innerHTML = `<div class="page-heading"><div><span class="app-eyebrow">SERVICE &amp; KITCHEN</span><h1>Orders</h1><p>Follow every ticket from payment check to the table.</p></div><div class="heading-actions"><button id="newOrderBtn" class="app-primary">＋ New order</button></div></div>
    <div class="order-summary-strip"><span><i class="order-key key-pending"></i>Awaiting verification <b>${orders.filter((order) => order.status === 'awaiting_verification').length}</b></span><span><i class="order-key key-queue"></i>In queue <b>${orders.filter((order) => order.status === 'verified').length}</b></span><span><i class="order-key key-kitchen"></i>Preparing <b>${orders.filter((order) => order.status === 'preparing').length}</b></span></div>
    <div class="order-board" id="orderBoard">${orders.length ? orders.map((order) => orderCard(order, orders)).join('') : '<div class="app-panel"><p class="empty-state">No orders yet. Create a new ticket to get started.</p></div>'}</div>`;
}

function orderCard(order, orders) {
    const queue = orders.filter((item) => item.status === 'verified');
    const firstVerifiedId = queue.length ? Number(queue[0].id) : null;
    const status = order.status;
    let actions = '';
    if (status === 'awaiting_verification') {
        actions = `${canAccess('payments') ? `<button class="mini-primary" data-action="verify" data-id="${order.id}">Verify &amp; queue</button>` : ''}<button class="mini-quiet" data-action="cancel" data-id="${order.id}" data-current-status="awaiting_verification">Cancel</button>`;
    } else if (status === 'verified') {
        const index = queue.findIndex((item) => Number(item.id) === Number(order.id));
        actions = `<button class="mini-quiet" data-action="up" data-id="${order.id}" ${index === 0 ? 'disabled' : ''}>↑ Move up</button><button class="mini-quiet" data-action="down" data-id="${order.id}" ${index === queue.length - 1 ? 'disabled' : ''}>↓ Move down</button>${canAccess('orders') ? `<button class="mini-primary" data-action="preparing" data-current-status="verified" data-id="${order.id}" ${Number(order.id) !== firstVerifiedId ? 'disabled' : ''}>${Number(order.id) === firstVerifiedId ? 'Start next' : 'Waiting'}</button>` : ''}`;
    } else if (status === 'preparing') {
        actions = canAccess('orders') ? `<button class="mini-primary" data-action="complete" data-current-status="preparing" data-id="${order.id}">Complete order</button>` : '<span class="app-muted">In preparation</span>';
    }
    if (canAccess('payments') && Number(order.paid_amount) < Number(order.total_price)) {
        actions += `<select class="payment-method-select" aria-label="Payment method for order ${order.id}"><option>Cash</option><option>Bank Card</option><option>Airtel Money</option><option>TNM Mpamba</option><option>Bank Transfer</option></select><button class="mini-quiet" data-action="pay" data-id="${order.id}">Record payment</button>`;
    } else if (Number(order.paid_amount) >= Number(order.total_price)) {
        actions += `<button class="mini-quiet" data-action="receipt" data-id="${order.id}">View receipt</button>`;
    }
    const paymentState = Number(order.paid_amount) >= Number(order.total_price) ? 'Paid' : `${formatPrice(Number(order.total_price) - Number(order.paid_amount))} due`;
    const itemSummary = order.lines?.length
        ? order.lines.map((item) => `${item.item_name} × ${item.quantity}`).join(', ')
        : `${order.item_name} × ${order.quantity}`;
    return `<article class="ticket-card">
        <div class="ticket-top"><span class="ticket-id">#${order.id} <i class="order-type-dot type-${escapeHtml(order.order_type)}"></i>${escapeHtml(order.order_type)}${order.table_number ? ` · ${escapeHtml(order.table_number)}` : ''}</span><span class="status-pill status-${escapeHtml(status)}">${escapeHtml(status.replaceAll('_', ' '))}${status === 'verified' && order.queue_position ? ` · #${order.queue_position}` : ''}</span></div>
        <div class="ticket-customer"><span class="order-initial">${escapeHtml(order.customer_name.charAt(0).toUpperCase())}</span><span><strong>${escapeHtml(order.customer_name)}</strong><small>${escapeHtml(order.customer_phone)}</small></span></div>
        <div class="ticket-food"><strong>${escapeHtml(itemSummary)}</strong>${order.notes ? `<p>${escapeHtml(order.notes)}</p>` : ''}</div>
        <div class="ticket-total"><span>${formatPrice(order.total_price)}</span><small>${paymentState} · ${escapeHtml(order.payment_method)}</small></div>
        <div class="ticket-meta"><span>${dateLabel(order.created_at)}</span><button class="text-action" data-action="receipt" data-id="${order.id}">Details</button></div>
        <div class="ticket-actions">${actions || '<span class="app-muted">No actions available</span>'}</div>
    </article>`;
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
    if (field === 'created_at' || field === 'reservation_at' || field === 'expense_date' || field === 'paid_at') return escapeHtml(dateLabel(value));
    if (field === 'status') return `<span class="status-pill status-${escapeHtml(String(value).replaceAll(' ', '_'))}">${escapeHtml(String(value).replaceAll('_', ' '))}</span>`;
    return escapeHtml(value);
}

async function renderModule(resource) {
    const title = pageTitles[resource] || resource;
    const isReadOnly = readOnlyResources.has(resource);
    appContent.innerHTML = `<div class="page-heading"><div><span class="app-eyebrow">RESTAURANT OPERATIONS</span><h1>${escapeHtml(title)}</h1><p>${moduleDescription(resource)}</p></div><div class="heading-actions">${resource === 'inventory' ? '<button id="inventoryAdjustBtn" class="app-secondary">＋ Stock adjustment</button>' : ''}${!isReadOnly ? `<button id="newRecordBtn" class="app-primary">＋ ${newRecordLabel(resource === 'inventory' ? 'ingredients' : resource)}</button>` : ''}</div></div>
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
    appContent.insertAdjacentHTML('beforeend', `<div class="dialog-backdrop" id="recordDialog"><section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><button class="dialog-close" data-dismiss-dialog aria-label="Close">×</button><span class="app-eyebrow">KIPS MENU</span><h2 id="dialogTitle">${isNew ? 'Add a menu item' : 'Edit menu item'}</h2><form id="menuItemForm" class="record-form" enctype="multipart/form-data"><input type="hidden" name="id" value="${record.id || 0}"><label>Food name<input name="name" required maxlength="100" value="${escapeHtml(record.name || '')}"></label><label>Description<textarea name="description" rows="3" required maxlength="300">${escapeHtml(record.description || '')}</textarea></label><label>Price (MK)<input name="price" type="number" min="1" max="100000000" required value="${escapeHtml(record.price || '')}"></label><label>Category<input name="category" maxlength="60" required value="${escapeHtml(record.category || 'Mains')}"></label><label class="menu-image-upload">Upload food photo<input name="image" type="file" accept=".jpg,.jpeg,.jfif,image/jpeg,.png,image/png,.webp,image/webp"><small>Choose a photo from this device · JPEG/JPG/JFIF, PNG or WebP · maximum 10 MB</small><img class="menu-image-preview" alt="Food photo preview" ${imagePreview ? `src="${imagePreview}"` : 'hidden'}>${record.image_path ? '<span class="menu-image-remove"><input name="remove_image" type="checkbox" value="1"> Remove current uploaded photo</span>' : ''}</label><label>Or HTTPS image URL<input name="image_url" type="url" placeholder="Optional, used if no uploaded photo" value="${escapeHtml(record.image_url || '')}"></label><label>Image style<select name="thumb">${['thumb-one', 'thumb-two', 'thumb-three', 'thumb-four', 'thumb-five'].map((thumb, index) => `<option value="${thumb}" ${record.thumb === thumb ? 'selected' : ''}>Food style ${index + 1}</option>`).join('')}</select></label><p class="app-message" data-form-error role="alert"></p><div class="dialog-actions"><button type="button" class="app-secondary" data-dismiss-dialog>Cancel</button><button type="submit" class="app-primary">${isNew ? 'Add to menu' : 'Save changes'}</button></div></form></section></div>`);
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
    appContent.innerHTML = `<div class="page-heading"><div><span class="app-eyebrow">THE BIGGER PICTURE</span><h1>Reports &amp; analytics</h1><p>Make clear decisions from real payments and recorded expenses.</p></div>${currentStaff.role === 'administrator' ? '<button class="app-secondary" id="downloadBackupBtn">↓ Download database backup</button>' : ''}</div><div id="reportContent" class="loading-state">Calculating your last 30 days…</div>`;
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
    appContent.insertAdjacentHTML('beforeend', `<div class="dialog-backdrop" id="recordDialog"><section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><button class="dialog-close" data-dismiss-dialog aria-label="Close">×</button><span class="app-eyebrow">SERVICE COUNTER</span><h2 id="dialogTitle">Start a new order</h2><form id="newOrderForm" class="record-form"><label>Guest name<input name="customer_name" required maxlength="100"></label><label>Phone<input name="customer_phone" required maxlength="30" type="tel"></label><div class="pos-lines-field"><span class="field-label">Order items</span><div id="posOrderLines">${orderLineMarkup(menuOptions, true)}</div><button id="addOrderLineBtn" class="add-order-line" type="button">＋ Add another item</button></div><label>Service type<select name="order_type"><option value="dine-in">Dine-in</option><option value="takeaway">Takeaway</option><option value="delivery">Delivery</option></select></label><label class="table-select-field">Table<select name="table_number">${tableOptions}</select></label><label>Payment method<select name="payment_method"><option>Cash</option><option>Bank Card</option><option>Airtel Money</option><option>TNM Mpamba</option><option>Bank Transfer</option></select></label><label>Order notes<textarea name="notes" maxlength="1000" rows="2"></textarea></label><div class="dialog-actions"><button type="button" class="app-secondary" data-dismiss-dialog>Cancel</button><button class="app-primary">Send to kitchen queue</button></div></form></section></div>`);
    const typeSelect = document.querySelector('#newOrderForm [name="order_type"]');
    const tableField = document.querySelector('.table-select-field');
    typeSelect.addEventListener('change', () => { tableField.hidden = typeSelect.value !== 'dine-in'; });
    tableField.hidden = false;
}

function orderLineMarkup(menuOptions, onlyLine = false) {
    return `<div class="pos-order-line"><label>Food<select class="pos-menu-item" required>${menuOptions}</select></label><label>Qty<input class="pos-quantity" type="number" min="1" max="50" value="1" required></label>${onlyLine ? '' : '<button type="button" class="remove-order-line" data-remove-order-line aria-label="Remove item">×</button>'}</div>`;
}

async function showReceipt(orderId) {
    const data = await request('receipt', { id: orderId }, 'GET');
    const popup = window.open('', '_blank', 'width=480,height=680');
    if (!popup) {
        toast('Allow pop-ups to open the digital receipt.', true);
        return;
    }
    const lines = data.items.map((item) => `<tr><td>${escapeHtml(item.item_name)} × ${item.quantity}</td><td>${formatPrice(item.line_total)}</td></tr>`).join('');
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><title>KIPS receipt #${data.order.id}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:15px Arial,sans-serif;max-width:380px;margin:32px auto;color:#202936;padding:0 18px}h1{font-size:24px}small{color:#667085}table{width:100%;border-collapse:collapse;margin:24px 0}td{padding:10px 0;border-bottom:1px solid #e8ebee}td:last-child{text-align:right}button{background:#d97750;color:white;border:0;border-radius:8px;padding:12px 20px;font-weight:bold}@media print{button{display:none}}</style></head><body><h1>KIPS Restaurant</h1><small>PAYMENT RECEIPT · #${data.payment.id}</small><p>Order #${data.order.id} · ${dateLabel(data.payment.created_at)}</p><p>${escapeHtml(data.order.customer_name)}<br>${escapeHtml(data.order.customer_phone)}</p><table>${lines}<tr><td><strong>Total</strong></td><td><strong>${formatPrice(data.payment.amount)}</strong></td></tr></table><p>Paid via ${escapeHtml(data.payment.method)}${data.payment.reference ? ` · Ref: ${escapeHtml(data.payment.reference)}` : ''}</p><p>Received by ${escapeHtml(data.payment.staff_name || 'KIPS staff')}</p><button onclick="window.print()">Print receipt</button></body></html>`);
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
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'newOrderBtn') {
        if (!dashboardData.tables) {
            const data = await request('module_list', { resource: 'tables' }, 'GET');
            dashboardData.tables = data.items;
        }
        showOrderForm();
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
            toast(result.message);
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
        if (submitButton && (formId === 'recordForm' || formId === 'menuItemForm')) {
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
            result = await request('save_menu_item', formData);
            form.closest('#recordDialog').remove();
            toast(result.message);
            await refreshDashboard();
            renderMenu();
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
    if (activeView === 'dashboard') drawOverviewChart(document.getElementById('salesChart'), dashboardData?.sales || []);
});

window.setInterval(async () => {
    if (!currentStaff || document.getElementById('recordDialog')) return;
    try {
        const data = await request('dashboard', {}, 'GET');
        dashboardData = data;
        document.getElementById('openOrderCount').textContent = data.summary.open_orders || '';
        document.getElementById('notificationDot').hidden = !data.notifications.length;
        if (activeView === 'dashboard') renderOverview();
        if (activeView === 'orders') renderOrders();
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
