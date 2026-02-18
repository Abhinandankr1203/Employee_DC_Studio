<?php
// Database Configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'dc_studio_employee');

// Google OAuth Configuration
// Get these from Google Cloud Console: https://console.cloud.google.com/
define('GOOGLE_CLIENT_ID', 'your-google-client-id.apps.googleusercontent.com');
define('GOOGLE_CLIENT_SECRET', 'your-google-client-secret');
define('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/google/oauth-callback.php');

// SendGrid Email Configuration
// Get this from SendGrid: https://sendgrid.com/
define('SENDGRID_API_KEY', 'SG.your-sendgrid-api-key');
define('SENDGRID_FROM_EMAIL', 'noreply@dcstudio.com');
define('SENDGRID_FROM_NAME', 'DC Studio');

// Encryption Key for OAuth tokens (32 characters)
define('ENCRYPTION_KEY', 'dc_studio_secure_key_32_chars!!');
define('ENCRYPTION_METHOD', 'aes-256-cbc');

// Application Settings
define('APP_URL', 'http://localhost:8000');
define('APP_NAME', 'DC Studio Employee Portal');
define('DEFAULT_TIMEZONE', 'Asia/Kolkata');

// Create connection
function getDBConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    return $conn;
}

// Helper function to encrypt data
function encryptData($data) {
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length(ENCRYPTION_METHOD));
    $encrypted = openssl_encrypt($data, ENCRYPTION_METHOD, ENCRYPTION_KEY, 0, $iv);
    return base64_encode($encrypted . '::' . $iv);
}

// Helper function to decrypt data
function decryptData($data) {
    list($encrypted_data, $iv) = explode('::', base64_decode($data), 2);
    return openssl_decrypt($encrypted_data, ENCRYPTION_METHOD, ENCRYPTION_KEY, 0, $iv);
}

// Helper function to return JSON response
function jsonResponse($success, $data = [], $message = '') {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}

// Start session if not already started
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
?>
