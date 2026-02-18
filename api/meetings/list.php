<?php
/**
 * List Meetings API
 * Returns meetings for the current user (as organizer or participant)
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';

// Verify authentication
$currentEmployee = requireAuth();

// Handle GET request only
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    jsonResponse(false, [], 'Method not allowed');
}

// Get filter parameters
$filter = isset($_GET['filter']) ? sanitizeInput($_GET['filter']) : 'all'; // all, upcoming, past
$status = isset($_GET['status']) ? sanitizeInput($_GET['status']) : null;
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$limit = isset($_GET['limit']) ? min(50, max(1, (int)$_GET['limit'])) : 10;
$offset = ($page - 1) * $limit;

$conn = getDBConnection();

// Build query based on filters
$whereConditions = ["(m.organizer_id = ? OR mp.employee_id = ?)"];
$params = [$currentEmployee['id'], $currentEmployee['id']];
$types = "ii";

$today = date('Y-m-d');
$currentTime = date('H:i:s');

if ($filter === 'upcoming') {
    $whereConditions[] = "(m.meeting_date > ? OR (m.meeting_date = ? AND m.start_time >= ?))";
    $params[] = $today;
    $params[] = $today;
    $params[] = $currentTime;
    $types .= "sss";
} else if ($filter === 'past') {
    $whereConditions[] = "(m.meeting_date < ? OR (m.meeting_date = ? AND m.end_time < ?))";
    $params[] = $today;
    $params[] = $today;
    $params[] = $currentTime;
    $types .= "sss";
}

if ($status) {
    $whereConditions[] = "m.status = ?";
    $params[] = $status;
    $types .= "s";
}

$whereClause = implode(' AND ', $whereConditions);

// Get total count
$countQuery = "
    SELECT COUNT(DISTINCT m.id) as total
    FROM meetings m
    LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
    WHERE $whereClause
";
$stmt = $conn->prepare($countQuery);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$totalCount = $stmt->get_result()->fetch_assoc()['total'];
$stmt->close();

// Get meetings
$orderBy = $filter === 'past'
    ? "ORDER BY m.meeting_date DESC, m.start_time DESC"
    : "ORDER BY m.meeting_date ASC, m.start_time ASC";

$query = "
    SELECT DISTINCT m.*, e.employee_name as organizer_name, e.email as organizer_email
    FROM meetings m
    JOIN employees e ON m.organizer_id = e.id
    LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
    WHERE $whereClause
    $orderBy
    LIMIT ? OFFSET ?
";

$params[] = $limit;
$params[] = $offset;
$types .= "ii";

$stmt = $conn->prepare($query);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

$meetings = [];
while ($row = $result->fetch_assoc()) {
    // Get participants for each meeting
    $participantStmt = $conn->prepare("
        SELECT mp.*, e.employee_name, e.email as employee_email
        FROM meeting_participants mp
        LEFT JOIN employees e ON mp.employee_id = e.id
        WHERE mp.meeting_id = ?
    ");
    $participantStmt->bind_param("i", $row['id']);
    $participantStmt->execute();
    $participants = $participantStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $participantStmt->close();

    $row['participants'] = array_map(function($p) {
        return [
            'id' => (int)$p['id'],
            'type' => $p['participant_type'],
            'rsvp_status' => $p['rsvp_status'],
            'employee_id' => $p['employee_id'] ? (int)$p['employee_id'] : null,
            'name' => $p['participant_type'] === 'internal' ? $p['employee_name'] : $p['external_name'],
            'email' => $p['participant_type'] === 'internal' ? $p['employee_email'] : $p['external_email']
        ];
    }, $participants);

    $row['is_organizer'] = ((int)$row['organizer_id'] === (int)$currentEmployee['id']);

    $meetings[] = $row;
}
$stmt->close();
$conn->close();

jsonResponse(true, [
    'meetings' => $meetings,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total' => (int)$totalCount,
        'totalPages' => ceil($totalCount / $limit)
    ]
]);
?>
