<?php
/**
 * Create Meeting API
 * Creates a new meeting with participants
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';

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
    // Try form data
    $input = $_POST;
}

// Validate required fields
validateRequired(['title', 'meeting_date', 'start_time', 'end_time'], $input);

$title = sanitizeInput($input['title']);
$description = sanitizeInput($input['description'] ?? '');
$meetingDate = sanitizeInput($input['meeting_date']);
$startTime = sanitizeInput($input['start_time']);
$endTime = sanitizeInput($input['end_time']);
$timezone = sanitizeInput($input['timezone'] ?? DEFAULT_TIMEZONE);
$participants = $input['participants'] ?? [];

// Validate date and time
$meetingDateTime = strtotime("$meetingDate $startTime");
if ($meetingDateTime < time()) {
    jsonResponse(false, [], 'Meeting date and time must be in the future');
}

$startDateTime = strtotime($startTime);
$endDateTime = strtotime($endTime);
if ($endDateTime <= $startDateTime) {
    jsonResponse(false, [], 'End time must be after start time');
}

$conn = getDBConnection();
$conn->begin_transaction();

try {
    // Insert meeting
    $stmt = $conn->prepare("
        INSERT INTO meetings (title, description, organizer_id, meeting_date, start_time, end_time, timezone, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
    ");
    $stmt->bind_param("ssissss", $title, $description, $currentEmployee['id'], $meetingDate, $startTime, $endTime, $timezone);
    $stmt->execute();
    $meetingId = $conn->insert_id;
    $stmt->close();

    // Add organizer as a participant
    $stmt = $conn->prepare("
        INSERT INTO meeting_participants (meeting_id, employee_id, participant_type, rsvp_status)
        VALUES (?, ?, 'internal', 'accepted')
    ");
    $stmt->bind_param("ii", $meetingId, $currentEmployee['id']);
    $stmt->execute();
    $stmt->close();

    // Add other participants
    if (!empty($participants)) {
        $stmtInternal = $conn->prepare("
            INSERT INTO meeting_participants (meeting_id, employee_id, participant_type, rsvp_status)
            VALUES (?, ?, 'internal', 'pending')
        ");
        $stmtExternal = $conn->prepare("
            INSERT INTO meeting_participants (meeting_id, external_email, external_name, participant_type, rsvp_status)
            VALUES (?, ?, ?, 'external', 'pending')
        ");

        foreach ($participants as $participant) {
            if (isset($participant['employee_id']) && $participant['employee_id']) {
                // Internal employee
                $employeeId = (int)$participant['employee_id'];
                if ($employeeId !== $currentEmployee['id']) { // Don't add organizer twice
                    $stmtInternal->bind_param("ii", $meetingId, $employeeId);
                    $stmtInternal->execute();
                }
            } else if (isset($participant['email']) && filter_var($participant['email'], FILTER_VALIDATE_EMAIL)) {
                // External participant
                $email = sanitizeInput($participant['email']);
                $name = sanitizeInput($participant['name'] ?? '');
                $stmtExternal->bind_param("iss", $meetingId, $email, $name);
                $stmtExternal->execute();
            }
        }

        $stmtInternal->close();
        $stmtExternal->close();
    }

    $conn->commit();

    // Fetch the created meeting with participants
    $meeting = getMeetingById($conn, $meetingId);

    jsonResponse(true, $meeting, 'Meeting created successfully');

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    jsonResponse(false, [], 'Failed to create meeting: ' . $e->getMessage());
}

$conn->close();

/**
 * Helper function to get meeting by ID with participants
 */
function getMeetingById($conn, $meetingId) {
    $stmt = $conn->prepare("
        SELECT m.*, e.employee_name as organizer_name, e.email as organizer_email
        FROM meetings m
        JOIN employees e ON m.organizer_id = e.id
        WHERE m.id = ?
    ");
    $stmt->bind_param("i", $meetingId);
    $stmt->execute();
    $meeting = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Get participants
    $stmt = $conn->prepare("
        SELECT mp.*, e.employee_name, e.email as employee_email, e.department
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
            'department' => $p['department'] ?? null
        ];
    }, $participants);

    return $meeting;
}
?>
