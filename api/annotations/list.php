<?php
/**
 * List Annotations API
 * Retrieves all annotations for a meeting
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
$type = isset($_GET['type']) ? sanitizeInput($_GET['type']) : null;

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

// Build query
$query = "
    SELECT ma.*, e.employee_name
    FROM meeting_annotations ma
    JOIN employees e ON ma.employee_id = e.id
    WHERE ma.meeting_id = ?
";
$params = [$meetingId];
$types = "i";

if ($type) {
    $query .= " AND ma.annotation_type = ?";
    $params[] = $type;
    $types .= "s";
}

$query .= " ORDER BY ma.timestamp_seconds ASC, ma.created_at ASC";

$stmt = $conn->prepare($query);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$annotations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// Get counts by type
$stmt = $conn->prepare("
    SELECT annotation_type, COUNT(*) as count
    FROM meeting_annotations
    WHERE meeting_id = ?
    GROUP BY annotation_type
");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$counts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$countsByType = [];
foreach ($counts as $c) {
    $countsByType[$c['annotation_type']] = (int)$c['count'];
}

$conn->close();

jsonResponse(true, [
    'annotations' => $annotations,
    'counts' => $countsByType,
    'total' => count($annotations)
]);
?>
