<?php
// api.php
session_start();
date_default_timezone_set('Asia/Manila');

// Database connection
function getDB() {
    static $db = null;
    if ($db === null) {
        try {
            $db = new SQLite3(__DIR__ . '/db/utang.sqlite', SQLITE3_OPEN_READWRITE);
            $db->exec('PRAGMA foreign_keys = ON;'); // Enable foreign key constraints
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
    return $db;
}

// Check if user is logged in for protected actions
function checkAuth() {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        http_response_code(401); // Unauthorized
        echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
        exit;
    }
}

// Main API routing
$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Public actions
if ($action == 'login') {
    handleLogin();
}

// Protected actions - all other actions require login
checkAuth();

switch ($action) {
    case 'logout':
        handleLogout();
        break;
    case 'get_settings':
        getSettings();
        break;
    case 'update_settings':
        updateSettings();
        break;
    case 'update_password':
        updatePassword();
        break;
    case 'get_debtors':
        getDebtors();
        break;
    case 'add_debtor':
        addDebtor();
        break;
    case 'delete_debtor':
        deleteDebtor(); // This is a "soft delete" (move to trash)
        break;
    case 'get_debtor_details':
        getDebtorDetails();
        break;
    case 'add_item':
        addItem();
        break;
    case 'toggle_item_paid':
        toggleItemPaid();
        break;
    case 'mark_all_paid':
        markAllPaid();
        break;
    case 'delete_item':
        deleteItem(); // Soft delete item
        break;
    case 'get_trash':
        getTrash();
        break;
    case 'restore_debtor':
        restoreDebtor();
        break;
    case 'perm_delete_debtor':
        permDeleteDebtor();
        break;
    case 'restore_item':
        restoreItem();
        break;
    case 'perm_delete_item':
        permDeleteItem();
        break;
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}

// --- ACTION HANDLERS ---

function handleLogin() {
    $db = getDB();
    $password = $_POST['password'] ?? '';
    
    $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'password'");
    $result = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    
    if ($result && password_verify($password, $result['value'])) {
        $_SESSION['loggedin'] = true;
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Incorrect password.']);
    }
    $db->close();
}

function handleLogout() {
    session_destroy();
    echo json_encode(['success' => true]);
}

function getSettings() {
    $db = getDB();
    $result = $db->query("SELECT key, value FROM settings WHERE key = 'store_name'");
    $settings = $result->fetchArray(SQLITE3_ASSOC);
    echo json_encode(['success' => true, 'settings' => $settings]);
    $db->close();
}

function updateSettings() {
    $db = getDB();
    $store_name = $_POST['store_name'] ?? '';
    
    $stmt = $db->prepare("UPDATE settings SET value = :value WHERE key = 'store_name'");
    $stmt->bindValue(':value', $store_name, SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Store name updated.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update store name.']);
    }
    $db->close();
}

function updatePassword() {
    $db = getDB();
    $new_password = $_POST['new_password'] ?? '';
    
    if (empty($new_password)) {
        echo json_encode(['success' => false, 'message' => 'Password cannot be empty.']);
        $db->close();
        return;
    }

    $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
    
    $stmt = $db->prepare("UPDATE settings SET value = :value WHERE key = 'password'");
    $stmt->bindValue(':value', $hashed_password, SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Password updated.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update password.']);
    }
    $db->close();
}

function getDebtors() {
    $db = getDB();
    // Get all non-deleted debtors, newest first
    $result = $db->query("SELECT * FROM debtors WHERE is_deleted = 0 ORDER BY date_added DESC");
    
    $debtors = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        // For each debtor, check their payment status
        $stmt_items = $db->prepare("SELECT COUNT(*) as total_items, SUM(CASE WHEN is_paid = 0 THEN 1 ELSE 0 END) as unpaid_items FROM items WHERE debtor_id = :id AND is_deleted = 0");
        $stmt_items->bindValue(':id', $row['id'], SQLITE3_INTEGER);
        $items_status = $stmt_items->execute()->fetchArray(SQLITE3_ASSOC);
        
        if ($items_status['total_items'] == 0) {
            $row['status'] = 'Unpaid'; // No items, technically unpaid
        } elseif ($items_status['unpaid_items'] == 0) {
            $row['status'] = 'Paid'; // All items are paid
        } else {
            $row['status'] = 'Unpaid'; // Some items are unpaid
        }
        
        $debtors[] = $row;
    }
    
    echo json_encode(['success' => true, 'debtors' => $debtors]);
    $db->close();
}

