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

$paymentMethods = [
    ['name' => 'Cash', 'number' => 'Pay at the restaurant'],
    ['name' => 'Bank Card', 'number' => 'Visa or Mastercard'],
    ['name' => 'Airtel Money', 'number' => 'Mobile money'],
    ['name' => 'TNM Mpamba', 'number' => 'Mobile money'],
    ['name' => 'Bank Transfer', 'number' => 'Pay from your bank']
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars(restaurant_csrf_token(), ENT_QUOTES, 'UTF-8') ?>">
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
            <div class="brand" aria-label="KIPS Restaurant home">
                <span class="brand-mark">K</span>
                <span><?= htmlspecialchars($restaurantName) ?></span>
            </div>

            <nav class="main-nav" aria-label="Main navigation">
                <a href="#menu">Menu</a>
                <a href="#order">Order</a>
                <a href="#reserve">Reserve</a>
                <a href="#about">About</a>
            </nav>

            <div class="header-actions">
                <a href="#order" class="nav-button">Order now</a>
            </div>
        </div>
    </header>

    <main>
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
                        <a href="#menu" class="primary-btn">View menu</a>
                        <a href="#about" class="secondary-btn">Why choose us</a>
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

                    <div class="payment-section">
                        <p class="payment-heading">Choose payment method</p>
                        <div class="payment-grid">
                            <?php foreach ($paymentMethods as $method): ?>
                                <label class="payment-option">
                                    <input type="radio" name="paymentMethod" value="<?= htmlspecialchars($method['name']) ?>" <?= $method['name'] === 'Airtel Money' ? 'checked' : '' ?>>
                                    <span class="payment-brand payment-brand-<?= strtolower(str_replace(' ', '-', $method['name'])) ?>" aria-hidden="true">
                                        <?php if ($method['name'] === 'Bank Card'): ?>
                                            <svg class="card-network-logo" viewBox="0 0 94 32" role="img" aria-label="Visa and Mastercard">
                                                <circle cx="16" cy="16" r="13" fill="#eb001b"></circle>
                                                <circle cx="32" cy="16" r="13" fill="#f79e1b" fill-opacity=".92"></circle>
                                                <text x="49" y="21" fill="#1434cb" font-family="Arial,sans-serif" font-size="16" font-style="italic" font-weight="800">VISA</text>
                                            </svg>
                                        <?php elseif ($method['name'] === 'Airtel Money'): ?>
                                            <span class="airtel-wordmark"><i></i>airtel<span> money</span></span>
                                        <?php elseif ($method['name'] === 'TNM Mpamba'): ?>
                                            <span class="tnm-wordmark"><b>TNM</b><span>Mpamba</span></span>
                                        <?php elseif ($method['name'] === 'Cash'): ?>
                                            <svg viewBox="0 0 42 32" focusable="false">
                                                <rect x="2" y="4" width="38" height="24" rx="5" fill="#e2f2e7"></rect>
                                                <path d="M7 10c2.4 0 4-1.6 4-3h20c0 1.4 1.6 3 4 3v12c-2.4 0-4 1.6-4 3H11c0-1.4-1.6-3-4-3z" fill="none" stroke="#27834d" stroke-width="1.7"></path>
                                                <circle cx="21" cy="16" r="5" fill="#27834d"></circle>
                                                <text x="21" y="19" fill="#fff" font-family="Arial,sans-serif" font-size="8" font-weight="700" text-anchor="middle">MK</text>
                                            </svg>
                                        <?php else: ?>
                                            <svg viewBox="0 0 42 32" focusable="false">
                                                <path d="M4 12 21 3l17 9v3H4zm3 5h4v9H7zm8 0h4v9h-4zm8 0h4v9h-4zm8 0h4v9h-4zM4 28h34v2H4z" fill="#3471a5"></path>
                                            </svg>
                                        <?php endif; ?>
                                    </span>
                                    <span class="payment-copy">
                                        <strong><?= htmlspecialchars($method['name']) ?></strong>
                                        <small><?= htmlspecialchars($method['number']) ?></small>
                                    </span>
                                </label>
                            <?php endforeach; ?>
                        </div>
                    </div>

                    <button id="orderBtn" type="button" <?= !$menuItems ? 'disabled' : '' ?>>Place order</button>
                    <p id="orderMessage"><?= $menuItems ? 'Your food is ready to be ordered.' : 'No food is currently available to order.' ?></p>
                </div>
            </div>
        </section>

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
    </main>

    <div id="paymentModal" class="payment-modal" aria-hidden="true">
        <div class="payment-modal-content" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle">
            <button id="closeModal" class="modal-close" type="button" aria-label="Close payment modal">×</button>

            <p class="eyebrow">Complete payment</p>
            <h3 id="paymentModalTitle">Pay your bill</h3>

            <div class="modal-summary">
                <div>
                    <span>Order</span>
                    <strong id="modalOrderItem">Chips & Chicken</strong>
                </div>
                <div>
                    <span>Total</span>
                    <strong id="modalTotalPrice">MK 8,900</strong>
                </div>
                <div>
                    <span>Method</span>
                    <strong id="modalPaymentMethod">Airtel Money</strong>
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

            <button id="confirmPaymentBtn" type="button">Submit order</button>
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
                <div><span>Payment method</span><strong id="confirmationPayment"></strong></div>
                <div><span>Order type</span><strong id="confirmationType"></strong></div>
            </div>
            <p class="confirmation-note">Keep your order reference. This confirmation is shown on this page; no SMS is sent.</p>
            <button id="doneOrderConfirmation" class="primary-btn" type="button">Done</button>
        </section>
    </div>

    <footer class="site-footer">
        <div class="container">
            <div class="footer-inner">
                <p>© 2026 KIPS Restaurant</p>
                <p>Open daily • 9:00 AM - 10:30 PM • <a href="admin.php">Administrator</a></p>
            </div>
            <div class="footer-contact">
                <p>Find us for more information:</p>
                <a href="https://wa.me/265983572473" target="_blank" rel="noopener noreferrer">WhatsApp: 0983 572 473</a>
                <a href="https://www.facebook.com/search/top/?q=Reece%20Effects" target="_blank" rel="noopener noreferrer">Facebook: Reece Effects</a>
                <a href="https://www.instagram.com/mkupadoingthings/" target="_blank" rel="noopener noreferrer">Instagram: Mkupadoingthings</a>
            </div>
        </div>
    </footer>

    <script src="script.js?v=<?= (int) filemtime(__DIR__ . '/script.js') ?>"></script>
</body>
</html>
