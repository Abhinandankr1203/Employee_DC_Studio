<?php
/**
 * Create Annotation API
 * Adds a new annotation/note to a meeting
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
    $input = $_POST;
}

// Validate required fields
validateRequired(['meeting_id', 'annotation_text'], $input);

$meetingId = (int)$input['meeting_id'];
$annotationText = sanitizeInput($input['annotation_text']);
$timestampSeconds = isset($input['timestamp_seconds']) ? (int)$input['timestamp_seconds'] : 0;
$annotationType = sanitizeInput($input['annotation_type'] ?? 'note');

// Validate annotation type
$validTypes = ['note', 'action_item', 'decision', 'question', 'important'];
if (!in_array($annotationType, $validTypes)) {
    $annotationType = 'note';
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

// Insert annotation
$stmt = $conn->prepare("
    INSERT INTO meeting_annotations (meeting_id, employee_id, annotation_text, timestamp_seconds, annotation_type)
    VALUES (?, ?, ?, ?, ?)
");
$stmt->bind_param("iisis", $meetingId, $currentEmployee['id'], $annotationText, $timestampSeconds, $annotationType);
$stmt->execute();
$annotationId = $conn->insert_id;
$stmt->close();

// Get created annotation with employee info
$stmt = $conn->prepare("
    SELECT ma.*, e.employee_name
    FROM meeting_annotations ma
    JOIN employees e ON ma.employee_id = e.id
    WHERE ma.id = ?
");
$stmt->bind_param("i", $annotationId);
$stmt->execute();
$annotation = $stmt->get_result()->fetch_assoc();
$stmt->close();

$conn->close();

jsonResponse(true, $annotation, 'Annotation added successfully');
?>
