<?php
/**
 * Create Google Calendar Event API
 * Creates a calendar event with Google Meet link
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';
require_once __DIR__ . '/../../includes/google-client.php';

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

// Get meeting details
$stmt = $conn->prepare("
    SELECT m.*, e.employee_name as organizer_name, e.email as organizer_email
    FROM meetings m
    JOIN employees e ON m.organizer_id = e.id
    WHERE m.id = ? AND m.organizer_id = ?
");
$stmt->bind_param("ii", $meetingId, $currentEmployee['id']);
$stmt->execute();
$meeting = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$meeting) {
    http_response_code(403);
    jsonResponse(false, [], 'Meeting not found or you are not the organizer');
}

// Check if event already created
if ($meeting['google_event_id']) {
    jsonResponse(false, [], 'Google Calendar event already exists for this meeting');
}

// Get participants
$stmt = $conn->prepare("
    SELECT mp.*, e.email as employee_email
    FROM meeting_participants mp
    LEFT JOIN employees e ON mp.employee_id = e.id
    WHERE mp.meeting_id = ?
");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$participants = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// Build attendees list
$attendees = [];
foreach ($participants as $p) {
    $email = $p['participant_type'] === 'internal' ? $p['employee_email'] : $p['external_email'];
    if ($email && $email !== $meeting['organizer_email']) {
        $attendees[] = ['email' => $email];
    }
}

// Format datetime for Google API
$startDateTime = date('c', strtotime($meeting['meeting_date'] . ' ' . $meeting['start_time']));
$endDateTime = date('c', strtotime($meeting['meeting_date'] . ' ' . $meeting['end_time']));

// Create Google Calendar event
$eventData = [
    'title' => $meeting['title'],
    'description' => $meeting['description'],
    'start_datetime' => $startDateTime,
    'end_datetime' => $endDateTime,
    'timezone' => $meeting['timezone'],
    'attendees' => $attendees
];

$result = createGoogleCalendarEvent($currentEmployee['id'], $eventData);

if (isset($result['error'])) {
    jsonResponse(false, [], $result['error']);
}

// Update meeting with Google event ID and Meet link
$stmt = $conn->prepare("
    UPDATE meetings
    SET google_event_id = ?, google_meet_link = ?
    WHERE id = ?
");
$stmt->bind_param("ssi", $result['event_id'], $result['meet_link'], $meetingId);
$stmt->execute();
$stmt->close();

$conn->close();

jsonResponse(true, [
    'event_id' => $result['event_id'],
    'meet_link' => $result['meet_link'],
    'calendar_link' => $result['html_link']
], 'Google Calendar event created with Meet link');
?>
