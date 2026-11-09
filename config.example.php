<?php
// Copy this file to config.local.php and edit the values you need.
// config.local.php stays on the server and is never downloaded by visitors.
// Empty values fall back to environment variables (for example on Render).
return [
    // Leave KIPS_DB_HOST and KIPS_DB_DSN empty to use the private SQLite file.
    'KIPS_DB_HOST' => '',
    'KIPS_DB_PORT' => '3306',
    'KIPS_DB_NAME' => 'kips_restaurant',
    'KIPS_DB_USER' => '',
    'KIPS_DB_PASSWORD' => '',
    'KIPS_DB_DSN' => '',
    // Store the SQLite database and uploaded photos outside the web root.
    'KIPS_DATA_DIR' => '',
];
