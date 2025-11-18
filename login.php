<?php
session_start();
// If already logged in, redirect to the main app
if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true) {
    header('Location: index.php');
    exit;
}

// Get store name for display
$store_name = 'AJEJE’S SARI-SARI STORE'; // Default
try {
    $db = new SQLite3(__DIR__ . '/db/utang.sqlite');
    $result = $db->querySingle("SELECT value FROM settings WHERE key = 'store_name'", true);
    if ($result) {
        $store_name = htmlspecialchars($result['value']);
    }
    $db->close();
} catch (Exception $e) {
    // Db or table not found, use default.
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - E-Utang System</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
    <div id="login-container">
        <h1>E-Utang System</h1>
        <h2 id="login-store-name"><?php echo $store_name; ?></h2>
        
        <form id="login-form">
            <div class="input-group">
                <input type="password" id="password" placeholder="Enter Password" required>
            </div>
            <button type="submit" class="btn btn-primary">Login</button>
            <p id="login-error"></p>
        </form>
    </div>

    <footer>
        Made by <a href="https://saducasjeaboo.github.io/my-web/" target="_blank"><strong>Jeabo Ray Saducas</strong></a>
    </footer>

    <script>
        document.getElementById('login-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('login-error');
            errorEl.textContent = '';

            const formData = new FormData();
            formData.append('action', 'login');
            formData.append('password', password);

            try {
                const response = await fetch('api.php', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    window.location.href = 'index.php'; // Redirect to main app
                } else {
                    errorEl.textContent = result.message || 'Incorrect password.';
                }
            } catch (err) {
                errorEl.textContent = 'An error occurred. Please try again.';
            }
        });
    </script>
</body>
</html>
