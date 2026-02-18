<?php
/**
 * Delete/Cancel Meeting API
 * Cancels a meeting (only organizer can cancel)
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';

// Verify authentication
$currentEmployee = requireAuth();

// Handle DELETE/POST request
if (!in_array($_SERVER['REQUEST_METHOD'], ['DELETE', 'POST'])) {
    http_response_code(405);
    jsonResponse(false, [], 'Method not allowed');
}

// Get meeting ID
$input = json_decode(file_get_contents('php://input'), true);
$meetingId = $input['id'] ?? $_GET['id'] ?? 0;
$meetingId = (int)$meetingId;

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
    jsonResponse(false, [], 'Only the meeting organizer can cancel this meeting');
}

// Cannot cancel already cancelled or completed meetings
if ($meeting['status'] === 'cancelled') {
    jsonResponse(false, [], 'Meeting is already cancelled');
}

if ($meeting['status'] === 'completed') {
    jsonResponse(false, [], 'Cannot cancel a completed meeting');
}

// Check if hard delete is requested (permanently remove)
$hardDelete = isset($input['hard_delete']) && $input['hard_delete'] === true;

if ($hardDelete) {
    // Permanently delete the meeting and all related data
    $stmt = $conn->prepare("DELETE FROM meetings WHERE id = ?");
    $stmt->bind_param("i", $meetingId);
    $stmt->execute();
    $stmt->close();

    jsonResponse(true, [], 'Meeting permanently deleted');
} else {
    // Soft delete - just change status to cancelled
    $stmt = $conn->prepare("UPDATE meetings SET status = 'cancelled' WHERE id = ?");
    $stmt->bind_param("i", $meetingId);
    $stmt->execute();
    $stmt->close();

    jsonResponse(true, [], 'Meeting cancelled successfully');
}

$conn->close();
?>
