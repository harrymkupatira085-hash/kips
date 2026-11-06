# KIPS Restaurant Operations

KIPS is a PHP restaurant ordering and operations app with MySQL support, a local SQLite fallback, and a responsive staff workspace at `admin.php`.

## Local setup with XAMPP

1. Enable `pdo_mysql` (for MySQL) or `pdo_sqlite` (for the local fallback) in the PHP configuration used by Apache.
2. For MySQL, create a database and a dedicated database user. Give the app user access only to that database. The application creates and migrates its tables on the first request.
3. Configure the Apache/PHP process with these environment variables:

   ```text
   KIPS_DB_HOST=127.0.0.1
   KIPS_DB_PORT=3306
   KIPS_DB_NAME=kips_restaurant
   KIPS_DB_USER=your_database_user
   KIPS_DB_PASSWORD=your_database_password
   ```

   Alternatively, set `KIPS_DB_DSN` to a complete PDO DSN and use `KIPS_DB_USER` / `KIPS_DB_PASSWORD` for its credentials. Keep credentials outside the web root and source control, and restart Apache after changing its environment.
4. If `KIPS_DB_HOST` and `KIPS_DB_DSN` are unset, the app uses SQLite and stores its database outside `htdocs` in `C:\xampp\kips-data`. `KIPS_DATA_DIR` can select another private directory.
5. Visit `admin.php` to create the first administrator. Then sign in and use **Team** to create individual manager, waiter, chef and cashier accounts. Staff passwords must be at least 12 characters.

## Included operations

- Role-aware staff accounts and server-side permission checks.
- Menu and availability management, including local food-photo uploads; dine-in, takeaway and delivery orders.
- Order verification, a manually reorderable kitchen queue, and 15-second dashboard refresh.
- Reservations with table assignment and overlap checks, restaurant tables, customer records and loyalty points.
- Suppliers, ingredient inventory, stock movements, recipe-based stock deduction, and low-stock notifications.
- Optional JPEG, JFIF, PNG or WebP stock images (up to 10 MB) uploaded by inventory staff and stored in the private `KIPS_DATA_DIR` directory. Ensure the Apache/PHP account can write to this directory.
- Menu food photos can also be uploaded from the administrator's device; JPEG, JFIF, PNG and WebP files up to 10 MB are stored in the same private data directory and served to the public menu through the application.
- Customers see an on-screen order confirmation with a reference, total, selected payment method and order type. SMS delivery is not enabled; it requires a configured SMS gateway and credentials.
- Cash, bank card, Airtel Money, TNM Mpamba and bank-transfer payment recording, receipt views and transaction history.
- Sales, recorded-expense and estimated recipe-cost reporting; staff audit history; administrator-only JSON data export.

### Payment processing

This app records payments received by staff; it does not initiate or authorize card, Airtel Money, TNM Mpamba or bank transactions. Customers can select a preferred payment method, and a cashier records the payment only after confirming it through the restaurant's payment provider or terminal. To accept online payments, connect a real payment-provider API and configure its credentials/webhooks before advertising online checkout.

### Production deployment

Use HTTPS, strong unique staff passwords, a least-privilege MySQL account, private database/network access, and scheduled encrypted database backups. Review local privacy and retention requirements before storing customer information. The JSON export is an administrator download; it does not replace tested database backups or provide a restore operation.
