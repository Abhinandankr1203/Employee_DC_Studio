<?php
/**
 * Generate ICS File API
 * Downloads an ICS calendar file for a meeting
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';
require_once __DIR__ . '/../../includes/email-service.php';

// Verify authentication
$currentEmployee = requireAuth();

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

// Get meeting details
$stmt = $conn->prepare("
    SELECT m.*, e.employee_name, e.email
    FROM meetings m
    JOIN employees e ON m.organizer_id = e.id
    WHERE m.id = ?
");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$meeting = $stmt->get_result()->fetch_assoc();
$stmt->close();
$conn->close();

if (!$meeting) {
    http_response_code(404);
    jsonResponse(false, [], 'Meeting not found');
}

$organizer = [
    'employee_name' => $meeting['employee_name'],
    'email' => $meeting['email']
];

// Generate ICS content
$icsContent = generateICS($meeting, $organizer, $currentEmployee['email']);

// Output as downloadable file
$filename = preg_replace('/[^a-zA-Z0-9]/', '-', $meeting['title']) . '.ics';

header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($icsContent));

echo $icsContent;
exit;
?>
