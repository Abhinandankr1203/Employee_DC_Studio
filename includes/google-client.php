<?php
/**
 * Google API Client Setup
 * Handles Google OAuth and Calendar API integration
 */

require_once __DIR__ . '/../config.php';

// Check if Google API client library is available
// If not using Composer, we'll use REST API directly
define('USE_GOOGLE_REST_API', true);

/**
 * Get Google OAuth authorization URL
 */
function getGoogleAuthUrl($employeeId) {
    $state = base64_encode(json_encode(['employee_id' => $employeeId, 'csrf' => bin2hex(random_bytes(16))]));
    $_SESSION['google_oauth_state'] = $state;

    $params = [
        'client_id' => GOOGLE_CLIENT_ID,
        'redirect_uri' => GOOGLE_REDIRECT_URI,
        'response_type' => 'code',
        'scope' => implode(' ', [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ]),
        'access_type' => 'offline',
        'prompt' => 'consent',
        'state' => $state
    ];

    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
}

/**
 * Exchange authorization code for tokens
 */
function exchangeCodeForTokens($code) {
    $url = 'https://oauth2.googleapis.com/token';

    $data = [
        'code' => $code,
        'client_id' => GOOGLE_CLIENT_ID,
        'client_secret' => GOOGLE_CLIENT_SECRET,
        'redirect_uri' => GOOGLE_REDIRECT_URI,
        'grant_type' => 'authorization_code'
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return ['error' => 'Failed to exchange code for tokens', 'response' => $response];
    }

    return json_decode($response, true);
}

/**
 * Refresh access token using refresh token
 */
function refreshAccessToken($refreshToken) {
    $url = 'https://oauth2.googleapis.com/token';

    $data = [
        'refresh_token' => $refreshToken,
        'client_id' => GOOGLE_CLIENT_ID,
        'client_secret' => GOOGLE_CLIENT_SECRET,
        'grant_type' => 'refresh_token'
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return ['error' => 'Failed to refresh token', 'response' => $response];
    }

    return json_decode($response, true);
}

/**
 * Save OAuth tokens to database
 */
