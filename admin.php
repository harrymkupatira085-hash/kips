<?php
require_once __DIR__ . '/storage.php';
restaurant_start_session();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars(restaurant_csrf_token(), ENT_QUOTES, 'UTF-8') ?>">
    <meta name="theme-color" content="#111827">
    <title>KIPS · Restaurant operations</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css?v=<?= (int) filemtime(__DIR__ . '/style.css') ?>">
</head>
<body class="restaurant-app">
    <section id="authPanel" class="auth-screen" hidden>
        <div class="auth-visual">
            <a class="app-brand auth-brand" href="index.php"><span class="brand-mark">K</span><span>KIPS<span class="brand-light"> / RESTAURANT</span></span></a>
            <div class="auth-story">
                <span class="app-eyebrow">Restaurant operations, simplified</span>
                <h1>Make every service a little more seamless.</h1>
                <p>One calm, connected workspace for your team, your kitchen and your guests.</p>
            </div>
            <div class="auth-photo" role="img" aria-label="Freshly prepared restaurant dishes"></div>
            <span class="auth-credit">Thoughtful food. Thoughtful service.</span>
        </div>
        <div class="auth-side">
            <div class="auth-card">
                <span class="app-eyebrow">Secure team access</span>
                <h2 id="authTitle">Welcome back</h2>
                <p id="authIntro" class="app-muted"></p>
                <form id="authForm">
                    <label for="authName" id="authNameLabel" hidden>Your name</label>
                    <input id="authName" name="name" autocomplete="name" maxlength="100" placeholder="Your name" hidden>
                    <label for="authUsername">Username</label>
                    <input id="authUsername" name="username" autocomplete="username" required maxlength="50" placeholder="Enter your username">
                    <label for="authPassword">Password</label>
                    <input id="authPassword" name="password" type="password" autocomplete="current-password" required minlength="1" maxlength="200" placeholder="Enter your password">
                    <button id="authSubmit" class="app-primary" type="submit">Sign in</button>
                </form>
                <p id="authMessage" class="app-message" role="status" aria-live="polite"></p>
                <a class="auth-home-link" href="index.php">← Back to restaurant</a>
            </div>
            <span class="auth-footnote">Authorized team members only · KIPS</span>
        </div>
    </section>

    <div id="appShell" class="app-shell" hidden>
        <aside class="app-sidebar" id="appSidebar">
            <a class="app-brand" href="admin.php"><span class="brand-mark">K</span><span>KIPS<span class="brand-light"> / OPS</span></span></a>
            <div class="sidebar-restaurant"><span class="restaurant-avatar">K</span><span><strong>KIPS Restaurant</strong><small>Malawi · Restaurant</small></span><span class="online-dot"></span></div>
            <nav class="side-nav" aria-label="Restaurant management">
                <span class="side-label">WORKSPACE</span>
                <button class="side-link active" data-view="dashboard"><span class="side-icon">⌂</span>Overview</button>
                <button class="side-link" data-view="orders"><span class="side-icon">▤</span>Orders <span class="side-count" id="openOrderCount"></span></button>
                <button class="side-link" data-view="menu"><span class="side-icon">◈</span>Menu</button>
                <button class="side-link" data-view="reservations"><span class="side-icon">▦</span>Reservations</button>
                <button class="side-link" data-view="tables"><span class="side-icon">▧</span>Tables</button>
                <span class="side-label">MANAGE</span>
                <button class="side-link" data-view="customers"><span class="side-icon">♙</span>Customers</button>
                <button class="side-link" data-view="inventory"><span class="side-icon">▣</span>Inventory</button>
                <button class="side-link" data-view="suppliers"><span class="side-icon">⇄</span>Suppliers</button>
                <button class="side-link" data-view="expenses"><span class="side-icon">↗</span>Expenses</button>
                <button class="side-link" data-view="employees"><span class="side-icon">♧</span>Team</button>
                <button class="side-link" data-view="payments"><span class="side-icon">◇</span>Payments</button>
                <button class="side-link" data-view="reports"><span class="side-icon">▥</span>Reports</button>
                <button class="side-link" data-view="audit"><span class="side-icon">◷</span>Activity log</button>
            </nav>
            <div class="sidebar-bottom">
                <a class="side-link public-site-link" href="index.php"><span class="side-icon">↗</span>View restaurant</a>
                <div class="staff-profile"><span class="staff-avatar" id="staffAvatar">K</span><span><strong id="staffName">Team member</strong><small id="staffRole">Staff</small></span><button id="logoutBtn" class="icon-button" type="button" aria-label="Sign out">↪</button></div>
            </div>
        </aside>

        <main class="app-main">
            <header class="app-topbar">
                <button id="mobileMenuBtn" class="icon-button mobile-menu-btn" type="button" aria-label="Open navigation">☰</button>
                <div class="breadcrumbs">KIPS <span>/</span> <strong id="breadcrumbTitle">Overview</strong></div>
                <div class="topbar-actions"><span class="live-status"><span></span>Live operations</span><button id="refreshBtn" class="topbar-refresh" type="button">↻ <span>Refresh</span></button><button id="notificationBtn" class="icon-button notification-button" type="button" aria-label="Notifications">♧<span id="notificationDot"></span></button><span class="topbar-date" id="topbarDate"></span></div>
            </header>
            <section id="appContent" class="app-content" aria-live="polite"></section>
        </main>
    </div>
    <div id="appToast" class="app-toast" role="status" aria-live="polite"></div>
    <script src="admin.js?v=<?= (int) filemtime(__DIR__ . '/admin.js') ?>"></script>
</body>
</html>