function addDebtor() {
    $db = getDB();
    $name = $_POST['name'] ?? 'Unnamed Debtor';
    $date = date('Y-m-d H:i:s');
    
    $stmt = $db->prepare("INSERT INTO debtors (name, date_added) VALUES (:name, :date)");
    $stmt->bindValue(':name', $name, SQLITE3_TEXT);
    $stmt->bindValue(':date', $date, SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        $new_id = $db->lastInsertRowID();
        $result = $db->query("SELECT * FROM debtors WHERE id = $new_id");
        $new_debtor = $result->fetchArray(SQLITE3_ASSOC);
        $new_debtor['status'] = 'Unpaid'; // New debtors start as unpaid
        echo json_encode(['success' => true, 'debtor' => $new_debtor]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to add debtor.']);
    }
    $db->close();
}

function deleteDebtor() {
    $db = getDB();
    $id = $_POST['id'] ?? 0;
    
    $stmt = $db->prepare("UPDATE debtors SET is_deleted = 1 WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Debtor moved to trash.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete debtor.']);
    }
    $db->close();
}

function getDebtorDetails() {
    $db = getDB();
    $id = $_GET['id'] ?? 0;
    
    // Get debtor info
    $stmt_debtor = $db->prepare("SELECT * FROM debtors WHERE id = :id AND is_deleted = 0");
    $stmt_debtor->bindValue(':id', $id, SQLITE3_INTEGER);
    $debtor = $stmt_debtor->execute()->fetchArray(SQLITE3_ASSOC);
    
    if (!$debtor) {
        echo json_encode(['success' => false, 'message' => 'Debtor not found.']);
        $db->close();
        return;
    }
    
    // Get items
    $stmt_items = $db->prepare("SELECT * FROM items WHERE debtor_id = :id AND is_deleted = 0 ORDER BY date_added DESC");
    $stmt_items->bindValue(':id', $id, SQLITE3_INTEGER);
    $result_items = $stmt_items->execute();
    
    $items = [];
    $total_owed = 0;
    while ($row = $result_items->fetchArray(SQLITE3_ASSOC)) {
        if ($row['is_paid'] == 0) {
            $total_owed += $row['quantity'] * $row['price'];
        }
        $items[] = $row;
    }
    
    $debtor['total_owed'] = $total_owed;
    
    echo json_encode(['success' => true, 'debtor' => $debtor, 'items' => $items]);
    $db->close();
}

function addItem() {
    $db = getDB();
    $debtor_id = $_POST['debtor_id'] ?? 0;
    $item_name = $_POST['item_name'] ?? '';
    $quantity = $_POST['quantity'] ?? 0;
    $price = $_POST['price'] ?? 0;
    $date = date('Y-m-d H:i:s');
    
    $stmt = $db->prepare("INSERT INTO items (debtor_id, item_name, quantity, price, date_added) VALUES (:did, :name, :qty, :price, :date)");
    $stmt->bindValue(':did', $debtor_id, SQLITE3_INTEGER);
    $stmt->bindValue(':name', $item_name, SQLITE3_TEXT);
    $stmt->bindValue(':qty', $quantity, SQLITE3_INTEGER);
    $stmt->bindValue(':price', $price, SQLITE3_FLOAT);
    $stmt->bindValue(':date', $date, SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        $new_id = $db->lastInsertRowID();
        $result = $db->query("SELECT * FROM items WHERE id = $new_id");
        $new_item = $result->fetchArray(SQLITE3_ASSOC);
        echo json_encode(['success' => true, 'item' => $new_item]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to add item.']);
    }
    $db->close();
}

function toggleItemPaid() {
    $db = getDB();
    $id = $_POST['id'] ?? 0;
    
    // We toggle the 'is_paid' status (0 becomes 1, 1 becomes 0)
    $stmt = $db->prepare("UPDATE items SET is_paid = 1 - is_paid WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update item status.']);
    }
    $db->close();
}

function markAllPaid() {
    $db = getDB();
    $debtor_id = $_POST['debtor_id'] ?? 0;
    
    $stmt = $db->prepare("UPDATE items SET is_paid = 1 WHERE debtor_id = :did AND is_deleted = 0");
    $stmt->bindValue(':did', $debtor_id, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to mark all items as paid.']);
    }
    $db->close();
}

function deleteItem() {
    $db = getDB();
    $id = $_POST['id'] ?? 0;
    
    // Soft delete
    $stmt = $db->prepare("UPDATE items SET is_deleted = 1 WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Item moved to trash.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete item.']);
    }
    $db->close();
}

function getTrash() {
    $db = getDB();
    
    // Get trashed debtors
    $result_debtors = $db->query("SELECT * FROM debtors WHERE is_deleted = 1 ORDER BY date_added DESC");
    $trashed_debtors = [];
    while ($row = $result_debtors->fetchArray(SQLITE3_ASSOC)) {
        $trashed_debtors[] = $row;
    }
    
    // Get trashed items (and join with debtor name)
    $result_items = $db->query("
        SELECT items.*, debtors.name as debtor_name 
        FROM items 
        JOIN debtors ON items.debtor_id = debtors.id
        WHERE items.is_deleted = 1 
        ORDER BY items.date_added DESC
    ");
    $trashed_items = [];
    while ($row = $result_items->fetchArray(SQLITE3_ASSOC)) {
        $trashed_items[] = $row;
    }
    
    echo json_encode(['success' => true, 'debtors' => $trashed_debtors, 'items' => $trashed_items]);
    $db->close();
}

function restoreDebtor() {
    $db = getDB();
    $id = $_POST['id'] ?? 0;
    $stmt = $db->prepare("UPDATE debtors SET is_deleted = 0 WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    echo json_encode(['success' => true]);
    $db->close();
}

function permDeleteDebtor() {
    $db = getDB();
    $id = $_POST['id'] ?? 0;
    
    // Delete the debtor AND all associated items (thanks to 'ON DELETE CASCADE' in schema)
    $stmt = $db->prepare("DELETE FROM debtors WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Debtor permanently deleted.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete debtor.']);
    }
    $db->close();
}

function restoreItem() {
    $db = getDB();
    $id = $_POST['id'] ?? 0;
    $stmt = $db->prepare("UPDATE items SET is_deleted = 0 WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    echo json_encode(['success' => true]);
    $db->close();
}

function permDeleteItem() {
    $db = getDB();
    $id = $_POST['id'] ?? 0;
    $stmt = $db->prepare("DELETE FROM items WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    echo json_encode(['success' => true]);
    $db->close();
}

?>
