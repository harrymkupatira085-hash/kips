const menuSelect = document.getElementById('menuSelect');
const quantityInput = document.getElementById('quantity');
const totalPrice = document.getElementById('totalPrice');
const orderMessage = document.getElementById('orderMessage');
const orderButton = document.getElementById('orderBtn');
const addButtons = document.querySelectorAll('.add-btn');
const paymentModal = document.getElementById('paymentModal');
const closeModal = document.getElementById('closeModal');
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
const modalOrderItem = document.getElementById('modalOrderItem');
const customerName = document.getElementById('customerName');
const customerPhone = document.getElementById('customerPhone');
const orderConfirmation = document.getElementById('orderConfirmation');
const closeOrderConfirmation = document.getElementById('closeOrderConfirmation');
const doneOrderConfirmation = document.getElementById('doneOrderConfirmation');
const orderType = document.getElementById('orderType');
const orderTable = document.getElementById('orderTable');
const orderTableLabel = document.getElementById('orderTableLabel');
const orderNotes = document.getElementById('orderNotes');
const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
const mainNav = document.querySelector('.main-nav');
const navCartCount = document.getElementById('navCartCount');
const menuFilterButtons = document.querySelectorAll('[data-menu-filter]');
const menuCards = document.querySelectorAll('.menu-card[data-category]');
const addToCartButton = document.getElementById('addToCartBtn');
const cartItems = document.getElementById('cartItems');
const menuCartItems = document.getElementById('menuCartItems');
const menuCartSummary = document.getElementById('menuCartSummary');
const menuCartCount = document.getElementById('menuCartCount');
const menuCartTotal = document.getElementById('menuCartTotal');
const menuCartCheckout = document.getElementById('menuCartCheckout');
const cartChoiceModal = document.getElementById('cartChoiceModal');
const cartChoiceMessage = document.getElementById('cartChoiceMessage');
const continueShoppingButton = document.getElementById('continueShoppingBtn');
const checkoutCartButton = document.getElementById('checkoutCartBtn');
const closeCartChoiceButton = document.getElementById('closeCartChoice');
const deliveryMapInput = document.getElementById('deliveryMapInput');
const deliveryLocationTools = document.getElementById('deliveryLocationTools');
const locateMeBtn = document.getElementById('locateMeBtn');
const locationStatus = document.getElementById('locationStatus');
const deliveryLat = document.getElementById('deliveryLat');
const deliveryLng = document.getElementById('deliveryLng');
const deliveryMapPreview = document.getElementById('deliveryMapPreview');
const deliveryMapFrame = document.getElementById('deliveryMapFrame');
const deliveryMapLink = document.getElementById('deliveryMapLink');
const locationIdleMessage = 'Tap the button to share your GPS pin. Our rider follows the pin, so you do not need to type directions.';
let deliveryCoords = null;
const cart = new Map();
const cartStorageKey = 'kips-order-cart';
let cartStorageError = '';
let lastCartTrigger = null;
const kipsSettings = (() => {
    try {
        return JSON.parse(document.getElementById('kipsSettings')?.textContent || '{}') || {};
    } catch {
        return {};
    }
})();
const currencySymbol = kipsSettings.currency_symbol || 'MK';
const checkoutDeliveryFee = Math.max(0, Number(kipsSettings.delivery_fee) || 0);
const checkoutTaxRate = Math.max(0, Number(kipsSettings.tax_rate) || 0);

try {
    const savedCart = JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
    if (Array.isArray(savedCart)) {
        savedCart.forEach((item) => {
            if (item && typeof item.item_name === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 50) {
                cart.set(item.item_name, item.quantity);
            }
        });
    }
} catch {
    cartStorageError = 'Your browser could not restore the saved cart. You can still add items on this page.';
}

function closeMobileNav() {
    if (!mobileNavToggle || !mainNav) return;
    mobileNavToggle.setAttribute('aria-expanded', 'false');
    mobileNavToggle.setAttribute('aria-label', 'Open navigation');
    mainNav.classList.remove('is-open');
}

mobileNavToggle?.addEventListener('click', () => {
    const isExpanded = mobileNavToggle.getAttribute('aria-expanded') === 'true';
    mobileNavToggle.setAttribute('aria-expanded', String(!isExpanded));
    mobileNavToggle.setAttribute('aria-label', isExpanded ? 'Open navigation' : 'Close navigation');
    mainNav?.classList.toggle('is-open', !isExpanded);
});

mainNav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMobileNav);
});

