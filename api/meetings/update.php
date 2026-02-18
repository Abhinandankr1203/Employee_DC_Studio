<?php
/**
 * Update Meeting API
 * Updates an existing meeting (only organizer can update)
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';

// Verify authentication
$currentEmployee = requireAuth();

// Handle PUT/POST request
if (!in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'POST'])) {
    http_response_code(405);
    jsonResponse(false, [], 'Method not allowed');
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

// Get meeting ID
$meetingId = isset($input['id']) ? (int)$input['id'] : (isset($_GET['id']) ? (int)$_GET['id'] : 0);

if (!$meetingId) {
    http_response_code(400);
    jsonResponse(false, [], 'Meeting ID is required');
}

$conn = getDBConnection();

// Check if user is the organizer
$stmt = $conn->prepare("SELECT * FROM meetings WHERE id = ? AND organizer_id = ?");
$stmt->bind_param("ii", $meetingId, $currentEmployee['id']);
$stmt->execute();
$meeting = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$meeting) {
    http_response_code(403);
    jsonResponse(false, [], 'Only the meeting organizer can update this meeting');
}

// Cannot update completed or cancelled meetings
if (in_array($meeting['status'], ['completed', 'cancelled'])) {
    http_response_code(400);
    jsonResponse(false, [], 'Cannot update a ' . $meeting['status'] . ' meeting');
}

// Build update query dynamically
$updateFields = [];
$params = [];
$types = "";

$allowedFields = [
    'title' => 's',
    'description' => 's',
    'meeting_date' => 's',
    'start_time' => 's',
    'end_time' => 's',
    'timezone' => 's',
    'status' => 's'
];

foreach ($allowedFields as $field => $type) {
    if (isset($input[$field]) && $input[$field] !== $meeting[$field]) {
        $updateFields[] = "$field = ?";
        $params[] = sanitizeInput($input[$field]);
        $types .= $type;
    }
}

if (empty($updateFields)) {
    jsonResponse(true, $meeting, 'No changes detected');
}

// Validate date/time if being updated
if (isset($input['meeting_date']) || isset($input['start_time'])) {
    $newDate = $input['meeting_date'] ?? $meeting['meeting_date'];
    $newStartTime = $input['start_time'] ?? $meeting['start_time'];
    $meetingDateTime = strtotime("$newDate $newStartTime");

    if ($meetingDateTime < time()) {
        jsonResponse(false, [], 'Meeting date and time must be in the future');
    }
}

if (isset($input['start_time']) || isset($input['end_time'])) {
    $newStartTime = $input['start_time'] ?? $meeting['start_time'];
    $newEndTime = $input['end_time'] ?? $meeting['end_time'];

    if (strtotime($newEndTime) <= strtotime($newStartTime)) {
        jsonResponse(false, [], 'End time must be after start time');
    }
}

// Add meeting ID to params
$params[] = $meetingId;
$types .= "i";

$conn->begin_transaction();

try {
    // Update meeting
    $query = "UPDATE meetings SET " . implode(', ', $updateFields) . " WHERE id = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $stmt->close();

    // Update participants if provided
    if (isset($input['participants']) && is_array($input['participants'])) {
        // Remove existing non-organizer participants
        $stmt = $conn->prepare("DELETE FROM meeting_participants WHERE meeting_id = ? AND employee_id != ?");
        $stmt->bind_param("ii", $meetingId, $currentEmployee['id']);
        $stmt->execute();
        $stmt->close();

        // Add new participants
        $stmtInternal = $conn->prepare("
            INSERT INTO meeting_participants (meeting_id, employee_id, participant_type, rsvp_status)
            VALUES (?, ?, 'internal', 'pending')
        ");
        $stmtExternal = $conn->prepare("
            INSERT INTO meeting_participants (meeting_id, external_email, external_name, participant_type, rsvp_status)
            VALUES (?, ?, ?, 'external', 'pending')
        ");

        foreach ($input['participants'] as $participant) {
            if (isset($participant['employee_id']) && $participant['employee_id']) {
                $employeeId = (int)$participant['employee_id'];
                if ($employeeId !== $currentEmployee['id']) {
                    $stmtInternal->bind_param("ii", $meetingId, $employeeId);
                    $stmtInternal->execute();
                }
            } else if (isset($participant['email']) && filter_var($participant['email'], FILTER_VALIDATE_EMAIL)) {
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

    // Fetch updated meeting
    $stmt = $conn->prepare("
        SELECT m.*, e.employee_name as organizer_name, e.email as organizer_email
        FROM meetings m
        JOIN employees e ON m.organizer_id = e.id
        WHERE m.id = ?
    ");
    $stmt->bind_param("i", $meetingId);
    $stmt->execute();
    $updatedMeeting = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Get participants
    $stmt = $conn->prepare("
        SELECT mp.*, e.employee_name, e.email as employee_email
        FROM meeting_participants mp
        LEFT JOIN employees e ON mp.employee_id = e.id
        WHERE mp.meeting_id = ?
    ");
    $stmt->bind_param("i", $meetingId);
    $stmt->execute();
    $participants = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $updatedMeeting['participants'] = array_map(function($p) {
        return [
            'id' => (int)$p['id'],
            'type' => $p['participant_type'],
            'rsvp_status' => $p['rsvp_status'],
            'employee_id' => $p['employee_id'] ? (int)$p['employee_id'] : null,
            'name' => $p['participant_type'] === 'internal' ? $p['employee_name'] : $p['external_name'],
            'email' => $p['participant_type'] === 'internal' ? $p['employee_email'] : $p['external_email']
        ];
    }, $participants);

    jsonResponse(true, $updatedMeeting, 'Meeting updated successfully');

} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    jsonResponse(false, [], 'Failed to update meeting: ' . $e->getMessage());
}

$conn->close();
?>
