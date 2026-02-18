<?php
/**
 * Google OAuth Callback
 * Handles the OAuth callback from Google
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';
require_once __DIR__ . '/../../includes/google-client.php';

// Check for errors
if (isset($_GET['error'])) {
    $error = htmlspecialchars($_GET['error']);
    // Redirect to dashboard with error
    header('Location: ' . APP_URL . '/index.php?page=meeting-alignment&google_error=' . urlencode($error));
    exit;
}

// Verify authorization code
if (!isset($_GET['code'])) {
    header('Location: ' . APP_URL . '/index.php?page=meeting-alignment&google_error=' . urlencode('No authorization code received'));
    exit;
}

// Verify state
if (!isset($_GET['state']) || !isset($_SESSION['google_oauth_state']) || $_GET['state'] !== $_SESSION['google_oauth_state']) {
    header('Location: ' . APP_URL . '/index.php?page=meeting-alignment&google_error=' . urlencode('Invalid state parameter'));
    exit;
}

// Decode state to get employee ID
$state = json_decode(base64_decode($_GET['state']), true);
$employeeId = $state['employee_id'] ?? null;

if (!$employeeId) {
    header('Location: ' . APP_URL . '/index.php?page=meeting-alignment&google_error=' . urlencode('Invalid session state'));
    exit;
}

// Exchange code for tokens
$tokens = exchangeCodeForTokens($_GET['code']);

if (isset($tokens['error'])) {
    header('Location: ' . APP_URL . '/index.php?page=meeting-alignment&google_error=' . urlencode('Failed to exchange code for tokens'));
    exit;
}

// Save tokens to database
$saved = saveOAuthTokens($employeeId, $tokens);

if (!$saved) {
    header('Location: ' . APP_URL . '/index.php?page=meeting-alignment&google_error=' . urlencode('Failed to save tokens'));
    exit;
}

// Clear the state
unset($_SESSION['google_oauth_state']);

// Redirect to meeting alignment page with success
header('Location: ' . APP_URL . '/index.php?page=meeting-alignment&google_connected=true');
exit;
?>
