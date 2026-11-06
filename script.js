const menuSelect = document.getElementById('menuSelect');
const quantityInput = document.getElementById('quantity');
const totalPrice = document.getElementById('totalPrice');
const orderMessage = document.getElementById('orderMessage');
const orderButton = document.getElementById('orderBtn');
const menuCards = document.querySelectorAll('.menu-card');
const addButtons = document.querySelectorAll('.add-btn');
const paymentModal = document.getElementById('paymentModal');
const closeModal = document.getElementById('closeModal');
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
const modalOrderItem = document.getElementById('modalOrderItem');
const modalTotalPrice = document.getElementById('modalTotalPrice');
const customerName = document.getElementById('customerName');
const customerPhone = document.getElementById('customerPhone');
const orderConfirmation = document.getElementById('orderConfirmation');
const closeOrderConfirmation = document.getElementById('closeOrderConfirmation');
const doneOrderConfirmation = document.getElementById('doneOrderConfirmation');
const orderType = document.getElementById('orderType');
const orderTable = document.getElementById('orderTable');
const orderTableLabel = document.getElementById('orderTableLabel');
const orderNotes = document.getElementById('orderNotes');

function formatKwacha(value) {
    return `MK ${Number(value).toLocaleString('en-US')}`;
}

function getSelectedPrice() {
    return Number(menuSelect.selectedOptions[0]?.dataset.price) || 0;
}

function updateTotal() {
    if (!menuSelect || !menuSelect.value) return;
    const selectedItem = menuSelect.value;
    const quantity = Math.max(1, Number(quantityInput.value) || 1);
    const basePrice = getSelectedPrice();
    const total = basePrice * quantity;

    totalPrice.textContent = formatKwacha(total);

    if (paymentModal) {
        modalOrderItem.textContent = `${selectedItem} × ${quantity}`;
        modalTotalPrice.textContent = formatKwacha(total);
    }
}

function openPaymentModal() {
    if (!paymentModal) return;

    updateTotal();
    paymentModal.classList.add('active');
    paymentModal.setAttribute('aria-hidden', 'false');
}

function closePaymentModal() {
    if (!paymentModal) return;

    paymentModal.classList.remove('active');
    paymentModal.setAttribute('aria-hidden', 'true');
}

function closeOrderConfirmationModal() {
    if (!orderConfirmation) return;
    orderConfirmation.hidden = true;
    orderButton?.focus();
}

closeOrderConfirmation?.addEventListener('click', closeOrderConfirmationModal);
doneOrderConfirmation?.addEventListener('click', closeOrderConfirmationModal);
orderConfirmation?.addEventListener('click', (event) => {
    if (event.target === orderConfirmation) closeOrderConfirmationModal();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && orderConfirmation && !orderConfirmation.hidden) {
        closeOrderConfirmationModal();
    }
});

menuSelect?.addEventListener('change', () => {
    updateTotal();
    orderMessage.textContent = `${menuSelect.value} selected. Our team will confirm your order before you choose a payment method.`;
});

quantityInput?.addEventListener('input', updateTotal);

addButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const item = button.dataset.item;
        if (!menuSelect || !quantityInput) {
            window.location.href = `index.php?page=order&item=${encodeURIComponent(item)}`;
            return;
        }
        const price = Number(button.dataset.price);

        menuSelect.value = item;
        quantityInput.value = 1;

        menuCards.forEach((card) => {
            const title = card.querySelector('h3')?.textContent || '';
            card.classList.toggle('active', title === item);
        });

        totalPrice.textContent = formatKwacha(price);
        orderMessage.textContent = `${item} added to your order.`;
        updateTotal();
        openPaymentModal();
    });
});

