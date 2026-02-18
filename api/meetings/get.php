<?php
/**
 * Get Meeting API
 * Returns details of a specific meeting
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
$meetingId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if (!$meetingId) {
    http_response_code(400);
    jsonResponse(false, [], 'Meeting ID is required');
}

$conn = getDBConnection();

// Check if user has access to this meeting (organizer or participant)
$accessStmt = $conn->prepare("
    SELECT 1 FROM meetings m
    LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
    WHERE m.id = ? AND (m.organizer_id = ? OR mp.employee_id = ?)
    LIMIT 1
");
$accessStmt->bind_param("iii", $meetingId, $currentEmployee['id'], $currentEmployee['id']);
$accessStmt->execute();
$hasAccess = $accessStmt->get_result()->num_rows > 0;
$accessStmt->close();

if (!$hasAccess) {
    http_response_code(403);
    jsonResponse(false, [], 'You do not have access to this meeting');
}

// Get meeting details
$stmt = $conn->prepare("
    SELECT m.*, e.employee_name as organizer_name, e.email as organizer_email, e.department as organizer_department
    FROM meetings m
    JOIN employees e ON m.organizer_id = e.id
    WHERE m.id = ?
");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$meeting = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$meeting) {
    http_response_code(404);
    jsonResponse(false, [], 'Meeting not found');
}

// Get participants
$stmt = $conn->prepare("
    SELECT mp.*, e.employee_name, e.email as employee_email, e.department, e.designation
    FROM meeting_participants mp
    LEFT JOIN employees e ON mp.employee_id = e.id
    WHERE mp.meeting_id = ?
");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$participants = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$meeting['participants'] = array_map(function($p) {
    return [
        'id' => (int)$p['id'],
        'type' => $p['participant_type'],
        'rsvp_status' => $p['rsvp_status'],
        'employee_id' => $p['employee_id'] ? (int)$p['employee_id'] : null,
        'name' => $p['participant_type'] === 'internal' ? $p['employee_name'] : $p['external_name'],
        'email' => $p['participant_type'] === 'internal' ? $p['employee_email'] : $p['external_email'],
        'department' => $p['department'] ?? null,
        'designation' => $p['designation'] ?? null,
        'invite_sent_at' => $p['invite_sent_at']
    ];
}, $participants);

// Get transcript if exists
$stmt = $conn->prepare("SELECT * FROM meeting_transcripts WHERE meeting_id = ? ORDER BY id DESC LIMIT 1");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$transcript = $stmt->get_result()->fetch_assoc();
$stmt->close();
$meeting['transcript'] = $transcript;

// Get annotations count
$stmt = $conn->prepare("SELECT COUNT(*) as count FROM meeting_annotations WHERE meeting_id = ?");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$annotationCount = $stmt->get_result()->fetch_assoc()['count'];
$stmt->close();
$meeting['annotations_count'] = (int)$annotationCount;

$meeting['is_organizer'] = ((int)$meeting['organizer_id'] === (int)$currentEmployee['id']);

$conn->close();

jsonResponse(true, $meeting);
?>
