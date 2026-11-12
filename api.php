<?php
declare(strict_types=1);

require_once __DIR__ . '/storage.php';
restaurant_start_session();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function api_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function api_input(): array
{
    if (str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data')) {
        return $_POST;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

function api_remove_inventory_image(string $filename): void
{
    if (preg_match('/\A[a-f0-9]{32}\.(?:jpg|png|webp)\z/', $filename)) {
        $path = restaurant_inventory_image_directory() . DIRECTORY_SEPARATOR . $filename;
        if (is_file($path) && !unlink($path)) {
            throw new RuntimeException('An old inventory image could not be removed.');
        }
    }
}

function api_remove_menu_image(string $filename): void
{
    if (preg_match('/\A[a-f0-9]{32}\.(?:jpg|png|webp)\z/', $filename)) {
        $path = restaurant_menu_image_directory() . DIRECTORY_SEPARATOR . $filename;
        if (is_file($path) && !unlink($path)) {
            throw new RuntimeException('An old menu image could not be removed.');
        }
    }
}

function api_store_uploaded_image(string $field, string $directory): string
{
    $upload = $_FILES[$field] ?? null;
    if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return '';
    }
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        $uploadErrors = [
            UPLOAD_ERR_INI_SIZE => 'The image is larger than the server upload limit.',
            UPLOAD_ERR_FORM_SIZE => 'The image is larger than the form upload limit.',
            UPLOAD_ERR_PARTIAL => 'The image upload was interrupted. Try again.',
            UPLOAD_ERR_NO_TMP_DIR => 'The server upload temporary folder is missing.',
            UPLOAD_ERR_CANT_WRITE => 'The server could not write the uploaded image.',
            UPLOAD_ERR_EXTENSION => 'A server extension stopped the image upload.'
        ];
        api_response(['error' => $uploadErrors[$upload['error']] ?? 'The image upload failed. Try another image.'], 422);
    }
    if (!isset($upload['tmp_name'], $upload['size']) || !is_string($upload['tmp_name']) || !is_int($upload['size']) || !is_uploaded_file($upload['tmp_name']) || $upload['size'] < 1 || $upload['size'] > 10 * 1024 * 1024) {
        api_response(['error' => 'Choose an image smaller than 10 MB.'], 422);
    }
    $fileInfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $fileInfo->file($upload['tmp_name']);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $dimensions = getimagesize($upload['tmp_name']);
    if (!is_string($mime) || !isset($extensions[$mime]) || $dimensions === false || $dimensions[0] > 5000 || $dimensions[1] > 5000 || ($dimensions['mime'] ?? '') !== $mime) {
        api_response(['error' => 'Use a valid JPEG, PNG or WebP image up to 5000 × 5000 pixels.'], 422);
    }
    $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($upload['tmp_name'], $directory . DIRECTORY_SEPARATOR . $filename)) {
        api_response(['error' => 'The uploaded image could not be saved. Check the server storage permissions.'], 500);
    }
    return $filename;
}

function api_require_admin(): void
{
    if (!restaurant_current_staff()) {
        api_response(['error' => 'Please sign in with an active staff account.'], 401);
    }
}

function api_require_permission(string $permission): void
{
    api_require_admin();
    if (!restaurant_staff_can($permission)) {
        api_response(['error' => 'Your staff role does not have permission for this action.'], 403);
    }
}

function api_require_csrf(array $input): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($input['csrf_token'] ?? '');
    if (!is_string($token) || !hash_equals(restaurant_csrf_token(), $token)) {
        api_response(['error' => 'Your session expired. Refresh the page and try again.'], 403);
    }
}

function api_require_administrator(): void
{
    api_require_admin();
    if (!restaurant_staff_can('settings')) {
        api_response(['error' => 'Only an administrator can change restaurant settings.'], 403);
    }
}

function api_send_csv(string $filename, array $headers, array $rows): never
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store');
    $output = fopen('php://output', 'w');
    fwrite($output, "\xEF\xBB\xBF");
    fputcsv($output, $headers);
    foreach ($rows as $row) {
        fputcsv($output, $row);
    }
    fclose($output);
    exit;
}

function api_clean_text($value, int $maxLength, string $label): string
{
    if (!is_string($value)) {
        api_response(['error' => $label . ' is required.'], 422);
    }
    $value = trim($value);
    if ($value === '' || mb_strlen($value) > $maxLength) {
        api_response(['error' => $label . ' must be between 1 and ' . $maxLength . ' characters.'], 422);
    }
    return $value;
}

function api_audit(string $action, string $entity, ?int $entityId, string $details = ''): void
{
    $staff = restaurant_current_staff();
    $statement = restaurant_db()->prepare(
        'INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $statement->execute([
        $staff['id'] ?? null,
        ($staff['name'] ?? '') ?: ($staff['username'] ?? 'Customer'),
        $action,
        $entity,
        $entityId,
        mb_substr($details, 0, 2000)
    ]);
}

function api_module_definition(string $resource): array
{
    $definitions = [
        'reservations' => ['permission' => 'reservations', 'table' => 'reservations', 'fields' => ['customer_name', 'customer_phone', 'customer_email', 'party_size', 'reservation_at', 'table_number', 'notes', 'status'], 'required' => ['customer_name', 'customer_phone', 'party_size', 'reservation_at']],
        'customers' => ['permission' => 'customers', 'table' => 'customers', 'fields' => ['name', 'phone', 'email', 'loyalty_points'], 'required' => ['name', 'phone']],
        'suppliers' => ['permission' => 'suppliers', 'table' => 'suppliers', 'fields' => ['name', 'contact_name', 'phone', 'email', 'address'], 'required' => ['name']],
        'ingredients' => ['permission' => 'inventory', 'table' => 'ingredients', 'fields' => ['name', 'unit', 'stock_quantity', 'reorder_level', 'unit_cost', 'supplier_id', 'image_path'], 'required' => ['name', 'unit']],
        'expenses' => ['permission' => 'expenses', 'table' => 'expenses', 'fields' => ['description', 'category', 'amount', 'expense_date', 'supplier_id', 'notes'], 'required' => ['description', 'category', 'amount', 'expense_date']],
        'tables' => ['permission' => 'tables', 'table' => 'restaurant_tables', 'fields' => ['table_number', 'capacity', 'status'], 'required' => ['table_number', 'capacity']],
        'employees' => ['permission' => 'employees', 'table' => 'admins', 'fields' => ['name', 'username', 'password', 'role', 'active'], 'required' => ['name', 'username', 'role']],
        'menu' => ['permission' => 'menu', 'table' => 'menu_items', 'fields' => ['name', 'description', 'price', 'thumb', 'available', 'category', 'image_url'], 'required' => ['name', 'description', 'price']],
        'payments' => ['permission' => 'payments', 'table' => 'payments', 'fields' => [], 'required' => []],
        'audit' => ['permission' => 'audit', 'table' => 'audit_logs', 'fields' => [], 'required' => []],
        'movements' => ['permission' => 'inventory', 'table' => 'inventory_movements', 'fields' => [], 'required' => []],
        'recipes' => ['permission' => 'inventory', 'table' => 'recipes', 'fields' => [], 'required' => []]
    ];
    if (!isset($definitions[$resource])) {
        api_response(['error' => 'Unknown management module.'], 404);
    }
    return $definitions[$resource];
}

