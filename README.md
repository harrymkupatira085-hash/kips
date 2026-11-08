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

## Public deployment on Render

This project is a PHP application. Static hosts such as Netlify cannot run its `index.php` or `api.php` endpoints; the root `index.html` is only a setup notice for static hosting.

1. Push the project, including `Dockerfile` and `render.yaml`, to the GitHub `main` branch.
2. In Render, choose **New → Blueprint**, connect this repository, and deploy the `kips-restaurant` service described by `render.yaml`. The blueprint uses the Docker runtime and a persistent 1 GB disk mounted at `/var/data` for the SQLite database and uploaded images.
3. Review Render's current service and disk charges before confirming deployment; the persistent disk requires a paid service plan.
4. Open the generated `onrender.com` address and create the first administrator account at `/admin.php`.
5. To use your existing custom domain, add it to the Render service and update its DNS records as Render instructs. Remove the domain from Netlify once it is attached to Render.

The included Dockerfile listens on Render's default web-service port 10000 and installs the PHP SQLite and mbstring extensions required by the app. Before taking real customer orders, configure HTTPS, backups, and your production security settings.

## Included operations

- Role-aware staff accounts and server-side permission checks.
- Menu and availability management, including local food-photo uploads; a multi-item customer cart; and dine-in, takeaway and delivery orders with a required delivery address.
- Order verification, a manually reorderable kitchen queue, and 15-second dashboard refresh.
- Reservations with table assignment and overlap checks, restaurant tables, customer records and loyalty points.
- Suppliers, ingredient inventory, stock movements, recipe-based stock deduction, and low-stock notifications.
- Optional JPEG, JFIF, PNG or WebP stock images (up to 10 MB) uploaded by inventory staff and stored in the private `KIPS_DATA_DIR` directory. Ensure the Apache/PHP account can write to this directory.
- Menu food photos can also be uploaded from the administrator's device; JPEG, JFIF, PNG and WebP files up to 10 MB are stored in the same private data directory and served to the public menu through the application.
- Customers receive an on-screen order reference and private status link. Staff manually contact and confirm the order; after staff approval, the customer uses the link to choose a payment preference. SMS delivery is not enabled and requires a configured SMS gateway.
- Cash, bank card, Airtel Money, TNM Mpamba and bank-transfer payment recording, receipt views and transaction history.
- Sales, recorded-expense and estimated recipe-cost reporting; staff audit history; administrator-only JSON data export.

### Payment processing

This app records payments received by staff; it does not initiate or authorize card, Airtel Money, TNM Mpamba or bank transactions. Customers can select a preferred payment method after staff confirms the order, and a cashier records payment only after confirming it through the restaurant's payment provider or terminal. To accept online payments, connect a real payment-provider API and configure its credentials/webhooks before advertising online checkout.

### Production deployment

Use HTTPS, strong unique staff passwords, a least-privilege MySQL account, private database/network access, and scheduled encrypted database backups. Review local privacy and retention requirements before storing customer information. The JSON export is an administrator download; it does not replace tested database backups or provide a restore operation.

## Order-flow checks

With XAMPP PHP and Node.js installed, run the isolated order API integration tests with:

```powershell
node --test tests/order-flow.test.js
```

The test starts a temporary PHP server and uses a separate temporary SQLite data directory; it does not modify the restaurant's normal database.