document.addEventListener('click', (event) => {
    if (!mainNav?.classList.contains('is-open')) return;
    if (event.target instanceof Element && event.target.closest('.topbar .nav')) return;
    closeMobileNav();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileNav();
});

menuFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const selectedCategory = button.dataset.menuFilter;
        menuFilterButtons.forEach((filter) => {
            const selected = filter === button;
            filter.classList.toggle('is-active', selected);
            filter.setAttribute('aria-pressed', String(selected));
        });
        menuCards.forEach((card) => {
            card.hidden = selectedCategory !== 'all' && card.dataset.category !== selectedCategory;
        });
    });
});

function formatKwacha(value) {
    return `${currencySymbol} ${Number(value).toLocaleString('en-US')}`;
}

async function postWithFreshCsrf(action, payload) {
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const send = () => fetch(`api.php?action=${action}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfMeta?.content || ''
        },
        body: JSON.stringify(payload)
    });
    let response = await send();
    if (response.status === 403) {
        const statusResponse = await fetch('api.php?action=status', { cache: 'no-store' });
        if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.csrf_token && csrfMeta) {
                csrfMeta.content = status.csrf_token;
                response = await send();
            }
        }
    }
    return response;
}

function cartQuantity() {
    return Array.from(cart.values()).reduce((total, quantity) => total + quantity, 0);
}

function menuPriceMap() {
    const priceByItem = new Map(Array.from(addButtons, (button) => [button.dataset.item, Number(button.dataset.price) || 0]));
    if (menuSelect) {
        Array.from(menuSelect.options).forEach((option) => priceByItem.set(option.value, Number(option.dataset.price) || 0));
    }
    return priceByItem;
}

function cartSubtotal() {
    const priceByItem = menuPriceMap();
    return Array.from(cart, ([item, quantity]) => (priceByItem.get(item) || 0) * quantity)
        .reduce((sum, amount) => sum + amount, 0);
}

function checkoutTotals() {
    const subtotal = cartSubtotal();
    const delivery = orderType?.value === 'delivery' ? checkoutDeliveryFee : 0;
    const tax = Math.round(subtotal * checkoutTaxRate / 100);
    return { subtotal, delivery, tax, total: subtotal + delivery + tax };
}

function updateModalTotals() {
    const totals = checkoutTotals();
    const setText = (id, text) => {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    };
    setText('modalSubtotal', formatKwacha(totals.subtotal));
    setText('modalDeliveryFee', formatKwacha(totals.delivery));
    setText('modalTaxAmount', formatKwacha(totals.tax));
    setText('modalTotalPrice', formatKwacha(totals.total));
    const deliveryRow = document.getElementById('modalDeliveryRow');
    if (deliveryRow) deliveryRow.hidden = totals.delivery <= 0;
    const taxRow = document.getElementById('modalTaxRow');
    if (taxRow) taxRow.hidden = totals.tax <= 0;
    const taxLabel = document.getElementById('modalTaxLabel');
    if (taxLabel) taxLabel.textContent = checkoutTaxRate ? `VAT (${checkoutTaxRate}%)` : 'VAT / tax';
}

function saveCart() {
    try {
        localStorage.setItem(cartStorageKey, JSON.stringify(Array.from(cart, ([item_name, quantity]) => ({ item_name, quantity }))));
        cartStorageError = '';
        return true;
    } catch {
        cartStorageError = 'Your browser could not save the cart. Keep this page open while you order.';
        return false;
    }
}

function addCartItem(item, quantity) {
    const nextQuantity = (cart.get(item) || 0) + quantity;
    if (nextQuantity > 50 || cartQuantity() + quantity > 100) {
        throw new Error('You can order up to 50 of one meal and 100 items total.');
    }
    if (!cart.has(item) && cart.size >= 30) {
        throw new Error('An order can include up to 30 different menu items.');
    }
    cart.set(item, nextQuantity);
    return saveCart();
}

function renderCart() {
    const priceByItem = menuPriceMap();
    const subtotal = cartSubtotal();
    const quantities = cartQuantity();
    if (navCartCount) {
        navCartCount.textContent = String(quantities);
        navCartCount.hidden = quantities === 0;
        navCartCount.setAttribute('aria-label', `${quantities} item${quantities === 1 ? '' : 's'} in cart`);
    }
    const renderLines = (list) => {
        if (!list) return;
        list.replaceChildren();
        cart.forEach((quantity, item) => {
            const lineTotal = (priceByItem.get(item) || 0) * quantity;
            const row = document.createElement('div');
            row.className = 'cart-item';
            const label = document.createElement('span');
            label.textContent = `${item} × ${quantity}`;
            const amount = document.createElement('strong');
            amount.textContent = formatKwacha(lineTotal);
            const decrease = document.createElement('button');
            decrease.type = 'button';
            decrease.className = 'cart-quantity-button';
            decrease.dataset.cartAction = 'decrease';
            decrease.dataset.item = item;
            decrease.setAttribute('aria-label', `Decrease ${item} quantity`);
            decrease.textContent = '−';
            const quantityLabel = document.createElement('span');
            quantityLabel.className = 'cart-quantity';
            quantityLabel.textContent = String(quantity);
            const increase = document.createElement('button');
            increase.type = 'button';
            increase.className = 'cart-quantity-button';
            increase.dataset.cartAction = 'increase';
            increase.dataset.item = item;
            increase.setAttribute('aria-label', `Increase ${item} quantity`);
            increase.textContent = '+';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'cart-remove';
            remove.dataset.cartRemove = item;
            remove.setAttribute('aria-label', `Remove ${item} from cart`);
            remove.textContent = 'Remove';
            row.append(label, amount, decrease, quantityLabel, increase, remove);
            list.append(row);
        });
    };
    totalPrice && (totalPrice.textContent = formatKwacha(subtotal));
    renderLines(cartItems);
    if (menuCartItems !== cartItems) {
        renderLines(menuCartItems);
        if (menuCartTotal) menuCartTotal.textContent = formatKwacha(subtotal);
        if (menuCartCount) menuCartCount.textContent = quantities ? `(${quantities} item${quantities === 1 ? '' : 's'})` : '';
        if (menuCartSummary) menuCartSummary.hidden = cart.size === 0;
    }
    const unavailableItem = Array.from(cart.keys()).some((item) => !priceByItem.has(item));
    if (orderButton) orderButton.disabled = cart.size === 0 || unavailableItem;
    if (cart.size === 0 && orderMessage) {
        orderMessage.textContent = 'Add one or more meals to your cart.';
    } else if (unavailableItem && orderMessage) {
        orderMessage.textContent = 'A cart item is no longer available. Remove it before continuing.';
    }
    if (paymentModal?.classList.contains('active')) updateModalTotals();
}

renderCart();

function showCartChoice(item) {
    if (!cartChoiceModal) return;
    const quantity = cart.get(item) || 1;
    const priceByItem = new Map(Array.from(addButtons, (button) => [button.dataset.item, Number(button.dataset.price) || 0]));
    if (menuSelect) {
        Array.from(menuSelect.options).forEach((option) => priceByItem.set(option.value, Number(option.dataset.price) || 0));
    }
    const total = Array.from(cart, ([name, count]) => (priceByItem.get(name) || 0) * count)
        .reduce((sum, amount) => sum + amount, 0);
    cartChoiceMessage.textContent = `${item} × ${quantity} added. Your basket has ${cartQuantity()} item${cartQuantity() === 1 ? '' : 's'} totaling ${formatKwacha(total)}.`;
    cartChoiceModal.classList.add('active');
    cartChoiceModal.setAttribute('aria-hidden', 'false');
    continueShoppingButton?.focus();
}

function closeCartChoice() {
    if (!cartChoiceModal) return;
    cartChoiceModal.classList.remove('active');
    cartChoiceModal.setAttribute('aria-hidden', 'true');
    lastCartTrigger?.focus();
}

function openPaymentModal() {
    if (!paymentModal || !cart.size) return;
    const summary = Array.from(cart, ([item, quantity]) => `${item} × ${quantity}`).join(', ');
    modalOrderItem.textContent = summary;
    updateModalTotals();
    paymentModal.classList.add('active');
    paymentModal.setAttribute('aria-hidden', 'false');
    customerName.focus();
}

function closePaymentModal() {
    if (!paymentModal) return;

    paymentModal.classList.remove('active');
    paymentModal.setAttribute('aria-hidden', 'true');
    orderButton?.focus();
}

let confirmationTrackTimer;
function closeOrderConfirmationModal() {
    clearTimeout(confirmationTrackTimer);
    if (!orderConfirmation) return;
    orderConfirmation.hidden = true;
    orderButton?.focus();
}

function startConfirmationTracking(orderId, token) {
    clearTimeout(confirmationTrackTimer);
    if (!orderConfirmation || orderType?.value !== 'delivery') return;
    const message = document.getElementById('orderConfirmationMessage');
    const check = async () => {
        if (!orderConfirmation || orderConfirmation.hidden || !message) return;
        try {
            const query = new URLSearchParams({ action: 'customer_order', order: String(orderId), token });
            const response = await fetch(`api.php?${query}`, { cache: 'no-store' });
            if (!response.ok) return;
            const { order } = await response.json();
            if (!order || orderConfirmation.hidden) return;
            if (Number(order.delivery_confirmed)) {
                message.textContent = order.staff_reply
                    ? `Location confirmed. Message from the restaurant: “${order.staff_reply}”`
                    : 'Your delivery location has been confirmed by the restaurant. Our rider will follow your pin.';
                return;
            }
            if (order.status !== 'awaiting_verification') {
                message.textContent = 'Your order has been confirmed by the restaurant. Keep your private link to follow progress.';
                return;
            }
            confirmationTrackTimer = setTimeout(check, 8000);
        } catch {
            confirmationTrackTimer = setTimeout(check, 8000);
        }
    };
    confirmationTrackTimer = setTimeout(check, 6000);
}

closeOrderConfirmation?.addEventListener('click', closeOrderConfirmationModal);
doneOrderConfirmation?.addEventListener('click', () => {
    window.location.assign('index.php');
});
orderConfirmation?.addEventListener('click', (event) => {
    if (event.target === orderConfirmation) closeOrderConfirmationModal();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && orderConfirmation && !orderConfirmation.hidden) {
        closeOrderConfirmationModal();
    }
    if (event.key === 'Escape' && cartChoiceModal?.classList.contains('active')) {
        closeCartChoice();
    }
});

continueShoppingButton?.addEventListener('click', closeCartChoice);
closeCartChoiceButton?.addEventListener('click', closeCartChoice);
menuCartCheckout?.addEventListener('click', () => {
    window.location.href = 'index.php?page=order&checkout=1';
});
cartChoiceModal?.addEventListener('click', (event) => {
    if (event.target === cartChoiceModal) closeCartChoice();
});
checkoutCartButton?.addEventListener('click', () => {
    window.location.href = 'index.php?page=order&checkout=1';
});

addToCartButton?.addEventListener('click', () => {
    try {
        const quantity = Number(quantityInput.value);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
            throw new Error('Choose a quantity between 1 and 50.');
        }
        const item = menuSelect.value;
        const saved = addCartItem(item, quantity);
        lastCartTrigger = addToCartButton;
        renderCart();
        orderMessage.textContent = saved
            ? `${item} added to your cart.`
            : `${item} added for this visit, but the cart could not be saved in your browser.`;
        showCartChoice(item);
    } catch (error) {
        orderMessage.textContent = error.message;
    }
});

function handleCartAction(event) {
    const button = event.target.closest('[data-cart-remove], [data-cart-action]');
    if (!button) return;
    if (button.dataset.cartRemove) {
        cart.delete(button.dataset.cartRemove);
    } else {
        const item = button.dataset.item;
        const quantity = cart.get(item) || 0;
        if (button.dataset.cartAction === 'decrease' && quantity <= 1) {
            cart.delete(item);
        } else if (button.dataset.cartAction === 'decrease') {
            cart.set(item, quantity - 1);
        } else if (button.dataset.cartAction === 'increase') {
            try {
                addCartItem(item, 1);
            } catch (error) {
                orderMessage.textContent = error.message;
                return;
            }
        }
    }
    saveCart();
    renderCart();
}

cartItems?.addEventListener('click', handleCartAction);
menuCartItems?.addEventListener('click', handleCartAction);

addButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const item = button.dataset.item;
        const message = document.getElementById('menuCartMessage');
        try {
            const saved = addCartItem(item, 1);
            lastCartTrigger = button;
            renderCart();
            if (!saved) {
                if (message) message.textContent = cartStorageError;
            }
            showCartChoice(item);
        } catch (error) {
            if (message) message.textContent = error.message;
        }
    });
});

if (menuSelect) {
    const requestedItem = new URLSearchParams(window.location.search).get('item');
    if (requestedItem && Array.from(menuSelect.options).some((option) => option.value === requestedItem) && !cart.has(requestedItem)) {
        try {
            addCartItem(requestedItem, 1);
        } catch (error) {
            orderMessage.textContent = error.message;
        }
    }
    renderCart();
    if (cartStorageError) orderMessage.textContent = cartStorageError;
    if (new URLSearchParams(window.location.search).get('checkout') === '1') {
        openPaymentModal();
    }
}

orderButton?.addEventListener('click', openPaymentModal);

closeModal?.addEventListener('click', closePaymentModal);

paymentModal?.addEventListener('click', (event) => {
    if (event.target === paymentModal) {
        closePaymentModal();
    }
});

function googleMapsUrl(lat, lng) {
    return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function setDeliveryCoords(lat, lng, message) {
    deliveryCoords = { lat, lng };
    if (deliveryLat) deliveryLat.value = String(lat);
    if (deliveryLng) deliveryLng.value = String(lng);
    if (deliveryMapFrame) {
        const bbox = [lng - .004, lat - .004, lng + .004, lat + .004]
            .map((value) => value.toFixed(5))
            .join('%2C');
        deliveryMapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
    }
    if (deliveryMapLink) deliveryMapLink.href = googleMapsUrl(lat, lng);
    if (deliveryMapPreview) deliveryMapPreview.hidden = false;
    if (locationStatus && message) locationStatus.textContent = message;
}

function resetDeliveryLocation() {
    deliveryCoords = null;
    if (deliveryLat) deliveryLat.value = '';
    if (deliveryLng) deliveryLng.value = '';
    if (deliveryMapPreview) deliveryMapPreview.hidden = true;
    if (deliveryMapFrame) deliveryMapFrame.src = 'about:blank';
    if (deliveryMapInput) deliveryMapInput.value = '';
    if (locationStatus) locationStatus.textContent = locationIdleMessage;
    if (locateMeBtn) locateMeBtn.disabled = false;
}

function syncDeliveryLocationVisibility() {
    if (!deliveryLocationTools) return;
    deliveryLocationTools.hidden = orderType?.value !== 'delivery';
}

function extractMapCoords(text) {
    const patterns = [
        /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
        /[?&](?:q|query|ll|daddr|destination)=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
        /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat, lng };
        }
    }
    return null;
}

syncDeliveryLocationVisibility();

locateMeBtn?.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
        if (locationStatus) locationStatus.textContent = 'This browser cannot access GPS. Type your address instead.';
        return;
    }
    locateMeBtn.disabled = true;
    if (locationStatus) locationStatus.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition((position) => {
        locateMeBtn.disabled = false;
        const { latitude, longitude } = position.coords;
        if (deliveryMapInput) deliveryMapInput.value = '';
        setDeliveryCoords(latitude, longitude, 'GPS pin added. Our rider will follow this pin — you can send the order now.');
    }, (error) => {
        locateMeBtn.disabled = false;
        if (locationStatus) {
            locationStatus.textContent = error.code === error.PERMISSION_DENIED
                ? 'Location access is blocked. Allow it in your browser, or paste a Google Maps link below.'
                : 'We could not get your location just now. Try again or paste a Google Maps link below.';
        }
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
});

deliveryMapInput?.addEventListener('input', () => {
    const link = deliveryMapInput.value.trim();
    if (link === '') return;
    const coords = extractMapCoords(link);
    if (coords) {
        setDeliveryCoords(coords.lat, coords.lng, 'Location taken from the Google Maps link you pasted.');
    } else if (locationStatus && !deliveryCoords) {
        locationStatus.textContent = 'That link does not include a location. Use “Use my current location” or paste the full Google Maps link.';
    }
});

orderType?.addEventListener('change', () => {
    const showTable = orderType.value === 'dine-in';
    orderTable.hidden = !showTable;
    orderTableLabel.hidden = !showTable;
    orderTable.required = showTable;
    syncDeliveryLocationVisibility();
    orderMessage.textContent = showTable && !orderTable.options.length
        ? 'No tables are available for dine-in right now.'
        : `${orderType.options[orderType.selectedIndex].text} selected. Our team will confirm your order before you choose a payment method.`;
    updateModalTotals();
});

confirmPaymentBtn?.addEventListener('click', async () => {
    if (!customerName.reportValidity() || !customerPhone.reportValidity()
        || (orderType.value === 'dine-in' && !orderTable.reportValidity())) return;
    if (orderType.value === 'delivery' && !deliveryCoords) {
        if (locationStatus) {
            locationStatus.textContent = 'Share your GPS location or paste a Google Maps link before sending the order.';
        }
        deliveryLocationTools?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    if (!cart.size) {
        orderMessage.textContent = 'Add a meal to your cart before placing the order.';
        closePaymentModal();
        return;
    }
    const customer = customerName.value.trim() || 'Customer';
    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.textContent = 'Submitting…';
    try {
        const response = await postWithFreshCsrf('create_order', {
            customer_name: customer,
            customer_phone: customerPhone.value.trim(),
            items: Array.from(cart, ([item_name, quantity]) => ({ item_name, quantity })),
            order_type: orderType.value,
            table_number: orderType.value === 'dine-in' ? orderTable.value : '',
            delivery_address: orderType.value === 'delivery' && extractMapCoords(deliveryMapInput?.value.trim() || '') ? deliveryMapInput.value.trim() : '',
            delivery_lat: orderType.value === 'delivery' && deliveryCoords ? deliveryCoords.lat : '',
            delivery_lng: orderType.value === 'delivery' && deliveryCoords ? deliveryCoords.lng : '',
            notes: orderNotes.value.trim()
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not submit your order.');

        orderMessage.textContent = `Order #${result.order_id} received. It is waiting for staff confirmation.`;
        document.getElementById('confirmationOrderId').textContent = `#${result.order_id}`;
        document.getElementById('confirmationTotal').textContent = formatKwacha(result.total);
        document.getElementById('confirmationType').textContent = orderType.options[orderType.selectedIndex].text;
        document.getElementById('orderConfirmationTitle').textContent = `Thank you, ${customer}!`;
        document.getElementById('orderConfirmationMessage').textContent = orderType.value === 'delivery'
            ? `We received order #${result.order_id}. Our team is checking your shared location and will reply on your private link. Keep it open so you see the confirmation.`
            : `We received order #${result.order_id}. Our team will contact you manually to confirm it.`;
        const trackingUrl = new URL('index.php', window.location.href);
        trackingUrl.searchParams.set('order', String(result.order_id));
        trackingUrl.searchParams.set('token', result.tracking_token);
        startConfirmationTracking(result.order_id, result.tracking_token);
        document.getElementById('confirmationOrderLink').href = trackingUrl.href;
        document.getElementById('copyOrderLink').onclick = async () => {
            try {
                await navigator.clipboard.writeText(trackingUrl.href);
                document.getElementById('copyOrderLink').textContent = 'Link copied';
            } catch {
                window.prompt('Copy your private order link:', trackingUrl.href);
            }
        };
        cart.clear();
        saveCart();
        renderCart();
        closePaymentModal();
        orderConfirmation.hidden = false;
        closeOrderConfirmation.focus();
        customerName.value = '';
        customerPhone.value = '';
        orderNotes.value = '';
        resetDeliveryLocation();
    } catch (error) {
        orderMessage.textContent = error.message;
    } finally {
        confirmPaymentBtn.disabled = false;
        confirmPaymentBtn.textContent = 'Send order request';
    }
});

