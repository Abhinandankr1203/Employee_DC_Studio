<?php
/**
 * Delete Annotation API
 * Deletes an annotation (only creator can delete)
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';

// Verify authentication
$currentEmployee = requireAuth();

// Handle DELETE/POST request
if (!in_array($_SERVER['REQUEST_METHOD'], ['DELETE', 'POST'])) {
    http_response_code(405);
    jsonResponse(false, [], 'Method not allowed');
}

// Get annotation ID
$input = json_decode(file_get_contents('php://input'), true);
$annotationId = $input['id'] ?? $_GET['id'] ?? 0;
$annotationId = (int)$annotationId;

if (!$annotationId) {
    http_response_code(400);
    jsonResponse(false, [], 'Annotation ID is required');
}

$conn = getDBConnection();

// Check if user owns this annotation
$stmt = $conn->prepare("SELECT * FROM meeting_annotations WHERE id = ? AND employee_id = ?");
$stmt->bind_param("ii", $annotationId, $currentEmployee['id']);
$stmt->execute();
$annotation = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$annotation) {
    http_response_code(403);
    jsonResponse(false, [], 'Annotation not found or you do not have permission to delete it');
}

// Delete annotation
$stmt = $conn->prepare("DELETE FROM meeting_annotations WHERE id = ?");
$stmt->bind_param("i", $annotationId);
$stmt->execute();
$stmt->close();

$conn->close();

jsonResponse(true, [], 'Annotation deleted successfully');
?>
