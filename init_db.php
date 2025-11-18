<?php
// init_db.php
// RUN THIS FILE ONCE TO SET UP THE DATABASE, THEN DELETE IT.

// Set the timezone
date_default_timezone_set('Asia/Manila');

// Database file path
$db_file = __DIR__ . '/db/utang.sqlite';
$db_dir = __DIR__ . '/db';

// Check if db directory exists, if not, create it.
if (!is_dir($db_dir)) {
    mkdir($db_dir, 0777, true);
}

// Check if database file already exists
if (file_exists($db_file)) {
    die("Database file already exists. Delete 'db/utang.sqlite' to re-initialize.");
}

try {
    // Create a new SQLite3 database connection
    $db = new SQLite3($db_file);

    echo "Database created successfully at 'db/utang.sqlite'.<br>";

    // 1. Create 'settings' table
    $db->exec("
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ");
    echo "'settings' table created.<br>";

    // 2. Create 'debtors' table
    $db->exec("
        CREATE TABLE debtors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date_added TEXT NOT NULL,
            is_deleted INTEGER DEFAULT 0
        )
    ");
    echo "'debtors' table created.<br>";

    // 3. Create 'items' table
    $db->exec("
        CREATE TABLE items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            debtor_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            date_added TEXT NOT NULL,
            is_paid INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (debtor_id) REFERENCES debtors(id) ON DELETE CASCADE
        )
    ");
    echo "'items' table created.<br>";

    // Insert default settings
    $default_store_name = 'AJEJE’S SARI-SARI STORE';
    // Hash the default password
    $default_password = password_hash('utang1234', PASSWORD_DEFAULT);

    $stmt = $db->prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    
    $stmt->bindValue(1, 'store_name', SQLITE3_TEXT);
    $stmt->bindValue(2, $default_store_name, SQLITE3_TEXT);
    $stmt->execute();

    $stmt->bindValue(1, 'password', SQLITE3_TEXT);
    $stmt->bindValue(2, $default_password, SQLITE3_TEXT);
    $stmt->execute();
    
    echo "Default settings (store name and password) inserted.<br>";

    echo "<h3>Setup Complete! You may now delete this 'init_db.php' file.</h3>";

    // Close the database connection
    $db->close();

} catch (Exception $e) {
    die("Error: " . $e->getMessage());
}
?>
