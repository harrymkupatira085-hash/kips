const menuSelect = document.getElementById('menuSelect');
const quantityInput = document.getElementById('quantity');
const totalPrice = document.getElementById('totalPrice');
const orderMessage = document.getElementById('orderMessage');
const orderButton = document.getElementById('orderBtn');
const menuCards = document.querySelectorAll('.menu-card');
const addButtons = document.querySelectorAll('.add-btn');
const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
const paymentModal = document.getElementById('paymentModal');
const closeModal = document.getElementById('closeModal');
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
const modalOrderItem = document.getElementById('modalOrderItem');
const modalTotalPrice = document.getElementById('modalTotalPrice');
const modalPaymentMethod = document.getElementById('modalPaymentMethod');
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

function getSelectedPaymentMethod() {
    return document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Airtel Money';
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
        modalPaymentMethod.textContent = getSelectedPaymentMethod();
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
    const selectedPayment = getSelectedPaymentMethod();
    orderMessage.textContent = `${menuSelect.value} selected. Ready to pay with ${selectedPayment}.`;
});

quantityInput?.addEventListener('input', updateTotal);

paymentOptions.forEach((radio) => {
    radio.addEventListener('change', () => {
        if (orderMessage) {
            orderMessage.textContent = `${menuSelect.value} selected. Ready to pay with ${radio.value}.`;
        }

        if (paymentModal && paymentModal.classList.contains('active')) {
            modalPaymentMethod.textContent = radio.value;
        }
    });
});

addButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const item = button.dataset.item;
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
    });
});

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
        : `${orderType.options[orderType.selectedIndex].text} selected.`;
});

confirmPaymentBtn?.addEventListener('click', async () => {
    if (!customerName.reportValidity() || !customerPhone.reportValidity()) return;

    const selectedItem = menuSelect.value;
    const quantity = Math.max(1, Number(quantityInput.value) || 1);
    const price = getSelectedPrice();
    const total = price * quantity;
    const selectedPayment = getSelectedPaymentMethod();
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
                payment_method: selectedPayment,
                order_type: orderType.value,
                table_number: orderType.value === 'dine-in' ? orderTable.value : '',
                notes: orderNotes.value.trim()
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not submit your order.');

        orderMessage.textContent = `Order #${result.order_id} received. It is waiting for the restaurant to verify payment.`;
        document.getElementById('confirmationOrderId').textContent = `#${result.order_id}`;
        document.getElementById('confirmationTotal').textContent = formatKwacha(result.total);
        document.getElementById('confirmationPayment').textContent = selectedPayment;
        document.getElementById('confirmationType').textContent = orderType.options[orderType.selectedIndex].text;
        document.getElementById('orderConfirmationTitle').textContent = `Thank you, ${customer}!`;
        document.getElementById('orderConfirmationMessage').textContent = `We received your order #${result.order_id}. The restaurant team must verify payment before preparation begins.`;
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
        confirmPaymentBtn.textContent = 'Submit order';
    }
});

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
