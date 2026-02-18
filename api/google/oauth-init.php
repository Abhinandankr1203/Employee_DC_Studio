<?php
/**
 * Google OAuth Initialization
 * Starts the Google OAuth flow
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';
require_once __DIR__ . '/../../includes/google-client.php';

// Verify authentication
$currentEmployee = requireAuth();

// Generate and return the Google OAuth URL
$authUrl = getGoogleAuthUrl($currentEmployee['id']);

// If this is an AJAX request, return JSON
if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest') {
    jsonResponse(true, ['auth_url' => $authUrl]);
}

// Otherwise, redirect directly
header('Location: ' . $authUrl);
exit;
?>