const customerOrderPage = document.getElementById('customerOrderPage');
const customerOrderParams = new URLSearchParams(window.location.search);
const customerOrderId = customerOrderParams.get('order');
const customerOrderToken = customerOrderParams.get('token');
const customerOrderNumber = document.getElementById('customerOrderNumber');
const customerOrderStatus = document.getElementById('customerOrderStatus');
const customerOrderSummary = document.getElementById('customerOrderSummary');
const customerPaymentChoice = document.getElementById('customerPaymentChoice');
const customerPaymentMethod = document.getElementById('customerPaymentMethod');
const saveCustomerPayment = document.getElementById('saveCustomerPayment');
let customerOrderRefreshTimer;

async function loadCustomerOrder() {
    clearTimeout(customerOrderRefreshTimer);
    customerOrderStatus.textContent = 'Loading your order…';
    try {
        const query = new URLSearchParams({ action: 'customer_order', order: customerOrderId, token: customerOrderToken });
        const response = await fetch(`api.php?${query}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load this order.');
        const order = result.order;
        const hasPaymentPreference = order.payment_method !== 'Awaiting customer choice';
        const statuses = {
            awaiting_verification: order.order_type === 'delivery'
                ? (Number(order.delivery_confirmed)
                    ? 'Your delivery location is confirmed. Our team is finalising your order and will confirm it here shortly.'
                    : 'Your order is being reviewed. We are checking the location you shared and will reply here. You can cancel below until then; payment selection opens after confirmation.')
                : 'Your order is being reviewed. Our team will contact you to confirm it, and you can cancel it below until then. Payment selection will become available after confirmation.',
            verified: hasPaymentPreference
                ? `Your order is confirmed — please be ready to receive your meal. Your preferred method is ${order.payment_method}. Staff will verify payment after receiving it.`
                : 'Your order is confirmed — please be ready to receive your meal. Choose your preferred payment method below.',
            preparing: hasPaymentPreference
                ? `Your order is being prepared — please be ready to receive your meal. Your preferred method is ${order.payment_method}; staff will verify payment after receiving it.`
                : 'Your order is being prepared — please be ready to receive your meal. Choose your preferred payment method below.',
            completed: 'Your order is ready. Please receive your meal — thank you!',
            cancelled: 'This order was cancelled. Contact the restaurant if you need help.'
        };
        customerOrderStatus.textContent = statuses[order.status] || 'Order status updated. Contact the restaurant for assistance.';
        customerOrderSummary.hidden = false;
        document.getElementById('customerOrderItems').textContent = order.items.map((item) => `${item.item_name} × ${item.quantity}`).join(', ');
        document.getElementById('customerOrderSubtotal').textContent = formatKwacha(Number(order.subtotal) || Number(order.total_price));
        const deliveryRow = document.getElementById('customerOrderDeliveryRow');
        deliveryRow.hidden = !Number(order.delivery_fee);
        document.getElementById('customerOrderDeliveryFee').textContent = formatKwacha(order.delivery_fee);
        const taxRow = document.getElementById('customerOrderTaxRow');
        taxRow.hidden = !Number(order.tax_amount);
        document.getElementById('customerOrderTax').textContent = formatKwacha(order.tax_amount);
        const discountRow = document.getElementById('customerOrderDiscountRow');
        discountRow.hidden = !Number(order.discount);
        document.getElementById('customerOrderDiscount').textContent = `− ${formatKwacha(order.discount)}`;
        document.getElementById('customerOrderTotal').textContent = formatKwacha(order.total_price);
        const cancelButton = document.getElementById('cancelCustomerOrder');
        if (cancelButton) cancelButton.hidden = !order.can_cancel;
        document.getElementById('customerOrderType').textContent = order.order_type.replace('-', ' ');
        const mapRow = document.getElementById('customerOrderMapRow');
        const mapLink = document.getElementById('customerOrderMapLink');
        const mapLat = Number(order.delivery_lat);
        const mapLng = Number(order.delivery_lng);
        const hasMap = order.delivery_lat !== null && order.delivery_lat !== ''
            && order.delivery_lng !== null && order.delivery_lng !== ''
            && Number.isFinite(mapLat) && Number.isFinite(mapLng)
            && Math.abs(mapLat) <= 90 && Math.abs(mapLng) <= 180;
        if (mapRow) mapRow.hidden = !hasMap;
        if (hasMap && mapLink) mapLink.href = googleMapsUrl(mapLat, mapLng);
        const locationCheckRow = document.getElementById('customerOrderLocationStatusRow');
        const locationCheck = document.getElementById('customerOrderLocationStatus');
        const isDelivery = order.order_type === 'delivery';
        if (locationCheckRow) locationCheckRow.hidden = !isDelivery;
        if (locationCheck && isDelivery) {
            locationCheck.textContent = Number(order.delivery_confirmed)
                ? 'Confirmed by the restaurant — our rider has your pin.'
                : 'Waiting for the restaurant to confirm your location.';
        }
        const replyPanel = document.getElementById('customerOrderReply');
        const replyText = document.getElementById('customerOrderReplyText');
        const staffReply = String(order.staff_reply || '').trim();
        if (replyPanel) replyPanel.hidden = staffReply === '';
        if (replyText) replyText.textContent = staffReply;
        document.getElementById('customerOrderMethod').textContent = order.payment_method === 'Awaiting customer choice' ? 'Not selected yet' : order.payment_method;
        customerPaymentChoice.hidden = !order.can_choose_payment;
        if (order.can_choose_payment && Array.from(customerPaymentMethod.options).some((option) => option.value === order.payment_method)) {
            customerPaymentMethod.value = order.payment_method;
        }
        if (['awaiting_verification', 'verified', 'preparing'].includes(order.status)) {
            customerOrderRefreshTimer = setTimeout(loadCustomerOrder, order.status === 'awaiting_verification' ? 10000 : 15000);
        }
    } catch (error) {
        customerOrderStatus.textContent = error.message;
        customerOrderSummary.hidden = true;
        customerPaymentChoice.hidden = true;
        const cancelButton = document.getElementById('cancelCustomerOrder');
        if (cancelButton) cancelButton.hidden = true;
    }
}

if (customerOrderPage && customerOrderId && /^\d+$/.test(customerOrderId) && /^[a-f0-9]{64}$/.test(customerOrderToken || '')) {
    document.querySelector('.topbar').hidden = true;
    document.querySelector('body > main:not(#customerOrderPage)').hidden = true;
    document.querySelector('.site-footer').hidden = true;
    customerOrderPage.hidden = false;
    customerOrderNumber.textContent = `#${customerOrderId}`;
    document.getElementById('refreshCustomerOrder').addEventListener('click', loadCustomerOrder);
    document.getElementById('cancelCustomerOrder')?.addEventListener('click', async (event) => {
        if (!window.confirm('Cancel this order? The restaurant will be notified.')) return;
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'Cancelling…';
        try {
            const response = await fetch('api.php?action=cancel_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: Number(customerOrderId), token: customerOrderToken })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not cancel this order.');
            customerOrderStatus.textContent = result.message;
            await loadCustomerOrder();
        } catch (error) {
            customerOrderStatus.textContent = error.message;
        } finally {
            button.disabled = false;
            button.textContent = 'Cancel this order';
        }
    });
    saveCustomerPayment.addEventListener('click', async () => {
        saveCustomerPayment.disabled = true;
        saveCustomerPayment.textContent = 'Saving…';
        try {
            const response = await fetch('api.php?action=customer_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: Number(customerOrderId),
                    token: customerOrderToken,
                    payment_method: customerPaymentMethod.value
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not save your payment preference.');
            customerOrderStatus.textContent = result.message;
            await loadCustomerOrder();
        } catch (error) {
            customerOrderStatus.textContent = error.message;
        } finally {
            saveCustomerPayment.disabled = false;
            saveCustomerPayment.textContent = 'Save payment preference';
        }
    });
    loadCustomerOrder();
} else if (customerOrderPage && (customerOrderId || customerOrderToken)) {
    document.querySelector('.topbar').hidden = true;
    document.querySelector('body > main:not(#customerOrderPage)').hidden = true;
    document.querySelector('.site-footer').hidden = true;
    customerOrderPage.hidden = false;
    customerOrderStatus.textContent = 'This order link is invalid. Please use the private link from your order confirmation.';
}

const reservationForm = document.getElementById('reservationForm');
if (reservationForm) {
    const reservationDate = reservationForm.elements.reservation_at;
    const minimumDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    reservationDate.min = minimumDate;
    reservationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = document.getElementById('reservationMessage');
        const fields = Object.fromEntries(new FormData(reservationForm));
        fields.party_size = Number(fields.party_size);
        const submitButton = reservationForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        message.textContent = '';
        try {
            const response = await postWithFreshCsrf('create_reservation', fields);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not submit your reservation.');
            message.textContent = `${result.message} Reference #${result.reservation_id}.`;
            reservationForm.reset();
            reservationDate.min = minimumDate;
        } catch (error) {
            message.textContent = error.message;
        } finally {
            submitButton.disabled = false;
        }
    });
}

renderCart();

(() => {
    if (!document.body?.classList.contains('page-home')) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const revealTargets = Array.from(document.querySelectorAll('[data-reveal]'));

    if (reduceMotion || !('IntersectionObserver' in window)) {
        revealTargets.forEach((element) => {
            element.classList.add('is-visible');
            element.removeAttribute('data-reveal');
        });
    } else {
        document.body.classList.add('reveal-ready');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const element = entry.target;
                element.classList.add('is-visible');
                observer.unobserve(element);
                const delay = parseFloat(getComputedStyle(element).transitionDelay) || 0;
                setTimeout(() => element.removeAttribute('data-reveal'), 1060 + delay * 1000);
            });
        }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
        revealTargets.forEach((element) => observer.observe(element));
    }

    const canTilt = !reduceMotion && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const tiltTarget = document.querySelector('[data-tilt]');
    if (canTilt && tiltTarget) {
        const maxTilt = 7;
        tiltTarget.addEventListener('pointermove', (event) => {
            const rect = tiltTarget.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            tiltTarget.style.transition = 'transform .18s ease-out';
            tiltTarget.style.transform = `perspective(1100px) rotateX(${(-y * maxTilt).toFixed(2)}deg) rotateY(${(x * maxTilt).toFixed(2)}deg)`;
        });
        tiltTarget.addEventListener('pointerleave', () => {
            tiltTarget.style.transition = 'transform .6s cubic-bezier(.2, .8, .25, 1)';
            tiltTarget.style.transform = '';
        });
    }
})();
