<?php
declare(strict_types=1);

function restaurant_config(string $key, string $default = ''): string
{
    static $localConfig = null;
    if ($localConfig === null) {
        $localConfig = [];
        $configFile = __DIR__ . DIRECTORY_SEPARATOR . 'config.local.php';
        if (is_file($configFile)) {
            $loaded = require $configFile;
            if (is_array($loaded)) {
                $localConfig = $loaded;
            }
        }
    }
    if (isset($localConfig[$key]) && is_scalar($localConfig[$key]) && (string) $localConfig[$key] !== '') {
        return (string) $localConfig[$key];
    }
    $env = getenv($key);
    return $env === false || $env === '' ? $default : (string) $env;
}

function restaurant_settings_defaults(): array
{
    return [
        'restaurant_name' => 'KIPS',
        'restaurant_tagline' => 'Fresh • Fast • Flavorful',
        'phone_display' => '0983 572 473',
        'whatsapp_number' => '265983572473',
        'country_code' => '265',
        'opening_hours' => '9:00 AM – 10:30 PM',
        'opening_note' => 'Open daily',
        'facebook_url' => 'https://www.facebook.com/search/top/?q=Reece%20Effects',
        'instagram_url' => 'https://www.instagram.com/mkupadoingthings/',
        'currency_symbol' => 'MK',
        'delivery_fee' => '0',
        'tax_rate' => '0'
    ];
}

function restaurant_settings(bool $refresh = false): array
{
    static $settings = null;
    if ($settings !== null && !$refresh) {
        return $settings;
    }
    $settings = restaurant_settings_defaults();
    $rows = restaurant_db()->query('SELECT setting_key, setting_value FROM restaurant_settings')->fetchAll();
    foreach ($rows as $row) {
        if (array_key_exists($row['setting_key'], $settings)) {
            $settings[$row['setting_key']] = (string) $row['setting_value'];
        }
    }
    return $settings;
}

function restaurant_settings_save(array $values): void
{
    $db = restaurant_db();
    $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $statement = $mysql
        ? $db->prepare('INSERT INTO restaurant_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)')
        : $db->prepare('INSERT INTO restaurant_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value');
    foreach ($values as $key => $value) {
        if (array_key_exists($key, restaurant_settings_defaults())) {
            $statement->execute([$key, (string) $value]);
        }
    }
}

function restaurant_menu_defaults(): array
{
    return [
        ['name' => 'Chips & Chicken', 'description' => 'Golden fries topped with juicy grilled chicken and signature sauce.', 'price' => 8900, 'thumb' => 'thumb-one'],
        ['name' => 'Chips & Beef', 'description' => 'Hearty portions of beef and crispy chips with a savory finish.', 'price' => 9600, 'thumb' => 'thumb-two'],
        ['name' => 'Nsima & Chicken', 'description' => 'Traditional comfort food with tender chicken and fresh relish.', 'price' => 10500, 'thumb' => 'thumb-three'],
        ['name' => 'Rice & Beef', 'description' => 'Comforting rice paired with rich beef stew and aromatic spice.', 'price' => 11800, 'thumb' => 'thumb-four'],
        ['name' => 'Cake', 'description' => 'A soft, sweet dessert to balance out your meal perfectly.', 'price' => 4200, 'thumb' => 'thumb-five']
    ];
}

function restaurant_data_directory(): string
{
    $documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__);
    $dataDirectory = restaurant_config('KIPS_DATA_DIR') ?: dirname($documentRoot) . DIRECTORY_SEPARATOR . 'kips-data';
    if (!is_dir($dataDirectory) && !mkdir($dataDirectory, 0700, true) && !is_dir($dataDirectory)) {
        throw new RuntimeException('The restaurant data directory could not be created.');
    }
    return $dataDirectory;
}

function restaurant_inventory_image_directory(): string
{
    $directory = restaurant_data_directory() . DIRECTORY_SEPARATOR . 'inventory-images';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('The inventory image directory could not be created.');
    }
    return $directory;
}

function restaurant_menu_image_directory(): string
{
    $directory = restaurant_data_directory() . DIRECTORY_SEPARATOR . 'menu-images';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('The menu image directory could not be created.');
    }
    return $directory;
}