try {
    $action = $_GET['action'] ?? '';
    $input = api_input();

    if ($action === 'menu_image' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            http_response_code(404);
            exit;
        }
        $imageQuery = restaurant_db()->prepare('SELECT image_path, available FROM menu_items WHERE id = ?');
        $imageQuery->execute([$id]);
        $item = $imageQuery->fetch();
        if (!$item || !preg_match('/\A[a-f0-9]{32}\.(?:jpg|png|webp)\z/', (string) $item['image_path'])) {
            http_response_code(404);
            exit;
        }
        if (!(int) $item['available']) {
            api_require_permission('menu');
        }
        $imagePath = restaurant_menu_image_directory() . DIRECTORY_SEPARATOR . $item['image_path'];
        $imageInfo = is_file($imagePath) ? getimagesize($imagePath) : false;
        if ($imageInfo === false || !in_array($imageInfo['mime'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
            http_response_code(404);
            exit;
        }
        header('Content-Type: ' . $imageInfo['mime']);
        header('Content-Length: ' . (string) filesize($imagePath));
        header('Cache-Control: public, max-age=3600');
        header('X-Content-Type-Options: nosniff');
        readfile($imagePath);
        exit;
    }

    if ($action === 'inventory_image' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        api_require_permission('inventory');
        $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            http_response_code(404);
            exit;
        }
        $imageQuery = restaurant_db()->prepare('SELECT image_path FROM ingredients WHERE id = ?');
        $imageQuery->execute([$id]);
        $filename = $imageQuery->fetchColumn();
        if (!is_string($filename) || !preg_match('/\A[a-f0-9]{32}\.(?:jpg|png|webp)\z/', $filename)) {
            http_response_code(404);
            exit;
        }
        $imagePath = restaurant_inventory_image_directory() . DIRECTORY_SEPARATOR . $filename;
        $imageInfo = is_file($imagePath) ? getimagesize($imagePath) : false;
        if ($imageInfo === false || !in_array($imageInfo['mime'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
            http_response_code(404);
            exit;
        }
        header('Content-Type: ' . $imageInfo['mime']);
        header('Content-Length: ' . (string) filesize($imagePath));
        header('Cache-Control: private, max-age=3600');
        header('X-Content-Type-Options: nosniff');
        readfile($imagePath);
        exit;
    }

    if ($action === 'status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $staff = restaurant_current_staff();
        api_response([
            'admin_exists' => restaurant_admin_exists(),
            'logged_in' => $staff !== null,
            'staff' => $staff,
            'storage' => restaurant_db()->getAttribute(PDO::ATTR_DRIVER_NAME),
            'db_configured' => restaurant_config('KIPS_DB_DSN') !== '' || restaurant_config('KIPS_DB_HOST') !== '',
            'csrf_token' => restaurant_csrf_token()
        ]);
    }

    if ($action === 'settings_get' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        api_require_administrator();
        api_response(['settings' => restaurant_settings(true)]);
    }

    if ($action === 'customer_order' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $orderId = filter_var($_GET['order'] ?? null, FILTER_VALIDATE_INT);
        $token = $_GET['token'] ?? '';
        if (!$orderId || !is_string($token) || !preg_match('/\A[a-f0-9]{64}\z/', $token)) {
            api_response(['error' => 'This order link is invalid.'], 404);
        }
        $statement = restaurant_db()->prepare(
            'SELECT id, subtotal, delivery_fee, tax_amount, discount, total_price, payment_method, status, order_type, delivery_address,
                    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = orders.id AND status = \'completed\') AS paid_amount
             FROM orders WHERE id = ? AND customer_token_hash = ?'
        );
        $statement->execute([$orderId, hash('sha256', $token)]);
        $order = $statement->fetch();
        if (!$order) {
            api_response(['error' => 'This order link is invalid or has expired.'], 404);
        }
        $items = restaurant_db()->prepare(
            'SELECT item_name, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id'
        );
        $items->execute([$orderId]);
        $order['items'] = $items->fetchAll();
        $order['can_choose_payment'] = in_array($order['status'], ['verified', 'preparing'], true)
            && (int) $order['paid_amount'] < (int) $order['total_price'];
        $order['can_cancel'] = $order['status'] === 'awaiting_verification';
        api_response(['order' => $order]);
    }

    if ($action === 'dashboard' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        api_require_permission('dashboard');
        $db = restaurant_db();
        $today = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? 'CURDATE()' : "DATE('now', 'localtime')";
        $chartStart = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
            ? 'DATE_SUB(CURDATE(), INTERVAL 29 DAY)'
            : "DATE('now', '-29 day', 'localtime')";
        $canViewReports = restaurant_staff_can('reports');
        $summary = [
            'sales_today' => $canViewReports
                ? (int) $db->query("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed' AND DATE(created_at) = {$today}")->fetchColumn()
                : null,
            'gross_volume' => $canViewReports
                ? (int) $db->query("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed'")->fetchColumn()
                : null,
            'completed_payments' => $canViewReports
                ? (int) $db->query("SELECT COUNT(*) FROM payments WHERE status = 'completed'")->fetchColumn()
                : null,
            'payments_by_method' => $canViewReports
                ? $db->query("SELECT method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM payments WHERE status = 'completed' GROUP BY method ORDER BY total DESC")->fetchAll()
                : [],
            'orders_today' => (int) $db->query("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = {$today}")->fetchColumn(),
            'open_orders' => (int) $db->query("SELECT COUNT(*) FROM orders WHERE status IN ('awaiting_verification', 'verified', 'preparing')")->fetchColumn(),
            'awaiting_orders' => (int) $db->query("SELECT COUNT(*) FROM orders WHERE status = 'awaiting_verification'")->fetchColumn(),
            'reservations_today' => (int) $db->query("SELECT COUNT(*) FROM reservations WHERE DATE(reservation_at) = {$today} AND status IN ('pending', 'confirmed')")->fetchColumn(),
            'low_stock' => (int) $db->query('SELECT COUNT(*) FROM ingredients WHERE stock_quantity <= reorder_level')->fetchColumn()
        ];
        $sales = $canViewReports ? $db->query(
            "SELECT DATE(created_at) AS day, COALESCE(SUM(amount), 0) AS total
             FROM payments WHERE status = 'completed' AND DATE(created_at) >= {$chartStart}
             GROUP BY DATE(created_at) ORDER BY DATE(created_at)"
        )->fetchAll() : [];
        $orders = $db->query(
            'SELECT id, customer_name, customer_phone, item_name, quantity, unit_price, subtotal, delivery_fee, tax_amount, discount, total_price,
                    payment_method, status, queue_position, order_type, table_number, delivery_address, notes, created_at,
                    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = orders.id AND status = \'completed\') AS paid_amount
             FROM orders
             ORDER BY CASE status WHEN \'awaiting_verification\' THEN 0 WHEN \'verified\' THEN 1 WHEN \'preparing\' THEN 2 ELSE 3 END,
                      CASE WHEN status IN (\'verified\', \'preparing\') THEN queue_position END,
                      id DESC LIMIT 100'
        )->fetchAll();
        $orderLines = $db->query('SELECT order_id, item_name, quantity, unit_price, line_total FROM order_items ORDER BY id')->fetchAll();
        $lineMap = [];
        foreach ($orderLines as $line) {
            $lineMap[$line['order_id']][] = $line;
        }
        foreach ($orders as &$order) {
            $order['lines'] = $lineMap[$order['id']] ?? [];
        }
        unset($order);
        $lowStock = $db->query(
            'SELECT i.id, i.name, i.unit, i.stock_quantity, i.reorder_level, s.name AS supplier_name
             FROM ingredients i LEFT JOIN suppliers s ON s.id = i.supplier_id
             WHERE i.stock_quantity <= i.reorder_level ORDER BY i.stock_quantity ASC LIMIT 8'
        )->fetchAll();
        $staff = restaurant_current_staff();
        $checklist = [];
        if (restaurant_staff_can('settings')) {
            $defaultNames = array_column(restaurant_menu_defaults(), 'name');
            $menuStatement = $db->prepare('SELECT COUNT(*) FROM menu_items WHERE name NOT IN (' . implode(',', array_fill(0, count($defaultNames), '?')) . ')');
            $menuStatement->execute($defaultNames);
            $checklist = [
                ['key' => 'profile', 'label' => 'Complete your restaurant profile', 'hint' => 'Set your hours, phone, delivery fee and tax.', 'done' => (int) $db->query('SELECT COUNT(*) FROM restaurant_settings')->fetchColumn() > 0, 'view' => 'settings'],
                ['key' => 'menu', 'label' => 'Make the menu yours', 'hint' => 'Replace the sample dishes with your real menu and photos.', 'done' => (int) $menuStatement->fetchColumn() > 0, 'view' => 'menu'],
                ['key' => 'team', 'label' => 'Add your team', 'hint' => 'Create individual accounts for waiters, chefs and cashiers.', 'done' => (int) $db->query('SELECT COUNT(*) FROM admins WHERE active = 1')->fetchColumn() > 1, 'view' => 'employees'],
                ['key' => 'order', 'label' => 'Take your first order', 'hint' => 'Place a test order from the customer menu, or open one at the counter.', 'done' => (int) $db->query('SELECT COUNT(*) FROM orders')->fetchColumn() > 0, 'view' => 'orders']
            ];
        }
        api_response([
            'staff' => $staff,
            'username' => $staff['username'],
            'summary' => $summary,
            'sales' => $sales,
            'orders' => $orders,
            'menu' => restaurant_menu_items(),
            'tables' => restaurant_staff_can('tables') ? $db->query('SELECT * FROM restaurant_tables ORDER BY id')->fetchAll() : [],
            'low_stock_items' => $lowStock,
            'notifications' => $db->query('SELECT id, title, message, level, created_at FROM notifications WHERE read_at IS NULL ORDER BY id DESC LIMIT 8')->fetchAll(),
            'settings' => restaurant_settings(true),
            'checklist' => $checklist,
            'timestamps_utc' => $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ]);
    }

    if ($action === 'module_list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $resource = $_GET['resource'] ?? '';
        $definition = api_module_definition(is_string($resource) ? $resource : '');
        api_require_permission($definition['permission']);
        $table = $definition['table'];
        if ($resource === 'employees') {
            $rows = restaurant_db()->query('SELECT id, name, username, role, active, created_at FROM admins ORDER BY id DESC LIMIT 500')->fetchAll();
        } elseif ($resource === 'ingredients') {
            $rows = restaurant_db()->query(
                'SELECT i.*, s.name AS supplier_name FROM ingredients i LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.name LIMIT 500'
            )->fetchAll();
        } elseif ($resource === 'reservations') {
            $rows = restaurant_db()->query("SELECT * FROM reservations ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END, reservation_at DESC LIMIT 500")->fetchAll();
        } elseif ($resource === 'payments') {
            $rows = restaurant_db()->query('SELECT p.*, o.customer_name FROM payments p JOIN orders o ON o.id = p.order_id ORDER BY p.id DESC LIMIT 500')->fetchAll();
        } elseif ($resource === 'audit') {
            $rows = restaurant_db()->query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500')->fetchAll();
        } elseif ($resource === 'movements') {
            $rows = restaurant_db()->query('SELECT m.*, i.name AS ingredient_name, i.unit FROM inventory_movements m JOIN ingredients i ON i.id = m.ingredient_id ORDER BY m.id DESC LIMIT 500')->fetchAll();
        } elseif ($resource === 'recipes') {
            $rows = restaurant_db()->query('SELECT r.*, m.name AS menu_name, i.name AS ingredient_name, i.unit FROM recipes r JOIN menu_items m ON m.id = r.menu_item_id JOIN ingredients i ON i.id = r.ingredient_id ORDER BY m.name, i.name LIMIT 500')->fetchAll();
        } else {
            $rows = restaurant_db()->query('SELECT * FROM `' . $table . '` ORDER BY id DESC LIMIT 500')->fetchAll();
        }
        api_response(['items' => $rows]);
    }

    if ($action === 'reports' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        api_require_permission('reports');
        $db = restaurant_db();
        $db = restaurant_db();
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
        $dateExpression = $driver === 'mysql' ? 'DATE(created_at)' : "DATE(created_at, 'localtime')";
        $from = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
            ? 'DATE_SUB(CURDATE(), INTERVAL 29 DAY)'
            : "DATE('now', '-29 day', 'localtime')";
        $revenue = (int) $db->query("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='completed' AND {$dateExpression} >= {$from}")->fetchColumn();
        $today = $driver === 'mysql' ? 'CURDATE()' : "DATE('now', 'localtime')";
        $expenses = (int) $db->query("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date >= {$from} AND expense_date <= {$today}")->fetchColumn();
        $foodCost = (int) $db->query(
            "SELECT COALESCE(SUM(ABS(m.quantity_change) * i.unit_cost), 0)
             FROM inventory_movements m JOIN ingredients i ON i.id = m.ingredient_id
             WHERE m.quantity_change < 0 AND m.reason LIKE 'Automatic deduction for order #%'
               AND DATE(m.created_at) >= {$from}"
        )->fetchColumn();
        $byMethod = $db->query("SELECT method, COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM payments WHERE status='completed' AND {$dateExpression} >= {$from} GROUP BY method ORDER BY total DESC")->fetchAll();
        $daily = $db->query("SELECT {$dateExpression} AS day, SUM(amount) AS total FROM payments WHERE status='completed' AND {$dateExpression} >= {$from} GROUP BY {$dateExpression} ORDER BY day")->fetchAll();
        api_response(['revenue' => $revenue, 'expenses' => $expenses, 'food_cost' => $foodCost, 'profit' => $revenue - $expenses - $foodCost, 'payments_by_method' => $byMethod, 'daily_sales' => $daily]);
    }

    if ($action === 'receipt' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        api_require_permission('payments');
        $db = restaurant_db();
        $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            api_response(['error' => 'Invalid order receipt.'], 422);
        }
        $orderQuery = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $orderQuery->execute([$id]);
        $order = $orderQuery->fetch();
        if (!$order) {
            api_response(['error' => 'Order not found.'], 404);
        }
        $paymentQuery = $db->prepare(
            "SELECT p.*, a.name AS staff_name FROM payments p LEFT JOIN admins a ON a.id = p.received_by
             WHERE p.order_id = ? AND p.status = 'completed' ORDER BY p.id DESC LIMIT 1"
        );
        $paymentQuery->execute([$id]);
        $payment = $paymentQuery->fetch();
        if (!$payment) {
            api_response(['error' => 'No completed payment exists for this order yet.'], 409);
        }
        $lines = $db->prepare('SELECT item_name, quantity, unit_price, line_total FROM order_items WHERE order_id = ? ORDER BY id');
        $lines->execute([$id]);
        api_response(['order' => $order, 'payment' => $payment, 'items' => $lines->fetchAll()]);
    }

    if ($action === 'export' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $type = $_GET['type'] ?? '';
        $db = restaurant_db();
        $date = date('Y-m-d');
        if ($type === 'orders') {
            api_require_permission('orders');
            $rows = $db->query(
                'SELECT id, created_at, customer_name, customer_phone, order_type, table_number, delivery_address,
                        subtotal, delivery_fee, tax_amount, discount, total_price, status, payment_method, notes
                 FROM orders ORDER BY id DESC'
            )->fetchAll(PDO::FETCH_NUM);
            api_audit('data_export', 'order', null, 'Orders exported as CSV');
            api_send_csv('kips-orders-' . $date . '.csv', [
                'Order', 'Created', 'Customer', 'Phone', 'Type', 'Table', 'Delivery address',
                'Subtotal', 'Delivery fee', 'Tax', 'Discount', 'Total', 'Status', 'Payment method', 'Notes'
            ], $rows);
        }
        if ($type === 'payments') {
            api_require_permission('payments');
            $rows = $db->query(
                'SELECT p.id, p.created_at, p.order_id, o.customer_name, o.customer_phone, p.amount, p.method, p.reference, p.status
                 FROM payments p JOIN orders o ON o.id = p.order_id ORDER BY p.id DESC'
            )->fetchAll(PDO::FETCH_NUM);
            api_audit('data_export', 'payment', null, 'Payments exported as CSV');
            api_send_csv('kips-payments-' . $date . '.csv', [
                'Receipt', 'Paid at', 'Order', 'Customer', 'Phone', 'Amount', 'Method', 'Reference', 'Status'
            ], $rows);
        }
        if ($type === 'expenses') {
            api_require_permission('expenses');
            $rows = $db->query(
                'SELECT e.id, e.expense_date, e.category, e.description, e.amount, s.name AS supplier, e.notes, e.created_at
                 FROM expenses e LEFT JOIN suppliers s ON s.id = e.supplier_id ORDER BY e.expense_date DESC, e.id DESC'
            )->fetchAll(PDO::FETCH_NUM);
            api_audit('data_export', 'expense', null, 'Expenses exported as CSV');
            api_send_csv('kips-expenses-' . $date . '.csv', [
                'ID', 'Expense date', 'Category', 'Description', 'Amount', 'Supplier', 'Notes', 'Recorded at'
            ], $rows);
        }
        api_response(['error' => 'Choose orders, payments or expenses to export.'], 422);
    }

    if ($action === 'backup' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        api_require_permission('backup');
        $db = restaurant_db();
        $data = [];
        foreach (['menu_items', 'restaurant_tables', 'reservations', 'customers', 'orders', 'order_items', 'payments', 'suppliers', 'ingredients', 'recipes', 'inventory_movements', 'expenses', 'audit_logs', 'notifications'] as $table) {
            $data[$table] = $db->query('SELECT * FROM `' . $table . '`')->fetchAll();
        }
        $data['employees'] = $db->query('SELECT id, username, name, role, active, created_at FROM admins')->fetchAll();
        api_audit('database_backup', 'backup', null, 'JSON database backup downloaded');
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="kips-backup-' . date('Y-m-d-His') . '.json"');
        echo json_encode(['created_at' => date(DATE_ATOM), 'data' => $data], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'customer_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
            api_response(['error' => 'Submit the payment choice using the order page.'], 415);
        }
        $orderId = filter_var($input['order_id'] ?? null, FILTER_VALIDATE_INT);
        $token = $input['token'] ?? '';
        $method = $input['payment_method'] ?? '';
        $allowedMethods = ['Cash', 'Bank Card', 'Airtel Money', 'TNM Mpamba', 'Bank Transfer'];
        if (!$orderId || !is_string($token) || !preg_match('/\A[a-f0-9]{64}\z/', $token)) {
            api_response(['error' => 'This order link is invalid.'], 404);
        }
        if (!is_string($method) || !in_array($method, $allowedMethods, true)) {
            api_response(['error' => 'Choose a valid payment method.'], 422);
        }
        $db = restaurant_db();
        $statement = $db->prepare(
            'UPDATE orders SET payment_method = ?
             WHERE id = ? AND customer_token_hash = ? AND status IN (\'verified\', \'preparing\')
               AND NOT EXISTS (SELECT 1 FROM payments WHERE payments.order_id = orders.id AND payments.status = \'completed\')'
        );
        $statement->execute([$method, $orderId, hash('sha256', $token)]);
        if ($statement->rowCount() !== 1) {
            $check = $db->prepare(
                'SELECT payment_method, status,
                        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = orders.id AND status = \'completed\') AS paid_amount,
                        total_price
                 FROM orders WHERE id = ? AND customer_token_hash = ?'
            );
            $check->execute([$orderId, hash('sha256', $token)]);
            $order = $check->fetch();
            if (!$order) {
                api_response(['error' => 'This order link is invalid or has expired.'], 404);
            }
            if (!in_array($order['status'], ['verified', 'preparing'], true) || (int) $order['paid_amount'] >= (int) $order['total_price']) {
                api_response(['error' => 'Payment choices are closed for this order. Contact the restaurant team for help.'], 409);
            }
            if ($order['payment_method'] !== $method) {
                api_response(['error' => 'The payment choice could not be saved. Refresh the order and try again.'], 409);
            }
        }
        api_response(['message' => 'Payment preference saved. The restaurant team will confirm your payment after receiving it.']);
    }

    if ($action === 'cancel_order' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
            api_response(['error' => 'Cancel the order using your private order page.'], 415);
        }
        $orderId = filter_var($input['order_id'] ?? null, FILTER_VALIDATE_INT);
        $token = $input['token'] ?? '';
        if (!$orderId || !is_string($token) || !preg_match('/\A[a-f0-9]{64}\z/', $token)) {
            api_response(['error' => 'This order link is invalid.'], 404);
        }
        $db = restaurant_db();
        $tokenHash = hash('sha256', $token);
        $db->beginTransaction();
        $statement = $db->prepare("UPDATE orders SET status = 'cancelled', queue_position = NULL WHERE id = ? AND customer_token_hash = ? AND status = 'awaiting_verification'");
        $statement->execute([$orderId, $tokenHash]);
        if ($statement->rowCount() !== 1) {
            $db->rollBack();
            $check = $db->prepare('SELECT status FROM orders WHERE id = ? AND customer_token_hash = ?');
            $check->execute([$orderId, $tokenHash]);
            $status = $check->fetchColumn();
            if ($status === false) {
                api_response(['error' => 'This order link is invalid or has expired.'], 404);
            }
            api_response(['error' => 'This order can no longer be cancelled online. Please contact the restaurant team.'], 409);
        }
        $db->prepare("UPDATE restaurant_tables SET status = 'available' WHERE table_number = (SELECT table_number FROM orders WHERE id = ?) AND status = 'occupied'")->execute([$orderId]);
        $db->prepare('INSERT INTO notifications (title, message, level) VALUES (?, ?, ?)')
            ->execute(['Order cancelled by guest', 'Order #' . $orderId . ' was cancelled by the customer before confirmation.', 'warning']);
        $db->commit();
        api_audit('order_cancelled_by_customer', 'order', (int) $orderId, 'Customer cancelled the order before staff confirmation');
        api_response(['message' => 'Your order has been cancelled. Contact the restaurant if you need help.']);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        api_response(['error' => 'Unsupported request method.'], 405);
    }

    api_require_csrf($input);
    $db = restaurant_db();

    if ($action === 'setup_admin') {
        if (restaurant_admin_exists()) {
            api_response(['error' => 'An administrator account has already been created.'], 409);
        }
        $username = api_clean_text($input['username'] ?? null, 50, 'Username');
        $name = api_clean_text($input['name'] ?? $username, 100, 'Name');
        $password = $input['password'] ?? '';
        if (!is_string($password) || strlen($password) < 12 || strlen($password) > 200) {
            api_response(['error' => 'Choose a password with at least 12 characters.'], 422);
        }
        $db->beginTransaction();
        $lock = $db->prepare("UPDATE installation_settings SET setting_value = 'complete' WHERE setting_key = 'admin_setup' AND setting_value = 'pending'");
        $lock->execute();
        if ($lock->rowCount() !== 1) {
            $db->rollBack();
            api_response(['error' => 'An administrator account has already been created.'], 409);
        }
        try {
            $statement = $db->prepare('INSERT INTO admins (username, password_hash, name, role) VALUES (?, ?, ?, \'administrator\')');
            $statement->execute([$username, password_hash($password, PASSWORD_DEFAULT), $name]);
        } catch (PDOException $exception) {
            $db->rollBack();
            if ($exception->getCode() === '23000') {
                api_response(['error' => 'That username is already in use.'], 409);
            }
            throw $exception;
        }
        $adminId = (int) $db->lastInsertId();
        $db->commit();
        session_regenerate_id(true);
        $_SESSION['admin_id'] = $adminId;
        $_SESSION['admin_username'] = $username;
        api_audit('created_first_admin', 'employee', $adminId, 'Initial administrator account created');
        api_response(['message' => 'Administrator account created.']);
    }

    if ($action === 'login') {
        $username = api_clean_text($input['username'] ?? null, 50, 'Username');
        $password = $input['password'] ?? '';
        $clientAddress = $_SERVER['REMOTE_ADDR'] ?? '';
        $loginKey = hash('sha256', strtolower($username) . '|' . $clientAddress);
        $attemptQuery = $db->prepare('SELECT COUNT(*) FROM auth_attempts WHERE login_key = ? AND attempted_at >= ?');
        $attemptQuery->execute([$loginKey, date('Y-m-d H:i:s', time() - 900)]);
        if ((int) $attemptQuery->fetchColumn() >= 8) {
            api_response(['error' => 'Too many sign-in attempts. Please wait 15 minutes and try again.'], 429);
        }
        $statement = $db->prepare('SELECT id, username, name, role, password_hash FROM admins WHERE username = ? AND active = 1');
        $statement->execute([$username]);
        $admin = $statement->fetch();
        if (!$admin || !is_string($password) || !password_verify($password, $admin['password_hash'])) {
            $db->prepare('INSERT INTO auth_attempts (login_key) VALUES (?)')->execute([$loginKey]);
            api_response(['error' => 'Incorrect username or password.'], 401);
        }
        $db->prepare('DELETE FROM auth_attempts WHERE login_key = ?')->execute([$loginKey]);
        session_regenerate_id(true);
        $_SESSION['admin_id'] = (int) $admin['id'];
        $_SESSION['admin_username'] = $admin['username'];
        api_audit('staff_login', 'employee', (int) $admin['id'], 'Signed in as ' . $admin['role']);
        api_response(['message' => 'Signed in.']);
    }

    if ($action === 'create_order') {
        $staff = restaurant_current_staff();
        if ($staff) {
            api_require_permission('orders');
        }
        $name = api_clean_text($input['customer_name'] ?? null, 100, 'Customer name');
        $phone = api_clean_text($input['customer_phone'] ?? null, 30, 'Phone number');
        $requestedItems = $input['items'] ?? [[
            'item_name' => $input['item_name'] ?? null,
            'quantity' => $input['quantity'] ?? null
        ]];
        if (!is_array($requestedItems) || count($requestedItems) < 1 || count($requestedItems) > 30) {
            api_response(['error' => 'Add between 1 and 30 food items.'], 422);
        }
        $allowedMethods = ['Cash', 'Bank Card', 'Airtel Money', 'TNM Mpamba', 'Bank Transfer'];
        $customerToken = null;
        $paymentMethod = '';
        if ($staff) {
            $requestedMethod = $input['payment_method'] ?? '';
            if ($requestedMethod !== '') {
                if (!is_string($requestedMethod) || !in_array($requestedMethod, $allowedMethods, true)) {
                    api_response(['error' => 'Choose a valid payment method.'], 422);
                }
                $paymentMethod = $requestedMethod;
            }
        }
        if ($paymentMethod === '') {
            $paymentMethod = 'Awaiting customer choice';
            $customerToken = bin2hex(random_bytes(32));
        }
        $orderType = $input['order_type'] ?? 'delivery';
        if (!is_string($orderType) || !in_array($orderType, ['dine-in', 'takeaway', 'delivery'], true)) {
            api_response(['error' => 'Choose dine-in, takeaway, or delivery.'], 422);
        }
        $deliveryAddress = '';
        if ($orderType === 'delivery') {
            $deliveryAddress = api_clean_text($input['delivery_address'] ?? null, 500, 'Delivery address');
        }
        $tableNumber = '';
        if ($orderType === 'dine-in') {
            $tableNumber = api_clean_text($input['table_number'] ?? null, 20, 'Table');
            $tableStatement = $db->prepare('SELECT status FROM restaurant_tables WHERE table_number = ?');
            $tableStatement->execute([$tableNumber]);
            if ($tableStatement->fetchColumn() !== 'available') {
                api_response(['error' => 'Choose a table that is currently available.'], 409);
            }
        }
        $orderItems = [];
        $total = 0;
        $totalQuantity = 0;
        foreach ($requestedItems as $requestedItem) {
            if (!is_array($requestedItem)) {
                api_response(['error' => 'Invalid food item in order.'], 422);
            }
            $itemName = api_clean_text($requestedItem['item_name'] ?? null, 100, 'Food item');
            $quantity = filter_var($requestedItem['quantity'] ?? null, FILTER_VALIDATE_INT);
            if ($quantity === false || $quantity < 1 || $quantity > 50 || $totalQuantity + $quantity > 100) {
                api_response(['error' => 'Each quantity must be 1–50 and total order quantity cannot exceed 100.'], 422);
            }
            $statement = $db->prepare('SELECT id, name, price FROM menu_items WHERE name = ? AND available = 1');
            $statement->execute([$itemName]);
            $item = $statement->fetch();
            if (!$item) {
                api_response(['error' => 'A selected food item is not currently available. Refresh the menu and try again.'], 422);
            }
            $lineTotal = (int) $item['price'] * $quantity;
            $orderItems[] = ['id' => (int) $item['id'], 'name' => $item['name'], 'price' => (int) $item['price'], 'quantity' => $quantity, 'total' => $lineTotal];
            $total += $lineTotal;
            $totalQuantity += $quantity;
        }
        $subtotal = $total;
        $settings = restaurant_settings();
        $deliveryFee = $orderType === 'delivery' ? max(0, (int) $settings['delivery_fee']) : 0;
        $taxRate = max(0.0, min(100.0, (float) $settings['tax_rate']));
        $taxAmount = (int) round($subtotal * $taxRate / 100);
        $discount = 0;
        if ($staff && isset($input['discount']) && $input['discount'] !== '') {
            $discount = filter_var($input['discount'], FILTER_VALIDATE_INT);
            if ($discount === false || $discount < 0 || $discount > $subtotal + $deliveryFee + $taxAmount) {
                api_response(['error' => 'Enter a discount between 0 and the order total.'], 422);
            }
        }
        $total = max(0, $subtotal + $deliveryFee + $taxAmount - $discount);
        $notes = isset($input['notes']) && trim((string) $input['notes']) !== ''
            ? api_clean_text($input['notes'], 1000, 'Order notes')
            : '';
        $db->beginTransaction();
        $customerQuery = $db->prepare('SELECT id FROM customers WHERE phone = ?');
        $customerQuery->execute([$phone]);
        $customerId = $customerQuery->fetchColumn();
        if ($customerId) {
            $db->prepare('UPDATE customers SET name = ? WHERE id = ?')->execute([$name, $customerId]);
        } else {
            $db->prepare('INSERT INTO customers (name, phone) VALUES (?, ?)')->execute([$name, $phone]);
            $customerId = $db->lastInsertId();
        }
        $firstItem = $orderItems[0];
        $statement = $db->prepare(
            'INSERT INTO orders (customer_name, customer_phone, item_name, quantity, unit_price, subtotal, delivery_fee, tax_amount, discount, total_price, payment_method, customer_token_hash, order_type, table_number, customer_id, delivery_address, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([
            $name, $phone, $firstItem['name'], $totalQuantity, $firstItem['price'], $subtotal, $deliveryFee, $taxAmount, $discount, $total,
            $paymentMethod, $customerToken !== null ? hash('sha256', $customerToken) : null,
            $orderType, $tableNumber, $customerId, $deliveryAddress, $notes
        ]);
        $orderId = (int) $db->lastInsertId();
        $lineInsert = $db->prepare('INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($orderItems as $orderItem) {
            $lineInsert->execute([$orderId, $orderItem['id'], $orderItem['name'], $orderItem['quantity'], $orderItem['price'], $orderItem['total']]);
        }
        if ($orderType === 'dine-in') {
            $tableUpdate = $db->prepare("UPDATE restaurant_tables SET status = 'occupied' WHERE table_number = ? AND status = 'available'");
            $tableUpdate->execute([$tableNumber]);
            if ($tableUpdate->rowCount() !== 1) {
                $db->rollBack();
                api_response(['error' => 'That table was just assigned to another order. Choose another table.'], 409);
            }
        }
        $db->commit();
        api_audit('order_created', 'order', $orderId, $orderType . ' order submitted');
        api_response([
            'order_id' => $orderId,
            'subtotal' => $subtotal,
            'delivery_fee' => $deliveryFee,
            'tax_amount' => $taxAmount,
            'discount' => $discount,
            'total' => $total,
            'tracking_token' => $customerToken,
            'message' => 'Order submitted and awaiting staff verification.'
        ], 201);
    }

    if ($action === 'create_reservation') {
        $name = api_clean_text($input['customer_name'] ?? null, 100, 'Customer name');
        $phone = api_clean_text($input['customer_phone'] ?? null, 30, 'Phone number');
        $email = isset($input['customer_email']) && trim((string) $input['customer_email']) !== ''
            ? api_clean_text($input['customer_email'], 190, 'Email')
            : '';
        $partySize = filter_var($input['party_size'] ?? null, FILTER_VALIDATE_INT);
        $date = api_clean_text($input['reservation_at'] ?? null, 30, 'Reservation date and time');
        $timestamp = strtotime($date);
        if ($partySize === false || $partySize < 1 || $partySize > 30 || !$timestamp || $timestamp < time() || $timestamp > strtotime('+1 year')) {
            api_response(['error' => 'Choose a future date and a party size between 1 and 30.'], 422);
        }
        $notes = isset($input['notes']) && trim((string) $input['notes']) !== '' ? api_clean_text($input['notes'], 1000, 'Notes') : '';
        $statement = $db->prepare('INSERT INTO reservations (customer_name, customer_phone, customer_email, party_size, reservation_at, notes) VALUES (?, ?, ?, ?, ?, ?)');
        $statement->execute([$name, $phone, $email, $partySize, date('Y-m-d H:i:s', $timestamp), $notes]);
        $reservationId = (int) $db->lastInsertId();
        api_audit('reservation_requested', 'reservation', $reservationId, 'Customer reservation request');
        api_response(['reservation_id' => $reservationId, 'message' => 'Reservation request received. Our team will confirm it shortly.'], 201);
    }

    api_require_admin();

    if ($action === 'logout') {
        api_audit('staff_logout', 'employee', (int) $_SESSION['admin_id'], 'Signed out');
        $_SESSION = [];
        session_regenerate_id(true);
        api_response(['message' => 'Signed out.']);
    }

    if ($action === 'settings_save') {
        api_require_administrator();
        $optionalText = static function (string $key, string $label, int $maxLength) use ($input): string {
            $value = $input[$key] ?? '';
            if (!is_string($value)) {
                api_response(['error' => $label . ' must be text.'], 422);
            }
            $value = trim($value);
            if (mb_strlen($value) > $maxLength) {
                api_response(['error' => $label . ' must be ' . $maxLength . ' characters or fewer.'], 422);
            }
            return $value;
        };
        $name = api_clean_text($input['restaurant_name'] ?? null, 100, 'Restaurant name');
        $phone = $optionalText('phone_display', 'Phone number', 40);
        $whatsapp = preg_replace('/\D+/', '', $optionalText('whatsapp_number', 'WhatsApp number', 30)) ?? '';
        $countryCode = preg_replace('/\D+/', '', $optionalText('country_code', 'Country code', 10)) ?? '';
        $currency = $optionalText('currency_symbol', 'Currency symbol', 6) ?: 'MK';
        $hours = $optionalText('opening_hours', 'Opening hours', 100);
        $openingNote = $optionalText('opening_note', 'Opening note', 60);
        $tagline = $optionalText('restaurant_tagline', 'Tagline', 140);
        $facebook = $optionalText('facebook_url', 'Facebook URL', 500);
        $instagram = $optionalText('instagram_url', 'Instagram URL', 500);
        if ($whatsapp !== '' && (strlen($whatsapp) < 8 || strlen($whatsapp) > 15)) {
            api_response(['error' => 'Enter a WhatsApp number with its country code, for example 265991234567.'], 422);
        }
        if ($countryCode !== '' && (strlen($countryCode) < 1 || strlen($countryCode) > 4)) {
            api_response(['error' => 'Enter a valid country calling code, for example 265.'], 422);
        }
        foreach (['facebook_url' => $facebook, 'instagram_url' => $instagram] as $label => $url) {
            if ($url !== '' && (strlen($url) > 500 || !filter_var($url, FILTER_VALIDATE_URL) || parse_url($url, PHP_URL_SCHEME) !== 'https')) {
                api_response(['error' => ucfirst(str_replace('_', ' ', $label)) . ' must be a valid HTTPS address.'], 422);
            }
        }
        $deliveryFee = filter_var($input['delivery_fee'] ?? 0, FILTER_VALIDATE_INT);
        if ($deliveryFee === false || $deliveryFee < 0 || $deliveryFee > 100000000) {
            api_response(['error' => 'Delivery fee must be a whole amount between 0 and 100,000,000.'], 422);
        }
        $taxRate = $input['tax_rate'] ?? 0;
        if (!is_numeric($taxRate) || (float) $taxRate < 0 || (float) $taxRate > 100) {
            api_response(['error' => 'Tax rate must be a percentage between 0 and 100.'], 422);
        }
        restaurant_settings_save([
            'restaurant_name' => $name,
            'restaurant_tagline' => $tagline,
            'phone_display' => $phone,
            'whatsapp_number' => $whatsapp,
            'country_code' => $countryCode ?: '265',
            'opening_hours' => $hours,
            'opening_note' => $openingNote,
            'facebook_url' => $facebook,
            'instagram_url' => $instagram,
            'currency_symbol' => $currency,
            'delivery_fee' => (string) $deliveryFee,
            'tax_rate' => rtrim(rtrim(number_format((float) $taxRate, 2, '.', ''), '0'), '.') ?: '0'
        ]);
        api_audit('settings_updated', 'settings', null, 'Restaurant profile and checkout settings updated');
        api_response(['message' => 'Restaurant settings saved.', 'settings' => restaurant_settings(true)]);
    }

    if ($action === 'change_password') {
        $staff = restaurant_current_staff();
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';
        $confirmPassword = $input['confirm_password'] ?? '';
        if (!is_string($currentPassword) || !is_string($newPassword) || !is_string($confirmPassword)) {
            api_response(['error' => 'Enter your current password and a new password.'], 422);
        }
        $statement = $db->prepare('SELECT password_hash FROM admins WHERE id = ?');
        $statement->execute([$staff['id']]);
        $hash = $statement->fetchColumn();
        if (!$hash || !password_verify($currentPassword, $hash)) {
            api_response(['error' => 'Your current password is incorrect.'], 422);
        }
        if (strlen($newPassword) < 12 || strlen($newPassword) > 200) {
            api_response(['error' => 'Choose a new password with at least 12 characters.'], 422);
        }
        if ($newPassword !== $confirmPassword) {
            api_response(['error' => 'The new passwords do not match.'], 422);
        }
        if (password_verify($newPassword, $hash)) {
            api_response(['error' => 'Choose a new password that is different from your current one.'], 422);
        }
        $db->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([password_hash($newPassword, PASSWORD_DEFAULT), $staff['id']]);
        session_regenerate_id(true);
        api_audit('password_changed', 'employee', (int) $staff['id'], 'Staff member changed their password');
        api_response(['message' => 'Your password has been updated.']);
    }

    if ($action === 'mark_notifications_read') {
        api_require_permission('dashboard');
        $db->exec("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL");
        api_response(['message' => 'Notifications marked as read.']);
    }

    if ($action === 'module_save') {
        $resource = $input['resource'] ?? '';
        $definition = api_module_definition(is_string($resource) ? $resource : '');
        api_require_permission($definition['permission']);
        if (!in_array($resource, ['reservations', 'customers', 'suppliers', 'ingredients', 'expenses', 'tables', 'employees'], true)) {
            api_response(['error' => 'This module is read-only here.'], 403);
        }
        $id = filter_var($input['id'] ?? 0, FILTER_VALIDATE_INT);
        if ($id === false || $id < 0) {
            api_response(['error' => 'Invalid record.'], 422);
        }
        $table = $definition['table'];
        $values = [];
        foreach ($definition['fields'] as $field) {
            if ($field === 'password' || ($resource === 'ingredients' && $field === 'image_path')) {
                continue;
            }
            $value = $input[$field] ?? null;
            if (in_array($field, $definition['required'], true) && ($value === null || (is_string($value) && trim($value) === ''))) {
                api_response(['error' => ucfirst(str_replace('_', ' ', $field)) . ' is required.'], 422);
            }
            if ($value === null || $value === '') {
                $value = in_array($field, ['supplier_id'], true) ? null : '';
            }
            if (in_array($field, ['party_size', 'capacity', 'loyalty_points', 'unit_cost', 'amount', 'supplier_id', 'active'], true)) {
                if ($value !== null && $value !== '' && filter_var($value, FILTER_VALIDATE_INT) === false) {
                    api_response(['error' => ucfirst(str_replace('_', ' ', $field)) . ' must be a whole number.'], 422);
                }
                if ($value !== null && $value !== '') {
                    $value = (int) $value;
                }
            }
            if (in_array($field, ['party_size', 'capacity'], true) && (int) $value < 1) {
                api_response(['error' => ucfirst(str_replace('_', ' ', $field)) . ' must be at least one.'], 422);
            }
            if (in_array($field, ['amount', 'unit_cost', 'loyalty_points'], true) && (int) $value < 0) {
                api_response(['error' => ucfirst(str_replace('_', ' ', $field)) . ' cannot be negative.'], 422);
            }
            if (in_array($field, ['stock_quantity', 'reorder_level'], true)) {
                if (!is_numeric($value) || (float) $value < 0) {
                    api_response(['error' => ucfirst(str_replace('_', ' ', $field)) . ' must be zero or more.'], 422);
                }
                $value = (float) $value;
            }
            if (is_string($value) && mb_strlen($value) > 2000) {
                api_response(['error' => 'Input is too long.'], 422);
            }
            if ($resource === 'reservations' && $field === 'reservation_at') {
                $reservationTime = is_string($value) ? strtotime($value) : false;
                if (!$reservationTime || $reservationTime < time() || $reservationTime > strtotime('+1 year')) {
                    api_response(['error' => 'Reservation must be within the next year.'], 422);
                }
                $value = date('Y-m-d H:i:s', $reservationTime);
            }
            if ($resource === 'expenses' && $field === 'expense_date' && (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || !strtotime($value))) {
                api_response(['error' => 'Enter a valid expense date.'], 422);
            }
            if ($field === 'email' || $field === 'customer_email') {
                if ($value !== '' && (!is_string($value) || !filter_var($value, FILTER_VALIDATE_EMAIL))) {
                    api_response(['error' => 'Enter a valid email address.'], 422);
                }
            }
            $values[$field] = $value;
        }

        $newInventoryImage = '';
        $oldInventoryImage = '';
        if ($resource === 'ingredients') {
            if ($id > 0) {
                $imageQuery = $db->prepare('SELECT image_path FROM ingredients WHERE id = ?');
                $imageQuery->execute([$id]);
                $existingImage = $imageQuery->fetchColumn();
                if ($existingImage === false) {
                    api_response(['error' => 'Ingredient not found.'], 404);
                }
                $oldInventoryImage = (string) $existingImage;
            }
            $newInventoryImage = api_store_uploaded_image('image', restaurant_inventory_image_directory());
            if ($newInventoryImage !== '') {
                $values['image_path'] = $newInventoryImage;
            } else {
                $values['image_path'] = $oldInventoryImage;
            }
        }

        if ($resource === 'employees') {
            $password = $input['password'] ?? '';
            $role = $values['role'];
            $validRoles = ['administrator', 'manager', 'waiter', 'chef', 'cashier'];
            $actor = restaurant_current_staff();
            if (!is_string($role) || !in_array($role, $validRoles, true) || ($actor['role'] !== 'administrator' && $role === 'administrator')) {
                api_response(['error' => 'Choose an allowed staff role.'], 422);
            }
            if (!$id && (!is_string($password) || strlen($password) < 12 || strlen($password) > 200)) {
                api_response(['error' => 'New staff accounts need a password with at least 12 characters.'], 422);
            }
            if ($id && $actor['role'] !== 'administrator') {
                $current = $db->prepare('SELECT role FROM admins WHERE id = ?');
                $current->execute([$id]);
                if ($current->fetchColumn() === 'administrator') {
                    api_response(['error' => 'Only an administrator can manage administrator accounts.'], 403);
                }
            }
            if ($id && $actor['role'] === 'administrator') {
                $currentRole = $db->prepare('SELECT role FROM admins WHERE id = ?');
                $currentRole->execute([$id]);
                if ($currentRole->fetchColumn() === 'administrator' && ($role !== 'administrator' || (int) $values['active'] !== 1)) {
                    $otherAdmins = $db->prepare("SELECT COUNT(*) FROM admins WHERE role = 'administrator' AND active = 1 AND id <> ?");
                    $otherAdmins->execute([$id]);
                    if ((int) $otherAdmins->fetchColumn() === 0) {
                        api_response(['error' => 'Keep at least one active administrator account.'], 409);
                    }
                }
            }
            if (!$id) {
                $values['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
                unset($values['password']);
            } elseif (is_string($password) && $password !== '') {
                if (strlen($password) < 12 || strlen($password) > 200) {
                    api_response(['error' => 'Password must be at least 12 characters.'], 422);
                }
                $values['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
            }
        }

        if ($resource === 'reservations' && !in_array($values['status'], ['pending', 'confirmed', 'seated', 'completed', 'cancelled'], true)) {
            api_response(['error' => 'Choose a valid reservation status.'], 422);
        }
        if ($resource === 'tables' && !in_array($values['status'], ['available', 'occupied', 'reserved', 'maintenance'], true)) {
            api_response(['error' => 'Choose a valid table status.'], 422);
        }
        if ($resource === 'employees' && isset($values['active']) && !in_array($values['active'], [0, 1], true)) {
            api_response(['error' => 'Staff availability must be active or inactive.'], 422);
        }

        $db->beginTransaction();
        $previousReservation = null;
        if ($resource === 'reservations' && $id > 0) {
            $previousQuery = $db->prepare('SELECT table_number, status FROM reservations WHERE id = ?');
            $previousQuery->execute([$id]);
            $previousReservation = $previousQuery->fetch();
            if (!$previousReservation) {
                $db->rollBack();
                api_response(['error' => 'Reservation not found.'], 404);
            }
        }
        if ($resource === 'ingredients' && $id > 0) {
            $oldQuery = $db->prepare('SELECT stock_quantity FROM ingredients WHERE id = ?');
            $oldQuery->execute([$id]);
            $oldStock = $oldQuery->fetchColumn();
            if ($oldStock === false) {
                $db->rollBack();
                api_response(['error' => 'Ingredient not found.'], 404);
            }
            $stockChange = (float) $values['stock_quantity'] - (float) $oldStock;
        } else {
            $stockChange = (float) ($values['stock_quantity'] ?? 0);
        }
        if ($resource === 'reservations' && $values['table_number'] !== '' && in_array($values['status'], ['confirmed', 'seated'], true)) {
            $tableQuery = $db->prepare('SELECT capacity, status FROM restaurant_tables WHERE table_number = ?');
            $tableQuery->execute([$values['table_number']]);
            $tableRecord = $tableQuery->fetch();
            $previousTable = $previousReservation['table_number'] ?? '';
            if (!$tableRecord || (int) $tableRecord['capacity'] < (int) $values['party_size']) {
                $db->rollBack();
                api_response(['error' => 'Choose an existing table with enough seats.'], 422);
            }
            if ($tableRecord['status'] !== 'available' && $previousTable !== $values['table_number']) {
                $db->rollBack();
                api_response(['error' => 'That table is not available. Choose another table.'], 409);
            }
            $overlapQuery = $db->prepare(
                "SELECT COUNT(*) FROM reservations WHERE table_number = ? AND status IN ('confirmed', 'seated')
                 AND id <> ? AND reservation_at BETWEEN ? AND ?"
            );
            $reservationTimestamp = strtotime($values['reservation_at']);
            $overlapQuery->execute([
                $values['table_number'],
                (int) $id,
                date('Y-m-d H:i:s', $reservationTimestamp - 5400),
                date('Y-m-d H:i:s', $reservationTimestamp + 5400)
            ]);
            if ((int) $overlapQuery->fetchColumn() > 0) {
                $db->rollBack();
                api_response(['error' => 'That table already has a reservation around this time.'], 409);
            }
        }
        try {
            if ($id > 0) {
                $updateValues = $values;
                if ($resource === 'employees' && !isset($updateValues['password_hash'])) {
                    unset($updateValues['password_hash']);
                }
                $assignments = implode(', ', array_map(static fn(string $field): string => '`' . $field . '` = ?', array_keys($updateValues)));
                $statement = $db->prepare('UPDATE `' . $table . '` SET ' . $assignments . ' WHERE id = ?');
                $statement->execute([...array_values($updateValues), $id]);
                if ($statement->rowCount() === 0) {
                    $exists = $db->prepare('SELECT COUNT(*) FROM `' . $table . '` WHERE id = ?');
                    $exists->execute([$id]);
                    if (!(int) $exists->fetchColumn()) {
                        $db->rollBack();
                        api_response(['error' => 'Record not found.'], 404);
                    }
                }
            } else {
                $columns = array_keys($values);
                $quotedColumns = implode(', ', array_map(static fn(string $field): string => '`' . $field . '`', $columns));
                $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                $statement = $db->prepare('INSERT INTO `' . $table . '` (' . $quotedColumns . ') VALUES (' . $placeholders . ')');
                $statement->execute(array_values($values));
                $id = (int) $db->lastInsertId();
            }
        } catch (PDOException $exception) {
            $db->rollBack();
            if ($newInventoryImage !== '') {
                api_remove_inventory_image($newInventoryImage);
            }
            if (str_starts_with($exception->getCode(), '23')) {
                api_response(['error' => 'A record with the same unique value already exists.'], 409);
            }
            throw $exception;
        }
        if ($resource === 'ingredients' && abs($stockChange) > 0.0001) {
            $reason = $stockChange > 0 ? 'Stock received or opening balance' : 'Manual stock adjustment';
            $db->prepare('INSERT INTO inventory_movements (ingredient_id, quantity_change, reason) VALUES (?, ?, ?)')->execute([$id, $stockChange, $reason]);
            $db->prepare('INSERT INTO notifications (title, message, level) SELECT ?, ?, ? WHERE ? <= ?')
                ->execute(['Low stock: ' . $values['name'], $values['name'] . ' is at ' . $values['stock_quantity'] . ' ' . $values['unit'], 'warning', $values['stock_quantity'], $values['reorder_level']]);
        }
        if ($resource === 'reservations') {
            $previousTable = $previousReservation['table_number'] ?? '';
            $previousStatus = $previousReservation['status'] ?? '';
            $newTable = $values['table_number'];
            $newStatus = $values['status'];
            if ($previousTable !== '' && ($previousTable !== $newTable || !in_array($newStatus, ['confirmed', 'seated'], true))) {
                $db->prepare("UPDATE restaurant_tables SET status = 'available' WHERE table_number = ? AND status IN ('reserved', 'occupied')")->execute([$previousTable]);
            }
            if ($newTable !== '' && in_array($newStatus, ['confirmed', 'seated'], true)) {
                $tableStatus = $newStatus === 'seated' ? 'occupied' : 'reserved';
                $db->prepare('UPDATE restaurant_tables SET status = ? WHERE table_number = ?')->execute([$tableStatus, $newTable]);
            }
        }
        $db->commit();
        $cleanupWarning = '';
        if ($newInventoryImage !== '' && $oldInventoryImage !== '' && $oldInventoryImage !== $newInventoryImage) {
            try {
                api_remove_inventory_image($oldInventoryImage);
            } catch (RuntimeException $exception) {
                error_log('KIPS inventory image cleanup error: ' . $exception->getMessage());
                $cleanupWarning = ' The previous image could not be removed.';
            }
        }
        api_audit($id && isset($input['id']) && (int) $input['id'] > 0 ? 'record_updated' : 'record_created', $resource, $id, 'Management record saved');
        api_response(['message' => 'Record saved successfully.' . $cleanupWarning, 'id' => $id]);
    }

    if ($action === 'module_delete') {
        $resource = $input['resource'] ?? '';
        $definition = api_module_definition(is_string($resource) ? $resource : '');
        api_require_permission($definition['permission']);
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            api_response(['error' => 'Invalid record.'], 422);
        }
        if ($resource === 'employees') {
            $statement = $db->prepare('UPDATE admins SET active = 0 WHERE id = ? AND role <> \'administrator\'');
        } elseif ($resource === 'menu') {
            $statement = $db->prepare('UPDATE menu_items SET available = 0 WHERE id = ?');
        } elseif (in_array($resource, ['reservations', 'expenses'], true)) {
            $statement = $db->prepare('DELETE FROM `' . $definition['table'] . '` WHERE id = ?');
        } else {
            api_response(['error' => 'This record type cannot be deleted.'], 403);
        }
        $statement->execute([$id]);
        if ($statement->rowCount() !== 1) {
            api_response(['error' => 'Record not found or cannot be removed.'], 404);
        }
        api_audit('record_deleted', $resource, (int) $id, 'Management record removed or deactivated');
        api_response(['message' => 'Record removed successfully.']);
    }

    if ($action === 'pay_order') {
        api_require_permission('payments');
        $orderId = filter_var($input['order_id'] ?? null, FILTER_VALIDATE_INT);
        $method = $input['method'] ?? '';
        $reference = isset($input['reference']) && trim((string) $input['reference']) !== ''
            ? api_clean_text($input['reference'], 100, 'Payment reference')
            : '';
        if (!$orderId || !is_string($method) || !in_array($method, ['Cash', 'Bank Card', 'Airtel Money', 'TNM Mpamba', 'Bank Transfer'], true)) {
            api_response(['error' => 'Choose an order and a supported payment method.'], 422);
        }
        $db->beginTransaction();
        $orderQuery = $db->prepare("SELECT id, customer_id, total_price, status FROM orders WHERE id = ?");
        $orderQuery->execute([$orderId]);
        $order = $orderQuery->fetch();
        if (!$order) {
            $db->rollBack();
            api_response(['error' => 'Order not found.'], 404);
        }
        if ($order['status'] === 'cancelled') {
            $db->rollBack();
            api_response(['error' => 'Cancelled orders cannot be paid.'], 409);
        }
        $paidQuery = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = ? AND status = 'completed'");
        $paidQuery->execute([$orderId]);
        $remaining = (int) $order['total_price'] - (int) $paidQuery->fetchColumn();
        if ($remaining <= 0) {
            $db->rollBack();
            api_response(['error' => 'This order is already fully paid.'], 409);
        }
        $staff = restaurant_current_staff();
        $statement = $db->prepare('INSERT INTO payments (order_id, amount, method, reference, received_by) VALUES (?, ?, ?, ?, ?)');
        $statement->execute([$orderId, $remaining, $method, $reference, $staff['id']]);
        $paymentId = (int) $db->lastInsertId();
        if ($order['customer_id']) {
            $db->prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?')->execute([(int) floor($remaining / 1000), $order['customer_id']]);
        }
        $db->commit();
        api_audit('payment_received', 'payment', $paymentId, 'Order #' . $orderId . ' paid by ' . $method);
        api_response(['message' => 'Payment recorded and digital receipt is ready.', 'payment_id' => $paymentId, 'amount' => $remaining]);
    }

    if ($action === 'inventory_adjust') {
        api_require_permission('inventory');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $change = $input['quantity_change'] ?? null;
        if (!$id || !is_numeric($change) || (float) $change == 0.0) {
            api_response(['error' => 'Choose an ingredient and a non-zero stock change.'], 422);
        }
        $reason = api_clean_text($input['reason'] ?? null, 100, 'Adjustment reason');
        $db->beginTransaction();
        $statement = $db->prepare('UPDATE ingredients SET stock_quantity = stock_quantity + ? WHERE id = ? AND stock_quantity + ? >= 0');
        $statement->execute([(float) $change, $id, (float) $change]);
        if ($statement->rowCount() !== 1) {
            $db->rollBack();
            api_response(['error' => 'Ingredient not found or adjustment would make stock negative.'], 409);
        }
        $db->prepare('INSERT INTO inventory_movements (ingredient_id, quantity_change, reason) VALUES (?, ?, ?)')->execute([$id, (float) $change, $reason]);
        $stockInfo = $db->prepare('SELECT name, unit, stock_quantity, reorder_level FROM ingredients WHERE id = ?');
        $stockInfo->execute([$id]);
        $ingredient = $stockInfo->fetch();
        if ((float) $ingredient['stock_quantity'] <= (float) $ingredient['reorder_level']) {
            $db->prepare('INSERT INTO notifications (title, message, level) VALUES (?, ?, ?)')
                ->execute(['Low stock: ' . $ingredient['name'], $ingredient['name'] . ' is low (' . $ingredient['stock_quantity'] . ' ' . $ingredient['unit'] . ' remaining).', 'warning']);
        }
        $db->commit();
        api_audit('stock_adjusted', 'ingredient', (int) $id, $reason . ': ' . $change);
        api_response(['message' => 'Stock adjustment saved.']);
    }

    if ($action === 'save_recipe') {
        api_require_permission('inventory');
        $menuId = filter_var($input['menu_item_id'] ?? null, FILTER_VALIDATE_INT);
        $ingredientId = filter_var($input['ingredient_id'] ?? null, FILTER_VALIDATE_INT);
        $quantity = $input['quantity'] ?? null;
        if (!$menuId || !$ingredientId || !is_numeric($quantity) || (float) $quantity <= 0) {
            api_response(['error' => 'Choose a menu item, ingredient and positive recipe quantity.'], 422);
        }
        $statement = $db->prepare(
            'INSERT INTO recipes (menu_item_id, ingredient_id, quantity) VALUES (?, ?, ?)
             ON CONFLICT(menu_item_id, ingredient_id) DO UPDATE SET quantity = excluded.quantity'
        );
        if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
            $statement = $db->prepare(
                'INSERT INTO recipes (menu_item_id, ingredient_id, quantity) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)'
            );
        }
        $statement->execute([$menuId, $ingredientId, (float) $quantity]);
        api_audit('recipe_updated', 'menu_item', (int) $menuId, 'Ingredient recipe updated');
        api_response(['message' => 'Recipe saved. Stock will be deducted when an order starts preparation.']);
    }

    if ($action === 'verify_order') {
        api_require_permission('orders');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            api_response(['error' => 'Invalid order.'], 422);
        }
        $db->beginTransaction();
        $position = (int) $db->query('SELECT COALESCE(MAX(queue_position), 0) + 1 FROM orders WHERE status = \'verified\'')->fetchColumn();
        $statement = $db->prepare('UPDATE orders SET status = \'verified\', queue_position = ? WHERE id = ? AND status = \'awaiting_verification\'');
        $statement->execute([$position, $id]);
        if ($statement->rowCount() !== 1) {
            $db->rollBack();
            api_response(['error' => 'This order is no longer waiting for verification.'], 409);
        }
        $db->commit();
        api_audit('order_verified', 'order', (int) $id, 'Order confirmed with the guest and added to the serving queue');
        api_response(['message' => 'Order confirmed and added to the manual serving queue.']);
    }

    if ($action === 'set_order_status') {
        api_require_permission('orders');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $currentStatus = $input['current_status'] ?? '';
        $status = $input['status'] ?? '';
        $transitions = [
            'awaiting_verification' => ['cancelled'],
            'verified' => ['preparing', 'cancelled'],
            'preparing' => ['completed', 'cancelled']
        ];
        if (!$id || !is_string($currentStatus) || !is_string($status) || !isset($transitions[$currentStatus]) || !in_array($status, $transitions[$currentStatus], true)) {
            api_response(['error' => 'Invalid order status change.'], 422);
        }
        $db->beginTransaction();
        if ($status === 'preparing') {
            $nextOrderId = (int) $db->query('SELECT id FROM orders WHERE status = \'verified\' ORDER BY queue_position, id LIMIT 1')->fetchColumn();
            if ($nextOrderId !== $id) {
                $db->rollBack();
                api_response(['error' => 'Only the first verified order in the manual queue can be started.'], 409);
            }
            $recipeQuery = $db->prepare(
                'SELECT r.ingredient_id, r.quantity * oi.quantity AS required_quantity, i.name, i.unit
                 FROM order_items oi
                 JOIN recipes r ON r.menu_item_id = oi.menu_item_id
                 JOIN ingredients i ON i.id = r.ingredient_id
                 WHERE oi.order_id = ?'
            );
            $recipeQuery->execute([$id]);
            $requirements = $recipeQuery->fetchAll();
            foreach ($requirements as $requirement) {
                $deduct = $db->prepare('UPDATE ingredients SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?');
                $deduct->execute([$requirement['required_quantity'], $requirement['ingredient_id'], $requirement['required_quantity']]);
                if ($deduct->rowCount() !== 1) {
                    $db->rollBack();
                    api_response(['error' => 'Not enough ' . $requirement['name'] . ' in stock to prepare this order. Update inventory first.'], 409);
                }
                $db->prepare('INSERT INTO inventory_movements (ingredient_id, quantity_change, reason, reference_id) VALUES (?, ?, ?, ?)')
                    ->execute([$requirement['ingredient_id'], -$requirement['required_quantity'], 'Automatic deduction for order #' . $id, $id]);
                $lowQuery = $db->prepare('SELECT name, unit, stock_quantity, reorder_level FROM ingredients WHERE id = ?');
                $lowQuery->execute([$requirement['ingredient_id']]);
                $stock = $lowQuery->fetch();
                if ((float) $stock['stock_quantity'] <= (float) $stock['reorder_level']) {
                    $db->prepare('INSERT INTO notifications (title, message, level) VALUES (?, ?, ?)')
                        ->execute(['Low stock: ' . $stock['name'], $stock['name'] . ' is low (' . $stock['stock_quantity'] . ' ' . $stock['unit'] . ' remaining).', 'warning']);
                }
            }
        }
        $statement = $db->prepare('UPDATE orders SET status = ?, queue_position = CASE WHEN ? = \'preparing\' THEN NULL ELSE queue_position END WHERE id = ? AND status = ?');
        $statement->execute([$status, $status, $id, $currentStatus]);
        if ($statement->rowCount() !== 1) {
            $db->rollBack();
            api_response(['error' => 'This order has changed. Refresh and try again.'], 409);
        }
        if (in_array($status, ['completed', 'cancelled'], true)) {
            $db->prepare("UPDATE restaurant_tables SET status = 'available' WHERE table_number = (SELECT table_number FROM orders WHERE id = ?) AND status = 'occupied'")->execute([$id]);
        }
        $db->commit();
        api_audit('order_status_changed', 'order', (int) $id, $currentStatus . ' → ' . $status);
        api_response(['message' => 'Order status updated.']);
    }

    if ($action === 'move_order') {
        api_require_permission('orders');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $direction = $input['direction'] ?? '';
        if (!$id || !in_array($direction, ['up', 'down'], true)) {
            api_response(['error' => 'Invalid queue move.'], 422);
        }
        $db->beginTransaction();
        $orders = $db->query('SELECT id FROM orders WHERE status = \'verified\' ORDER BY queue_position, id')->fetchAll();
        $ids = array_map(static fn(array $order): int => (int) $order['id'], $orders);
        $index = array_search($id, $ids, true);
        if ($index === false) {
            $db->rollBack();
            api_response(['error' => 'Only verified orders can be moved in the queue.'], 409);
        }
        $swapIndex = $direction === 'up' ? $index - 1 : $index + 1;
        if (!isset($ids[$swapIndex])) {
            $db->rollBack();
            api_response(['error' => 'This order is already at that end of the queue.'], 409);
        }
        [$ids[$index], $ids[$swapIndex]] = [$ids[$swapIndex], $ids[$index]];
        $update = $db->prepare('UPDATE orders SET queue_position = ? WHERE id = ?');
        foreach ($ids as $position => $orderId) {
            $update->execute([$position + 1, $orderId]);
        }
        $db->commit();
        api_audit('serving_queue_reordered', 'order', (int) $id, 'Order moved ' . $direction . ' in the serving queue');
        api_response(['message' => 'Serving order updated.']);
    }

    if ($action === 'save_menu_item') {
        api_require_permission('menu');
        $id = filter_var($input['id'] ?? 0, FILTER_VALIDATE_INT);
        if ($id === false || $id < 0) {
            api_response(['error' => 'Invalid food item.'], 422);
        }
        $name = api_clean_text($input['name'] ?? null, 100, 'Food name');
        $description = api_clean_text($input['description'] ?? null, 300, 'Description');
        $price = filter_var($input['price'] ?? null, FILTER_VALIDATE_INT);
        $thumb = $input['thumb'] ?? '';
        $thumbs = ['thumb-one', 'thumb-two', 'thumb-three', 'thumb-four', 'thumb-five'];
        $category = isset($input['category']) ? api_clean_text($input['category'], 60, 'Category') : 'Mains';
        $imageUrl = $input['image_url'] ?? '';
        if (!is_string($imageUrl) || ($imageUrl !== '' && (strlen($imageUrl) > 500 || !filter_var($imageUrl, FILTER_VALIDATE_URL) || parse_url($imageUrl, PHP_URL_SCHEME) !== 'https'))) {
            api_response(['error' => 'Food image URL must be a valid HTTPS address.'], 422);
        }
        if ($price === false || $price < 1 || $price > 100000000 || !is_string($thumb) || !in_array($thumb, $thumbs, true)) {
            api_response(['error' => 'Enter a valid price and choose a food image style.'], 422);
        }
        $oldImagePath = '';
        if ($id > 0) {
            $existingItem = $db->prepare('SELECT image_path FROM menu_items WHERE id = ?');
            $existingItem->execute([$id]);
            $existingImage = $existingItem->fetchColumn();
            if ($existingImage === false) {
                api_response(['error' => 'Food item not found.'], 404);
            }
            $oldImagePath = (string) $existingImage;
        }
        $removeImage = ($input['remove_image'] ?? '') === '1' || ($input['remove_image'] ?? '') === 'on';
        $newImagePath = api_store_uploaded_image('image', restaurant_menu_image_directory());
        $imagePath = $newImagePath !== '' ? $newImagePath : ($removeImage ? '' : $oldImagePath);
        if ($newImagePath !== '') {
            $imageUrl = '';
        }
        try {
            if ($id > 0) {
                $statement = $db->prepare('UPDATE menu_items SET name = ?, description = ?, price = ?, thumb = ?, category = ?, image_url = ?, image_path = ? WHERE id = ?');
                $statement->execute([$name, $description, $price, $thumb, $category, $imageUrl, $imagePath, $id]);
                if ($statement->rowCount() === 0 && !(int) $db->query('SELECT COUNT(*) FROM menu_items WHERE id = ' . (int) $id)->fetchColumn()) {
                    api_response(['error' => 'Food item not found.'], 404);
                }
            } else {
                $statement = $db->prepare('INSERT INTO menu_items (name, description, price, thumb, category, image_url, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)');
                $statement->execute([$name, $description, $price, $thumb, $category, $imageUrl, $imagePath]);
                $id = (int) $db->lastInsertId();
            }
        } catch (PDOException $exception) {
            if ($newImagePath !== '') {
                api_remove_menu_image($newImagePath);
            }
            if ($exception->getCode() === '23000') {
                api_response(['error' => 'A food item with that name already exists.'], 409);
            }
            throw $exception;
        }
        $cleanupWarning = '';
        if ($newImagePath !== '' && $oldImagePath !== '' && $oldImagePath !== $newImagePath) {
            try {
                api_remove_menu_image($oldImagePath);
            } catch (RuntimeException $exception) {
                error_log('KIPS menu image cleanup error: ' . $exception->getMessage());
                $cleanupWarning = ' The previous image could not be removed.';
            }
        } elseif ($removeImage && $oldImagePath !== '') {
            try {
                api_remove_menu_image($oldImagePath);
            } catch (RuntimeException $exception) {
                error_log('KIPS menu image cleanup error: ' . $exception->getMessage());
                $cleanupWarning = ' The previous image could not be removed.';
            }
        }
        api_audit($id > 0 ? 'menu_item_updated' : 'menu_item_created', 'menu_item', (int) $id, $name);
        api_response(['message' => 'Food menu saved.' . $cleanupWarning]);
    }

    if ($action === 'toggle_menu_item') {
        api_require_permission('menu');
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        $available = $input['available'] ?? null;
        if (!$id || !is_bool($available)) {
            api_response(['error' => 'Invalid food item update.'], 422);
        }
        $statement = $db->prepare('UPDATE menu_items SET available = ? WHERE id = ?');
        $statement->execute([$available ? 1 : 0, $id]);
        if ($statement->rowCount() !== 1) {
            api_response(['error' => 'Food item not found or unchanged.'], 404);
        }
        api_audit('menu_availability_changed', 'menu_item', (int) $id, $available ? 'Available' : 'Unavailable');
        api_response(['message' => 'Food availability updated.']);
    }

    api_response(['error' => 'Unknown action.'], 404);
} catch (Throwable $exception) {
    error_log('KIPS API error: ' . $exception->getMessage());
    api_response(['error' => 'The request could not be completed. Please try again.'], 500);
}
