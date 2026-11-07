<?php
require_once __DIR__ . '/storage.php';
$menuItems = restaurant_menu_items(true);
$restaurantName = 'KIPS';
$availableTables = restaurant_db()->query("SELECT table_number, capacity FROM restaurant_tables WHERE status = 'available' ORDER BY id")->fetchAll();
$restaurantStats = [
    ['value' => number_format((int) restaurant_db()->query('SELECT COUNT(*) FROM customers')->fetchColumn()), 'label' => 'Registered guests'],
    ['value' => number_format((int) restaurant_db()->query("SELECT COUNT(*) FROM orders WHERE status = 'completed'")->fetchColumn()), 'label' => 'Orders completed'],
    ['value' => number_format(count($menuItems)), 'label' => 'Meals on our menu']
];

$features = [
    ['number' => '01', 'title' => 'Kitchen fresh', 'text' => 'Every order is prepared with fresh ingredients and careful attention.'],
    ['number' => '02', 'title' => 'Fast delivery', 'text' => 'We move quickly so your meal arrives hot and ready to enjoy.'],
    ['number' => '03', 'title' => 'Family favorites', 'text' => 'From quick bites to hearty plates, we serve meals everyone loves.']
];

$page = $_GET['page'] ?? 'home';
$validPages = ['home', 'menu', 'order', 'reserve', 'about'];
if (!is_string($page) || !in_array($page, $validPages, true)) {
    $page = 'home';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars(restaurant_csrf_token(), ENT_QUOTES, 'UTF-8') ?>">
    <meta name="referrer" content="no-referrer">
    <title>KIPS RESTAURANT</title>
    <meta name="description" content="Fresh, tasty meals and fast delivery from KIPS Restaurant.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css?v=<?= (int) filemtime(__DIR__ . '/style.css') ?>">
</head>
<body>
    <header class="topbar">
        <div class="container nav">
            <button class="mobile-nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="main-nav">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>
            </button>
            <a class="brand" href="index.php" aria-label="KIPS Restaurant home">
                <span class="brand-mark">K</span>
                <span><?= htmlspecialchars($restaurantName) ?></span>
            </a>

            <nav class="main-nav" id="main-nav" aria-label="Main navigation">
                <a href="index.php?page=menu" <?= $page === 'menu' ? 'aria-current="page"' : '' ?>>Menu</a>
                <a href="index.php?page=reserve" <?= $page === 'reserve' ? 'aria-current="page"' : '' ?>>Reserve</a>
                <a href="index.php?page=about" <?= $page === 'about' ? 'aria-current="page"' : '' ?>>About</a>
            </nav>

            <div class="header-actions">
                <a href="index.php?page=order" class="nav-button">Order now</a>
            </div>
        </div>
    </header>

    <main>
        <?php if ($page === 'home'): ?>
        <section class="hero">
            <div class="container hero-inner">
                <div class="hero-copy">
                    <p class="eyebrow">Fresh • Fast • Flavorful</p>
                    <h1>Enjoy delicious meals made for every craving.</h1>
                    <p class="lead">
                        From crispy chicken to comforting rice bowls, KIPS serves hot meals with quick delivery
                        and warm hospitality.
                    </p>

                    <div class="cta-row">
                        <a href="index.php?page=menu" class="primary-btn">View menu</a>
                        <a href="index.php?page=about" class="secondary-btn">Why choose us</a>
                    </div>

                    <div class="stats-row">
                        <?php foreach ($restaurantStats as $stat): ?>
                            <div>
                                <strong><?= htmlspecialchars($stat['value']) ?></strong>
                                <span><?= htmlspecialchars($stat['label']) ?></span>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="hero-visual" aria-label="Featured dishes illustration">
                    <div class="dish-card large-card">
                        <div class="dish-image dish-one"></div>
                        <div class="dish-info">
                            <h3><?= htmlspecialchars($menuItems[0]['name'] ?? 'Fresh from our kitchen') ?></h3>
                            <p><?= htmlspecialchars($menuItems[0]['description'] ?? 'Explore our menu for today’s selection.') ?></p>
                            <?php if ($menuItems): ?><span>MK <?= number_format((float) $menuItems[0]['price'], 0) ?></span><?php endif; ?>
                        </div>
                    </div>

                    <div class="floating-badge">
                        <span class="badge-icon">★</span>
                        <div>
                            <strong>Top pick</strong>
                            <small>Chef special</small>
                        </div>
                    </div>
                </div>
            </div>
        </section>
        <?php endif; ?>

        <?php if ($page === 'menu'): ?>
        <section id="menu" class="menu-section">
            <div class="container">
                <div class="section-heading">
                    <p class="eyebrow">Our menu</p>
                    <h2>Made fresh for your appetite</h2>
                </div>

                <div class="menu-grid">
                    <?php foreach ($menuItems as $index => $item): ?>
                        <article class="menu-card <?= $index === 0 ? 'active' : '' ?>">
                            <div class="menu-thumb <?= htmlspecialchars($item['thumb']) ?>">
                                <?php if (!empty($item['image_path'])): ?>
                                    <img src="api.php?action=menu_image&amp;id=<?= (int) $item['id'] ?>&amp;v=<?= rawurlencode($item['image_path']) ?>" alt="<?= htmlspecialchars($item['name']) ?>" loading="lazy">
                                <?php elseif (!empty($item['image_url'])): ?>
                                    <img src="<?= htmlspecialchars($item['image_url'], ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($item['name']) ?>" loading="lazy">
                                <?php endif; ?>
                            </div>
                            <div class="menu-content">
                                <h3><?= htmlspecialchars($item['name']) ?></h3>
                                <p><?= htmlspecialchars($item['description']) ?></p>
                                <div class="menu-meta">
                                    <span>MK <?= number_format((float) $item['price'], 0) ?></span>
                                    <button class="add-btn" data-item="<?= htmlspecialchars($item['name']) ?>" data-price="<?= number_format((float) $item['price'], 0) ?>">Add</button>
                                </div>
                            </div>
                        </article>
                    <?php endforeach; ?>
                    <?php if (!$menuItems): ?>
                        <p class="admin-muted">Our menu is being updated. Please check back soon.</p>
                    <?php endif; ?>
                </div>
            </div>
        </section>
        <?php endif; ?>

        <?php if ($page === 'order'): ?>
        <section id="order" class="order-section">
            <div class="container order-wrap">
                <div class="order-card">
                    <p class="eyebrow">Quick order</p>
                    <h2>Build your meal</h2>

                    <label for="menuSelect">Choose a meal</label>
                    <select id="menuSelect" name="menu">
                        <?php foreach ($menuItems as $item): ?>
                            <option value="<?= htmlspecialchars($item['name']) ?>" data-price="<?= (int) $item['price'] ?>"><?= htmlspecialchars($item['name']) ?></option>
                        <?php endforeach; ?>
                    </select>

                    <label for="quantity">Quantity</label>
                    <input id="quantity" type="number" min="1" max="50" value="1" />

                    <div class="total-row">
                        <span>Total</span>
                        <strong id="totalPrice">MK <?= $menuItems ? number_format((float) $menuItems[0]['price'], 0) : '0' ?></strong>
                    </div>

                    <p class="payment-choice-note">Choose your payment method after our team confirms your order.</p>

                    <button id="orderBtn" type="button" <?= !$menuItems ? 'disabled' : '' ?>>Place order</button>
                    <p id="orderMessage"><?= $menuItems ? 'Your food is ready to be ordered.' : 'No food is currently available to order.' ?></p>
                </div>
            </div>
        </section>
        <?php endif; ?>

        <?php if ($page === 'reserve'): ?>
        <section id="reserve" class="reservation-section">
            <div class="container reservation-wrap">
                <div class="reservation-intro">
                    <p class="eyebrow">A place at our table</p>
                    <h2>Make room for a good meal.</h2>
                    <p>Tell us when you’re coming and we’ll be in touch to confirm your table.</p>
                </div>
                <form id="reservationForm" class="reservation-form">
                    <label>Full name<input name="customer_name" maxlength="100" required></label>
                    <label>Phone number<input name="customer_phone" type="tel" maxlength="30" required placeholder="+265 …"></label>
                    <label>Email <span>(optional)</span><input name="customer_email" type="email" maxlength="190"></label>
                    <label>Guests<input name="party_size" type="number" min="1" max="30" value="2" required></label>
                    <label>Date &amp; time<input name="reservation_at" type="datetime-local" required></label>
                    <label>Notes <span>(optional)</span><input name="notes" maxlength="1000" placeholder="Occasion or seating requests"></label>
                    <button class="primary-btn" type="submit">Request a table</button>
                    <p id="reservationMessage" class="reservation-message" role="status" aria-live="polite"></p>
                </form>
            </div>
        </section>
        <?php endif; ?>

        <?php if ($page === 'about'): ?>
        <section id="about" class="about-section">
            <div class="container about-grid">
                <div>
                    <p class="eyebrow">Why KIPS</p>
                    <h2>Fresh ingredients. Honest flavor. Great service.</h2>
                </div>

                <div class="feature-list">
                    <?php foreach ($features as $feature): ?>
                        <div class="feature-item">
                            <span><?= htmlspecialchars($feature['number']) ?></span>
                            <div>
                                <h3><?= htmlspecialchars($feature['title']) ?></h3>
                                <p><?= htmlspecialchars($feature['text']) ?></p>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>
        <?php endif; ?>
    </main>

    <main id="customerOrderPage" hidden>
        <section class="order-section">
            <div class="container order-wrap">
                <div class="order-card customer-order-card">
                    <p class="eyebrow">PRIVATE ORDER LINK</p>
                    <h1>Order <span id="customerOrderNumber"></span></h1>
                    <p id="customerOrderStatus" role="status" aria-live="polite">Loading your order…</p>
                    <div id="customerOrderSummary" class="customer-order-summary" hidden>
                        <div><span>Items</span><strong id="customerOrderItems"></strong></div>
                        <div><span>Total</span><strong id="customerOrderTotal"></strong></div>
                        <div><span>Order type</span><strong id="customerOrderType"></strong></div>
                        <div><span>Payment preference</span><strong id="customerOrderMethod"></strong></div>
                    </div>
                    <div id="customerPaymentChoice" class="customer-payment-choice" hidden>
                        <label for="customerPaymentMethod">Choose your preferred payment method</label>
                        <select id="customerPaymentMethod">
                            <option>Cash</option>
                            <option>Bank Card</option>
                            <option>Airtel Money</option>
                            <option>TNM Mpamba</option>
                            <option>Bank Transfer</option>
                        </select>
                        <button id="saveCustomerPayment" type="button" class="primary-btn">Save payment preference</button>
                        <p>Saving a preference does not send money. Staff will confirm payment after receiving it.</p>
                    </div>
                    <button id="refreshCustomerOrder" type="button" class="secondary-btn">Refresh order status</button>
                    <p><a href="index.php">Return to KIPS Restaurant</a></p>
                </div>
            </div>
        </section>
    </main>

    <div id="paymentModal" class="payment-modal" aria-hidden="true">
        <div class="payment-modal-content" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle">
            <button id="closeModal" class="modal-close" type="button" aria-label="Close payment modal">×</button>

            <p class="eyebrow">Place your order</p>
            <h3 id="paymentModalTitle">Your order</h3>

            <div class="modal-summary">
                <div>
                    <span>Order</span>
                    <strong id="modalOrderItem">Chips & Chicken</strong>
                </div>
                <div>
                    <span>Total</span>
                    <strong id="modalTotalPrice">MK 8,900</strong>
                </div>
            </div>

            <label for="customerName">Customer name</label>
            <input id="customerName" type="text" placeholder="Enter your full name" maxlength="100" required />

            <label for="customerPhone">Phone number</label>
            <input id="customerPhone" type="tel" placeholder="e.g. +265 991 234 567" maxlength="30" required />

            <label for="orderType">Order type</label>
            <select id="orderType">
                <option value="delivery">Delivery</option>
                <option value="takeaway">Takeaway</option>
                <option value="dine-in">Dine-in</option>
            </select>

            <label for="orderTable" id="orderTableLabel" hidden>Available table</label>
            <select id="orderTable" hidden>
                <?php foreach ($availableTables as $table): ?>
                    <option value="<?= htmlspecialchars($table['table_number']) ?>"><?= htmlspecialchars($table['table_number']) ?> · <?= (int) $table['capacity'] ?> seats</option>
                <?php endforeach; ?>
            </select>
            <label for="orderNotes">Order notes <span>(optional)</span></label>
            <input id="orderNotes" type="text" maxlength="1000" placeholder="Delivery directions or preferences">

            <button id="confirmPaymentBtn" type="button">Send order request</button>
        </div>
    </div>

    <div id="orderConfirmation" class="order-confirmation" hidden>
        <section class="order-confirmation-card" role="dialog" aria-modal="true" aria-labelledby="orderConfirmationTitle" aria-describedby="orderConfirmationMessage">
            <button id="closeOrderConfirmation" class="modal-close" type="button" aria-label="Close order confirmation">×</button>
            <span class="confirmation-check" aria-hidden="true">✓</span>
            <p class="eyebrow">ORDER RECEIVED</p>
            <h2 id="orderConfirmationTitle">Thank you for your order</h2>
            <p id="orderConfirmationMessage" role="status" aria-live="polite"></p>
            <div class="confirmation-summary">
                <div><span>Order reference</span><strong id="confirmationOrderId"></strong></div>
                <div><span>Total</span><strong id="confirmationTotal"></strong></div>
                <div><span>Next step</span><strong>Wait for staff confirmation</strong></div>
                <div><span>Order type</span><strong id="confirmationType"></strong></div>
            </div>
            <p id="confirmationOrderMessage" class="confirmation-note">Our team will contact you manually. After they confirm your order, open your private link to choose a payment method.</p>
            <a id="confirmationOrderLink" class="primary-btn confirmation-order-link" href="#">Open private order link</a>
            <button id="copyOrderLink" class="secondary-btn" type="button">Copy order link</button>
            <button id="doneOrderConfirmation" class="primary-btn" type="button">Done</button>
        </section>
    </div>

    <footer class="site-footer">
        <div class="container footer-container">
            <div class="footer-main">
                <section class="footer-brand" aria-label="About KIPS Restaurant">
                    <a class="brand footer-brand-link" href="index.php" aria-label="KIPS Restaurant home">
                        <span class="brand-mark">K</span>
                        <span>KIPS <small>RESTAURANT</small></span>
                    </a>
                    <p>Fresh, fast and flavorful meals, made with care and served with a smile.</p>
                </section>

                <section class="footer-hours" aria-labelledby="footerHoursTitle">
                    <h2 id="footerHoursTitle">Opening hours</h2>
                    <p>Open daily</p>
                    <strong>9:00 AM – 10:30 PM</strong>
                </section>

                <nav class="footer-contact" aria-label="Connect with KIPS Restaurant">
                    <h2>Stay connected</h2>
                    <a href="https://wa.me/265983572473" target="_blank" rel="noopener noreferrer">
                        <span class="footer-social-badge"><svg class="footer-social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.5-4.9a8.4 8.4 0 1 1 16-3.9Z"></path><path d="M8.8 8.2c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.8 1.8c.1.2.1.4 0 .5l-.5.7c-.2.2-.2.4 0 .6.5.8 1.2 1.5 2 2 .2.1.4.2.6 0l.7-.8c.2-.2.4-.2.6-.1l1.7.8c.3.1.4.3.4.5 0 .4-.2 1.1-.6 1.4-.4.4-1 .6-1.6.5-1-.1-2.3-.7-3.8-2-1.3-1.1-2.2-2.5-2.5-3.5-.3-.8 0-1.7.5-2.3Z"></path></svg></span>
                        <span><strong>WhatsApp</strong><small>0983 572 473</small></span>
                    </a>
                    <a href="https://www.facebook.com/search/top/?q=Reece%20Effects" target="_blank" rel="noopener noreferrer">
                        <span class="footer-social-badge"><svg class="footer-social-icon footer-facebook-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.3H7.7V13h2.7v8h3.1Z"></path></svg></span>
                        <span><strong>Facebook</strong><small>Follow our page</small></span>
                    </a>
                    <a href="https://www.instagram.com/mkupadoingthings/" target="_blank" rel="noopener noreferrer">
                        <span class="footer-social-badge"><svg class="footer-social-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle class="footer-instagram-dot" cx="17.7" cy="6.8" r="1"></circle></svg></span>
                        <span><strong>Instagram</strong><small>@mkupadoingthings</small></span>
                    </a>
                </nav>
            </div>
            <div class="footer-bottom">
                <p>© <?= date('Y') ?> KIPS Restaurant. All rights reserved.</p>
                <a href="admin.php">Administrator portal <span aria-hidden="true">→</span></a>
            </div>
        </div>
    </footer>

    <script src="script.js?v=<?= (int) filemtime(__DIR__ . '/script.js') ?>"></script>
</body>
</html>
