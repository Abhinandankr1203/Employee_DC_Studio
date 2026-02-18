<?php
/**
 * Send Meeting Invite API
 * Sends meeting invitations to participants
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';
require_once __DIR__ . '/../../includes/email-service.php';

// Verify authentication
$currentEmployee = requireAuth();

// Handle POST request only
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse(false, [], 'Method not allowed');
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

// Validate required fields
validateRequired(['meeting_id'], $input);

$meetingId = (int)$input['meeting_id'];

$conn = getDBConnection();

// Verify user is the organizer
$stmt = $conn->prepare("SELECT organizer_id FROM meetings WHERE id = ?");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$meeting = $stmt->get_result()->fetch_assoc();
$stmt->close();
$conn->close();

if (!$meeting) {
    http_response_code(404);
    jsonResponse(false, [], 'Meeting not found');
}

if ((int)$meeting['organizer_id'] !== (int)$currentEmployee['id']) {
    http_response_code(403);
    jsonResponse(false, [], 'Only the meeting organizer can send invites');
}

// Send invites to all participants
$results = sendAllMeetingInvites($meetingId);

$message = count($results['sent']) . ' invite(s) sent successfully';
if (!empty($results['failed'])) {
    $message .= ', ' . count($results['failed']) . ' failed';
}

jsonResponse(true, $results, $message);
?>
