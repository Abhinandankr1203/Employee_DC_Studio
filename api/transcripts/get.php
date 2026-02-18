<?php
/**
 * Get Transcript API
 * Retrieves meeting transcript
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';

// Verify authentication
$currentEmployee = requireAuth();

// Handle GET request only
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    jsonResponse(false, [], 'Method not allowed');
}

// Get meeting ID
$meetingId = isset($_GET['meeting_id']) ? (int)$_GET['meeting_id'] : 0;

if (!$meetingId) {
    http_response_code(400);
    jsonResponse(false, [], 'Meeting ID is required');
}

$conn = getDBConnection();

// Check if user has access to this meeting
$stmt = $conn->prepare("
    SELECT 1 FROM meetings m
    LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
    WHERE m.id = ? AND (m.organizer_id = ? OR mp.employee_id = ?)
    LIMIT 1
");
$stmt->bind_param("iii", $meetingId, $currentEmployee['id'], $currentEmployee['id']);
$stmt->execute();
$hasAccess = $stmt->get_result()->num_rows > 0;
$stmt->close();

if (!$hasAccess) {
    http_response_code(403);
    jsonResponse(false, [], 'You do not have access to this meeting');
}

// Get transcript
$stmt = $conn->prepare("SELECT * FROM meeting_transcripts WHERE meeting_id = ? ORDER BY id DESC LIMIT 1");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$transcript = $stmt->get_result()->fetch_assoc();
$stmt->close();

$conn->close();

if (!$transcript) {
    jsonResponse(true, null, 'No transcript found for this meeting');
}

jsonResponse(true, $transcript);
?>
