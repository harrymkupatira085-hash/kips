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
const deliveryAddress = document.getElementById('deliveryAddress');
const deliveryAddressLabel = document.getElementById('deliveryAddressLabel');
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

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileNav();
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

function closeOrderConfirmationModal() {
    if (!orderConfirmation) return;
    orderConfirmation.hidden = true;
    orderButton?.focus();
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

orderType?.addEventListener('change', () => {
    const showTable = orderType.value === 'dine-in';
    const showAddress = orderType.value === 'delivery';
    orderTable.hidden = !showTable;
    orderTableLabel.hidden = !showTable;
    orderTable.required = showTable;
    deliveryAddress.hidden = !showAddress;
    deliveryAddressLabel.hidden = !showAddress;
    deliveryAddress.required = showAddress;
    orderMessage.textContent = showTable && !orderTable.options.length
        ? 'No tables are available for dine-in right now.'
        : `${orderType.options[orderType.selectedIndex].text} selected. Our team will confirm your order before you choose a payment method.`;
    updateModalTotals();
});

confirmPaymentBtn?.addEventListener('click', async () => {
    if (!customerName.reportValidity() || !customerPhone.reportValidity()
        || (orderType.value === 'delivery' && !deliveryAddress.reportValidity())
        || (orderType.value === 'dine-in' && !orderTable.reportValidity())) return;
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
            delivery_address: orderType.value === 'delivery' ? deliveryAddress.value.trim() : '',
            notes: orderNotes.value.trim()
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not submit your order.');

        orderMessage.textContent = `Order #${result.order_id} received. It is waiting for staff confirmation.`;
        document.getElementById('confirmationOrderId').textContent = `#${result.order_id}`;
        document.getElementById('confirmationTotal').textContent = formatKwacha(result.total);
        document.getElementById('confirmationType').textContent = orderType.options[orderType.selectedIndex].text;
        document.getElementById('orderConfirmationTitle').textContent = `Thank you, ${customer}!`;
        document.getElementById('orderConfirmationMessage').textContent = `We received order #${result.order_id}. Our team will contact you manually to confirm it.`;
        const trackingUrl = new URL('index.php', window.location.href);
        trackingUrl.searchParams.set('order', String(result.order_id));
        trackingUrl.searchParams.set('token', result.tracking_token);
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
        deliveryAddress.value = '';
        orderNotes.value = '';
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
            awaiting_verification: 'Your order is being reviewed. Our team will contact you to confirm it, and you can cancel it below until then. Payment selection will become available after confirmation.',
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
        const addressRow = document.getElementById('customerOrderAddressRow');
        addressRow.hidden = order.order_type !== 'delivery';
        document.getElementById('customerOrderAddress').textContent = order.delivery_address || '';
        document.getElementById('customerOrderMethod').textContent = order.payment_method === 'Awaiting customer choice' ? 'Not selected yet' : order.payment_method;
        customerPaymentChoice.hidden = !order.can_choose_payment;
        if (order.can_choose_payment && Array.from(customerPaymentMethod.options).some((option) => option.value === order.payment_method)) {
            customerPaymentMethod.value = order.payment_method;
        }
        if (['awaiting_verification', 'verified', 'preparing'].includes(order.status)) {
            customerOrderRefreshTimer = setTimeout(loadCustomerOrder, 15000);
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