if (menuSelect) {
    const requestedItem = new URLSearchParams(window.location.search).get('item');
    if (requestedItem && Array.from(menuSelect.options).some((option) => option.value === requestedItem)) {
        menuSelect.value = requestedItem;
        updateTotal();
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
    orderTable.hidden = !showTable;
    orderTableLabel.hidden = !showTable;
    orderTable.required = showTable;
    orderMessage.textContent = showTable && !orderTable.options.length
        ? 'No tables are available for dine-in right now.'
        : `${orderType.options[orderType.selectedIndex].text} selected. Our team will confirm your order before you choose a payment method.`;
});

confirmPaymentBtn?.addEventListener('click', async () => {
    if (!customerName.reportValidity() || !customerPhone.reportValidity()) return;

    const selectedItem = menuSelect.value;
    const quantity = Math.max(1, Number(quantityInput.value) || 1);
    const price = getSelectedPrice();
    const total = price * quantity;
    const customer = customerName.value.trim() || 'Customer';
    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.textContent = 'Submitting…';
    try {
        const response = await fetch('api.php?action=create_order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                customer_name: customer,
                customer_phone: customerPhone.value.trim(),
                item_name: selectedItem,
                quantity,
                order_type: orderType.value,
                table_number: orderType.value === 'dine-in' ? orderTable.value : '',
                notes: orderNotes.value.trim()
            })
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
        closePaymentModal();
        orderConfirmation.hidden = false;
        closeOrderConfirmation.focus();
        customerName.value = '';
        customerPhone.value = '';
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
            awaiting_verification: 'Your order is being reviewed. Our team will contact you manually to confirm it. Payment selection will become available after confirmation.',
            verified: hasPaymentPreference
                ? `Your order is confirmed. Your preferred method is ${order.payment_method}. Staff will verify payment after receiving it.`
                : 'Your order is confirmed. Choose your preferred payment method below. Staff will verify payment after receiving it.',
            preparing: hasPaymentPreference
                ? `Your order is being prepared. Your preferred method is ${order.payment_method}; staff will verify payment after receiving it.`
                : 'Your order is being prepared. Choose your preferred payment method below.',
            completed: 'This order is complete.',
            cancelled: 'This order was cancelled. Contact the restaurant if you need help.'
        };
        customerOrderStatus.textContent = statuses[order.status] || 'Order status updated. Contact the restaurant for assistance.';
        customerOrderSummary.hidden = false;
        document.getElementById('customerOrderItems').textContent = order.items.map((item) => `${item.item_name} × ${item.quantity}`).join(', ');
        document.getElementById('customerOrderTotal').textContent = formatKwacha(order.total_price);
        document.getElementById('customerOrderType').textContent = order.order_type.replace('-', ' ');
        document.getElementById('customerOrderMethod').textContent = order.payment_method === 'Awaiting customer choice' ? 'Not selected yet' : order.payment_method;
        customerPaymentChoice.hidden = !order.can_choose_payment;
        if (order.can_choose_payment && Array.from(customerPaymentMethod.options).some((option) => option.value === order.payment_method)) {
            customerPaymentMethod.value = order.payment_method;
        }
        if (order.status === 'awaiting_verification') {
            customerOrderRefreshTimer = setTimeout(loadCustomerOrder, 15000);
        }
    } catch (error) {
        customerOrderStatus.textContent = error.message;
        customerOrderSummary.hidden = true;
        customerPaymentChoice.hidden = true;
    }
}

if (customerOrderPage && customerOrderId && /^\d+$/.test(customerOrderId) && /^[a-f0-9]{64}$/.test(customerOrderToken || '')) {
    document.querySelector('.topbar').hidden = true;
    document.querySelector('body > main:not(#customerOrderPage)').hidden = true;
    document.querySelector('.site-footer').hidden = true;
    customerOrderPage.hidden = false;
    customerOrderNumber.textContent = `#${customerOrderId}`;
    document.getElementById('refreshCustomerOrder').addEventListener('click', loadCustomerOrder);
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
            const response = await fetch('api.php?action=create_reservation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify(fields)
            });
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

updateTotal();
