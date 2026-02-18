<?php
/**
 * Check Google Auth Status
 * Returns whether the user has a valid Google connection
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';
require_once __DIR__ . '/../../includes/google-client.php';

// Verify authentication
$currentEmployee = requireAuth();

// Check if user has Google connection
$hasConnection = hasGoogleConnection($currentEmployee['id']);

jsonResponse(true, [
    'connected' => $hasConnection,
    'auth_url' => !$hasConnection ? getGoogleAuthUrl($currentEmployee['id']) : null
]);
?>
