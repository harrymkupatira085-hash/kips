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
                    <button id="authSubmit" class="app-primary" type="submit">Log in</button>
                </form>
                <p id="authMessage" class="app-message" role="status" aria-live="polite"></p>
                <a class="auth-home-link" href="index.php">← Back to restaurant</a>
            </div>
            <span class="auth-footnote">Authorized team members only · KIPS</span>
        </div>
    </section>

    <div id="appShell" class="app-shell" hidden>
        <aside class="app-sidebar" id="appSidebar">
            <a class="app-brand" href="admin.php"><span class="brand-mark" id="brandMark">K</span><span><span id="brandName">KIPS</span><span class="brand-light"> / OPS</span></span></a>
            <div class="sidebar-restaurant"><span class="restaurant-avatar" id="sidebarAvatar">K</span><span><strong id="sidebarRestaurantName">KIPS Restaurant</strong><small>Restaurant operations</small></span><span class="online-dot"></span></div>
            <nav class="side-nav" aria-label="Restaurant management">
                <span class="side-label">WORKSPACE</span>
                <button class="side-link active" data-view="dashboard"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/></svg></span>Overview</button>
                <button class="side-link" data-view="orders"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M8 3h8l4 4v14H4V3zM8 11h8M8 15h8M8 7h4"/></svg></span>Orders <span class="side-count" id="openOrderCount"></span></button>
                <button class="side-link" data-view="kitchen"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M4 21V11a8 8 0 0 1 16 0v10"/><path d="M2 21h20M8 21v-6h8v6M9 10h.01M12 8h.01M15 10h.01"/></svg></span>Kitchen display</button>
                <button class="side-link" data-view="menu"><span class="side-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span>Menu</button>
                <button class="side-link" data-view="reservations"><span class="side-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></svg></span>Reservations</button>
                <button class="side-link" data-view="tables"><span class="side-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="7" rx="2"/><path d="M5 11v9M19 11v9M9 15h6"/></svg></span>Tables</button>
                <span class="side-label">MANAGE</span>
                <button class="side-link" data-view="customers"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>Customers</button>
                <button class="side-link" data-view="inventory"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5M12 13v8"/></svg></span>Inventory</button>
                <button class="side-link" data-view="suppliers"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="17.5" cy="18" r="1.5"/></svg></span>Suppliers</button>
                <button class="side-link" data-view="expenses"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span>Expenses</button>
                <button class="side-link" data-view="employees"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 8v6M17 11h6"/></svg></span>Team</button>
                <button class="side-link" data-view="payments"><span class="side-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/></svg></span>Payments</button>
                <button class="side-link" data-view="reports"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span>Reports</button>
                <button class="side-link" data-view="audit"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg></span>Activity log</button>
                <button class="side-link" data-view="settings"><span class="side-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></span>Settings</button>
            </nav>
            <div class="sidebar-bottom">
                <a class="side-link public-site-link" href="index.php"><span class="side-icon"><svg viewBox="0 0 24 24"><path d="M14 3h7v7M10 14 21 3"/><path d="M19 13v7H4V5h7"/></svg></span>View restaurant</a>
                <div class="staff-profile"><span class="staff-avatar" id="staffAvatar">K</span><span><strong id="staffName">Team member</strong><small id="staffRole">Staff</small></span><button id="changePasswordBtn" class="icon-button" type="button" aria-label="Change my password" title="Change my password"><svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/></svg></button><button id="logoutBtn" class="icon-button" type="button" aria-label="Sign out"><svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></svg></button></div>
            </div>
        </aside>

        <main class="app-main">
            <header class="app-topbar">
                <button id="mobileMenuBtn" class="icon-button mobile-menu-btn" type="button" aria-label="Open navigation"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
                <div class="breadcrumbs"><span id="topbarBrand">KIPS</span> <span>/</span> <strong id="breadcrumbTitle">Overview</strong></div>
                <div class="topbar-actions"><span class="live-status"><span></span>Live operations</span><button id="alertToggleBtn" class="topbar-refresh alert-toggle" type="button" aria-pressed="true" title="New-order alerts"><svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg><span id="alertToggleLabel">Alerts on</span></button><button id="refreshBtn" class="topbar-refresh" type="button"><svg viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2"/></svg><span>Refresh</span></button><button id="notificationBtn" class="icon-button notification-button" type="button" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span id="notificationDot"></span></button><span class="topbar-date" id="topbarDate"></span></div>
            </header>
            <section id="appContent" class="app-content" aria-live="polite"></section>
        </main>
    </div>
    <div id="appToast" class="app-toast" role="status" aria-live="polite"></div>
    <script src="admin.js?v=<?= (int) filemtime(__DIR__ . '/admin.js') ?>"></script>
</body>
</html>