function saveOAuthTokens($employeeId, $tokens) {
    $conn = getDBConnection();

    $accessToken = encryptData($tokens['access_token']);
    $refreshToken = isset($tokens['refresh_token']) ? encryptData($tokens['refresh_token']) : null;
    $tokenType = $tokens['token_type'] ?? 'Bearer';
    $expiresIn = $tokens['expires_in'] ?? 3600;
    $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn);

    // Check if token already exists for this employee
    $stmt = $conn->prepare("SELECT id, refresh_token FROM google_oauth_tokens WHERE employee_id = ?");
    $stmt->bind_param("i", $employeeId);
    $stmt->execute();
    $existing = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($existing) {
        // Preserve existing refresh token if new one not provided
        if (!$refreshToken && $existing['refresh_token']) {
            $refreshToken = $existing['refresh_token'];
        }

        $stmt = $conn->prepare("
            UPDATE google_oauth_tokens
            SET access_token = ?, refresh_token = ?, token_type = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = ?
        ");
        $stmt->bind_param("ssssi", $accessToken, $refreshToken, $tokenType, $expiresAt, $employeeId);
    } else {
        $stmt = $conn->prepare("
            INSERT INTO google_oauth_tokens (employee_id, access_token, refresh_token, token_type, expires_at)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("issss", $employeeId, $accessToken, $refreshToken, $tokenType, $expiresAt);
    }

    $result = $stmt->execute();
    $stmt->close();
    $conn->close();

    return $result;
}

/**
 * Get valid access token for employee (refreshes if expired)
 */
function getValidAccessToken($employeeId) {
    $conn = getDBConnection();

    $stmt = $conn->prepare("SELECT * FROM google_oauth_tokens WHERE employee_id = ?");
    $stmt->bind_param("i", $employeeId);
    $stmt->execute();
    $tokens = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $conn->close();

    if (!$tokens) {
        return null;
    }

    $accessToken = decryptData($tokens['access_token']);
    $expiresAt = strtotime($tokens['expires_at']);

    // Check if token is expired or about to expire (within 5 minutes)
    if ($expiresAt <= time() + 300) {
        if (!$tokens['refresh_token']) {
            return null; // No refresh token, user needs to re-authenticate
        }

        $refreshToken = decryptData($tokens['refresh_token']);
        $newTokens = refreshAccessToken($refreshToken);

        if (isset($newTokens['error'])) {
            return null;
        }

        saveOAuthTokens($employeeId, $newTokens);
        $accessToken = $newTokens['access_token'];
    }

    return $accessToken;
}

/**
 * Check if employee has valid Google OAuth connection
 */
function hasGoogleConnection($employeeId) {
    $conn = getDBConnection();

    $stmt = $conn->prepare("SELECT id, expires_at, refresh_token FROM google_oauth_tokens WHERE employee_id = ?");
    $stmt->bind_param("i", $employeeId);
    $stmt->execute();
    $tokens = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $conn->close();

    if (!$tokens) {
        return false;
    }

    // If we have a refresh token, we can always get a new access token
    return !empty($tokens['refresh_token']);
}

/**
 * Create Google Calendar event with Meet link
 */
function createGoogleCalendarEvent($employeeId, $eventData) {
    $accessToken = getValidAccessToken($employeeId);

    if (!$accessToken) {
        return ['error' => 'No valid Google access token. Please reconnect your Google account.'];
    }

    $url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';

    // Build event payload
    $event = [
        'summary' => $eventData['title'],
        'description' => $eventData['description'] ?? '',
        'start' => [
            'dateTime' => $eventData['start_datetime'],
            'timeZone' => $eventData['timezone'] ?? DEFAULT_TIMEZONE
        ],
        'end' => [
            'dateTime' => $eventData['end_datetime'],
            'timeZone' => $eventData['timezone'] ?? DEFAULT_TIMEZONE
        ],
        'conferenceData' => [
            'createRequest' => [
                'requestId' => uniqid('meet-', true),
                'conferenceSolutionKey' => [
                    'type' => 'hangoutsMeet'
                ]
            ]
        ]
    ];

    // Add attendees
    if (!empty($eventData['attendees'])) {
        $event['attendees'] = array_map(function($attendee) {
            return ['email' => $attendee['email']];
        }, $eventData['attendees']);
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($event));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode !== 200) {
        return ['error' => 'Failed to create calendar event', 'details' => $result];
    }

    return [
        'event_id' => $result['id'],
        'html_link' => $result['htmlLink'] ?? null,
        'meet_link' => $result['conferenceData']['entryPoints'][0]['uri'] ?? null
    ];
}

/**
 * Update Google Calendar event
 */
function updateGoogleCalendarEvent($employeeId, $eventId, $eventData) {
    $accessToken = getValidAccessToken($employeeId);

    if (!$accessToken) {
        return ['error' => 'No valid Google access token'];
    }

    $url = "https://www.googleapis.com/calendar/v3/calendars/primary/events/{$eventId}?conferenceDataVersion=1";

    $event = [
        'summary' => $eventData['title'],
        'description' => $eventData['description'] ?? '',
        'start' => [
            'dateTime' => $eventData['start_datetime'],
            'timeZone' => $eventData['timezone'] ?? DEFAULT_TIMEZONE
        ],
        'end' => [
            'dateTime' => $eventData['end_datetime'],
            'timeZone' => $eventData['timezone'] ?? DEFAULT_TIMEZONE
        ]
    ];

    if (!empty($eventData['attendees'])) {
        $event['attendees'] = array_map(function($attendee) {
            return ['email' => $attendee['email']];
        }, $eventData['attendees']);
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($event));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return ['error' => 'Failed to update calendar event', 'details' => json_decode($response, true)];
    }

    return json_decode($response, true);
}

/**
 * Delete Google Calendar event
 */
function deleteGoogleCalendarEvent($employeeId, $eventId) {
    $accessToken = getValidAccessToken($employeeId);

    if (!$accessToken) {
        return ['error' => 'No valid Google access token'];
    }

    $url = "https://www.googleapis.com/calendar/v3/calendars/primary/events/{$eventId}";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 204 && $httpCode !== 200) {
        return ['error' => 'Failed to delete calendar event'];
    }

    return ['success' => true];
}
?>