function restaurant_db(): PDO
{
    static $db = null;
    if ($db instanceof PDO) {
        return $db;
    }

    $dsn = restaurant_config('KIPS_DB_DSN');
    $username = restaurant_config('KIPS_DB_USER');
    $password = restaurant_config('KIPS_DB_PASSWORD');
    $host = restaurant_config('KIPS_DB_HOST');

    $mysqlOptions = [];
    if ($dsn !== '' || $host !== '') {
        $mysqlOptions[PDO::ATTR_TIMEOUT] = 5;
        $ssl = strtolower(restaurant_config('KIPS_DB_SSL'));
        if ($ssl !== '' && !in_array($ssl, ['0', 'false', 'off', 'no'], true)) {
            $caPath = restaurant_config('KIPS_DB_SSL_CA');
            if ($caPath === '') {
                foreach (['/etc/ssl/certs/ca-certificates.crt', '/etc/pki/tls/certs/ca-bundle.crt'] as $candidate) {
                    if (is_file($candidate)) {
                        $caPath = $candidate;
                        break;
                    }
                }
            }
            if ($caPath !== '') {
                $mysqlOptions[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
            }
            $verify = strtolower(restaurant_config('KIPS_DB_SSL_VERIFY', '1'));
            $mysqlOptions[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = !in_array($verify, ['0', 'false', 'off', 'no'], true);
        }
    }

    $databaseError = null;
    if ($dsn || $host) {
        try {
            if ($dsn) {
                $db = new PDO($dsn, $username, $password, $mysqlOptions);
            } else {
                $port = restaurant_config('KIPS_DB_PORT', '3306');
                $database = restaurant_config('KIPS_DB_NAME', 'kips_restaurant');
                $db = new PDO("mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4", $username, $password, $mysqlOptions);
            }
        } catch (PDOException $exception) {
            $databaseError = $exception->getMessage();
        }
    }

    if (!($db instanceof PDO)) {
        $documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__);
        $dataDirectory = restaurant_config('KIPS_DATA_DIR') ?: dirname($documentRoot) . DIRECTORY_SEPARATOR . 'kips-data';
        if (!is_dir($dataDirectory) && !mkdir($dataDirectory, 0700, true) && !is_dir($dataDirectory)) {
            throw new RuntimeException('The restaurant data directory could not be created.');
        }
        $db = new PDO('sqlite:' . $dataDirectory . DIRECTORY_SEPARATOR . 'restaurant.sqlite');
        if ($databaseError !== null) {
            error_log('KIPS: database connection failed, using local storage: ' . $databaseError);
        }
    }

    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $mysql = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    if (!$mysql) {
        $db->exec('PRAGMA foreign_keys = ON');
        $id = 'INTEGER PRIMARY KEY AUTOINCREMENT';
        $text = 'TEXT';
        $integer = 'INTEGER';
        $timestamp = 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP';
    } else {
        $id = 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
        $text = 'VARCHAR(255)';
        $integer = 'BIGINT';
        $timestamp = 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP';
    }
    $engine = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $db->exec("CREATE TABLE IF NOT EXISTS restaurant_schema_version (version INTEGER PRIMARY KEY){$engine}");
    if ((int) $db->query('SELECT COALESCE(MAX(version), 0) FROM restaurant_schema_version')->fetchColumn() >= 9) {
        return $db;
    }

    $tables = [
        "CREATE TABLE IF NOT EXISTS admins (
            id {$id}, username VARCHAR(50) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(100) NOT NULL DEFAULT '', role VARCHAR(30) NOT NULL DEFAULT 'administrator',
            active {$integer} NOT NULL DEFAULT 1, created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS menu_items (
            id {$id}, name VARCHAR(100) NOT NULL UNIQUE, description TEXT NOT NULL, price {$integer} NOT NULL,
            thumb VARCHAR(30) NOT NULL DEFAULT 'thumb-one', available {$integer} NOT NULL DEFAULT 1,
            category VARCHAR(60) NOT NULL DEFAULT 'Mains', image_url VARCHAR(500) NOT NULL DEFAULT '',
            image_path VARCHAR(80) NOT NULL DEFAULT ''
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS orders (
            id {$id}, customer_name VARCHAR(100) NOT NULL, customer_phone VARCHAR(30) NOT NULL,
            item_name VARCHAR(100) NOT NULL, quantity {$integer} NOT NULL, unit_price {$integer} NOT NULL,
            subtotal {$integer} NOT NULL DEFAULT 0, delivery_fee {$integer} NOT NULL DEFAULT 0,
            tax_amount {$integer} NOT NULL DEFAULT 0, discount {$integer} NOT NULL DEFAULT 0,
            total_price {$integer} NOT NULL, payment_method VARCHAR(50) NOT NULL,
            customer_token_hash CHAR(64) NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'awaiting_verification', queue_position {$integer} NULL,
            order_type VARCHAR(30) NOT NULL DEFAULT 'delivery', table_number VARCHAR(20) NOT NULL DEFAULT '',
            customer_id {$integer} NULL, delivery_address VARCHAR(500) NOT NULL DEFAULT '',
            delivery_lat DECIMAL(10,7) NULL, delivery_lng DECIMAL(10,7) NULL,
            delivery_confirmed {$integer} NOT NULL DEFAULT 0, staff_reply VARCHAR(500) NOT NULL DEFAULT '',
            notes VARCHAR(2000) NOT NULL DEFAULT '', created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS order_items (
            id {$id}, order_id {$integer} NOT NULL, menu_item_id {$integer} NULL,
            item_name VARCHAR(100) NOT NULL, quantity {$integer} NOT NULL,
            unit_price {$integer} NOT NULL, line_total {$integer} NOT NULL
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS customers (
            id {$id}, name VARCHAR(100) NOT NULL, phone VARCHAR(30) NOT NULL UNIQUE,
            email VARCHAR(190) NOT NULL DEFAULT '', loyalty_points {$integer} NOT NULL DEFAULT 0,
            created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS reservations (
            id {$id}, customer_name VARCHAR(100) NOT NULL, customer_phone VARCHAR(30) NOT NULL,
            customer_email VARCHAR(190) NOT NULL DEFAULT '', party_size {$integer} NOT NULL,
            reservation_at VARCHAR(30) NOT NULL, table_number VARCHAR(20) NOT NULL DEFAULT '',
            notes VARCHAR(2000) NOT NULL DEFAULT '', status VARCHAR(30) NOT NULL DEFAULT 'pending', created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS suppliers (
            id {$id}, name VARCHAR(100) NOT NULL, contact_name VARCHAR(100) NOT NULL DEFAULT '',
            phone VARCHAR(30) NOT NULL DEFAULT '', email VARCHAR(190) NOT NULL DEFAULT '',
            address VARCHAR(2000) NOT NULL DEFAULT '', created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS ingredients (
            id {$id}, name VARCHAR(100) NOT NULL UNIQUE, unit VARCHAR(30) NOT NULL,
            stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0, reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0,
            unit_cost {$integer} NOT NULL DEFAULT 0, supplier_id {$integer} NULL,
            image_path VARCHAR(80) NOT NULL DEFAULT '',
            updated_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS recipes (
            id {$id}, menu_item_id {$integer} NOT NULL, ingredient_id {$integer} NOT NULL,
            quantity DECIMAL(12,3) NOT NULL, UNIQUE (menu_item_id, ingredient_id)
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS inventory_movements (
            id {$id}, ingredient_id {$integer} NOT NULL, quantity_change DECIMAL(12,3) NOT NULL,
            reason VARCHAR(100) NOT NULL, reference_id {$integer} NULL, created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS payments (
            id {$id}, order_id {$integer} NOT NULL, amount {$integer} NOT NULL,
            method VARCHAR(50) NOT NULL, reference VARCHAR(100) NOT NULL DEFAULT '',
            status VARCHAR(30) NOT NULL DEFAULT 'completed', received_by {$integer} NULL,
            created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS expenses (
            id {$id}, description VARCHAR(190) NOT NULL, category VARCHAR(80) NOT NULL,
            amount {$integer} NOT NULL, expense_date VARCHAR(20) NOT NULL,
            supplier_id {$integer} NULL, notes VARCHAR(2000) NOT NULL DEFAULT '', created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS restaurant_tables (
            id {$id}, table_number VARCHAR(20) NOT NULL UNIQUE, capacity {$integer} NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'available'
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS audit_logs (
            id {$id}, actor_id {$integer} NULL, actor_name VARCHAR(100) NOT NULL,
            action VARCHAR(100) NOT NULL, entity VARCHAR(60) NOT NULL, entity_id {$integer} NULL,
            details VARCHAR(2000) NOT NULL DEFAULT '', created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS notifications (
            id {$id}, title VARCHAR(190) NOT NULL, message TEXT NOT NULL,
            level VARCHAR(20) NOT NULL DEFAULT 'info', read_at VARCHAR(30) NULL, created_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS auth_attempts (
            id {$id}, login_key CHAR(64) NOT NULL, attempted_at {$timestamp}
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS installation_settings (
            setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(50) NOT NULL
        ){$engine}",
        "CREATE TABLE IF NOT EXISTS restaurant_settings (
            setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(1000) NOT NULL
        ){$engine}"
    ];
    foreach ($tables as $sql) {
        $db->exec($sql);
    }

    $ensureColumn = static function (string $table, string $column, string $definition) use ($db, $mysql): void {
        if ($mysql) {
            $statement = $db->prepare('SHOW COLUMNS FROM `' . $table . '` LIKE ?');
            $statement->execute([$column]);
            $exists = (bool) $statement->fetch();
        } else {
            $columns = $db->query('PRAGMA table_info("' . $table . '")')->fetchAll();
            $exists = in_array($column, array_column($columns, 'name'), true);
        }
        if (!$exists) {
            $db->exec('ALTER TABLE `' . $table . '` ADD COLUMN `' . $column . '` ' . $definition);
        }
    };
    $ensureColumn('admins', 'name', "VARCHAR(100) NOT NULL DEFAULT ''");
    $ensureColumn('admins', 'role', "VARCHAR(30) NOT NULL DEFAULT 'administrator'");
    $ensureColumn('admins', 'active', 'INTEGER NOT NULL DEFAULT 1');
    $ensureColumn('menu_items', 'category', "VARCHAR(60) NOT NULL DEFAULT 'Mains'");
    $ensureColumn('menu_items', 'image_url', "VARCHAR(500) NOT NULL DEFAULT ''");
    $ensureColumn('menu_items', 'image_path', "VARCHAR(80) NOT NULL DEFAULT ''");
    $ensureColumn('orders', 'order_type', "VARCHAR(30) NOT NULL DEFAULT 'delivery'");
    $ensureColumn('orders', 'table_number', "VARCHAR(20) NOT NULL DEFAULT ''");
    $ensureColumn('orders', 'customer_id', 'INTEGER NULL');
    $ensureColumn('orders', 'delivery_address', "VARCHAR(500) NOT NULL DEFAULT ''");
    $ensureColumn('orders', 'delivery_lat', 'DECIMAL(10,7) NULL');
    $ensureColumn('orders', 'delivery_lng', 'DECIMAL(10,7) NULL');
    $ensureColumn('orders', 'delivery_confirmed', 'INTEGER NOT NULL DEFAULT 0');
    $ensureColumn('orders', 'staff_reply', "VARCHAR(500) NOT NULL DEFAULT ''");
    $ensureColumn('orders', 'notes', "VARCHAR(2000) NOT NULL DEFAULT ''");
    $ensureColumn('orders', 'customer_token_hash', 'CHAR(64) NULL');
    $ensureColumn('orders', 'subtotal', 'INTEGER NOT NULL DEFAULT 0');
    $ensureColumn('orders', 'delivery_fee', 'INTEGER NOT NULL DEFAULT 0');
    $ensureColumn('orders', 'tax_amount', 'INTEGER NOT NULL DEFAULT 0');
    $ensureColumn('orders', 'discount', 'INTEGER NOT NULL DEFAULT 0');
    $ensureColumn('ingredients', 'image_path', "VARCHAR(80) NOT NULL DEFAULT ''");
    $db->exec('UPDATE orders SET subtotal = total_price WHERE subtotal = 0 AND total_price > 0');
    $indexes = [
        ['orders', 'orders_queue_idx', 'status, queue_position, id'],
        ['orders', 'orders_created_idx', 'created_at, status'],
        ['payments', 'payments_created_idx', 'created_at, status'],
        ['order_items', 'order_items_order_idx', 'order_id'],
        ['reservations', 'reservations_time_idx', 'reservation_at, status'],
        ['inventory_movements', 'inventory_ingredient_time_idx', 'ingredient_id, created_at'],
        ['auth_attempts', 'auth_attempts_key_time_idx', 'login_key, attempted_at']
    ];
    foreach ($indexes as [$table, $indexName, $columns]) {
        if ($mysql) {
            $indexQuery = $db->prepare('SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?');
            $indexQuery->execute([$table, $indexName]);
            $exists = (int) $indexQuery->fetchColumn() > 0;
        } else {
            $exists = false;
            foreach ($db->query('PRAGMA index_list("' . $table . '")')->fetchAll() as $index) {
                if ($index['name'] === $indexName) {
                    $exists = true;
                    break;
                }
            }
        }
        if (!$exists) {
            $db->exec('CREATE INDEX `' . $indexName . '` ON `' . $table . '` (' . $columns . ')');
        }
    }

    $initialSetupState = (int) $db->query('SELECT COUNT(*) FROM admins')->fetchColumn() > 0 ? 'complete' : 'pending';
    if ($mysql) {
        $setting = $db->prepare('INSERT IGNORE INTO installation_settings (setting_key, setting_value) VALUES (?, ?)');
    } else {
        $setting = $db->prepare('INSERT OR IGNORE INTO installation_settings (setting_key, setting_value) VALUES (?, ?)');
    }
    $setting->execute(['admin_setup', $initialSetupState]);

    $count = (int) $db->query('SELECT COUNT(*) FROM menu_items')->fetchColumn();
    if ($count === 0) {
        $insert = $db->prepare('INSERT INTO menu_items (name, description, price, thumb, category) VALUES (?, ?, ?, ?, ?)');
        foreach (restaurant_menu_defaults() as $item) {
            $insert->execute([$item['name'], $item['description'], $item['price'], $item['thumb'], 'Mains']);
        }
    }
    if ((int) $db->query('SELECT COUNT(*) FROM restaurant_tables')->fetchColumn() === 0) {
        $insert = $db->prepare('INSERT INTO restaurant_tables (table_number, capacity) VALUES (?, ?)');
        foreach (range(1, 12) as $number) {
            $insert->execute(['T' . $number, $number <= 4 ? 2 : 4]);
        }
    }
    $db->exec('INSERT INTO restaurant_schema_version (version) VALUES (9)');

    return $db;
}

function restaurant_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'httponly' => true,
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'),
        'samesite' => 'Lax'
    ]);
    session_start();
}

function restaurant_csrf_token(): string
{
    restaurant_start_session();
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function restaurant_menu_items(bool $availableOnly = false): array
{
    $sql = 'SELECT id, name, description, price, thumb, available, image_url, image_path, category FROM menu_items';
    if ($availableOnly) {
        $sql .= ' WHERE available = 1';
    }
    $sql .= ' ORDER BY id';
    return restaurant_db()->query($sql)->fetchAll();
}

function restaurant_admin_exists(): bool
{
    return restaurant_db()->query("SELECT setting_value FROM installation_settings WHERE setting_key = 'admin_setup'")->fetchColumn() === 'complete';
}

function restaurant_current_staff(): ?array
{
    restaurant_start_session();
    if (empty($_SESSION['admin_id'])) {
        return null;
    }
    $statement = restaurant_db()->prepare('SELECT id, username, name, role FROM admins WHERE id = ? AND active = 1');
    $statement->execute([$_SESSION['admin_id']]);
    $staff = $statement->fetch();
    if (!$staff) {
        $_SESSION = [];
        return null;
    }
    return $staff;
}

function restaurant_staff_can(string $permission): bool
{
    $staff = restaurant_current_staff();
    if (!$staff) {
        return false;
    }
    $permissions = [
        'administrator' => ['*', 'backup'],
        'manager' => ['dashboard', 'menu', 'orders', 'reservations', 'customers', 'inventory', 'suppliers', 'expenses', 'employees', 'payments', 'reports', 'tables', 'audit'],
        'waiter' => ['dashboard', 'orders', 'reservations', 'customers', 'tables'],
        'chef' => ['dashboard', 'orders', 'inventory'],
        'cashier' => ['dashboard', 'orders', 'payments', 'customers', 'reports']
    ];
    $rolePermissions = $permissions[$staff['role']] ?? [];
    return in_array('*', $rolePermissions, true) || in_array($permission, $rolePermissions, true);
}
