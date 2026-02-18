<?php
/**
 * Save Transcript API
 * Saves or updates meeting transcript
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
validateRequired(['meeting_id', 'transcript_text'], $input);

$meetingId = (int)$input['meeting_id'];
$transcriptText = $input['transcript_text']; // Don't sanitize - preserve formatting
$transcriptSource = sanitizeInput($input['transcript_source'] ?? 'web_speech_api');
$isFinalized = isset($input['is_finalized']) ? (bool)$input['is_finalized'] : false;
$appendMode = isset($input['append']) ? (bool)$input['append'] : false;

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

// Check if transcript exists
$stmt = $conn->prepare("SELECT id, transcript_text, is_finalized FROM meeting_transcripts WHERE meeting_id = ?");
$stmt->bind_param("i", $meetingId);
$stmt->execute();
$existing = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($existing) {
    // Cannot edit finalized transcript
    if ($existing['is_finalized'] && !$isFinalized) {
        jsonResponse(false, [], 'Cannot modify a finalized transcript');
    }

    // Append or replace
    $finalText = $appendMode ? $existing['transcript_text'] . "\n" . $transcriptText : $transcriptText;

    $stmt = $conn->prepare("
        UPDATE meeting_transcripts
        SET transcript_text = ?, transcript_source = ?, is_finalized = ?, updated_at = CURRENT_TIMESTAMP
        WHERE meeting_id = ?
    ");
    $stmt->bind_param("ssii", $finalText, $transcriptSource, $isFinalized, $meetingId);
    $stmt->execute();
    $stmt->close();

    $transcriptId = $existing['id'];
} else {
    $stmt = $conn->prepare("
        INSERT INTO meeting_transcripts (meeting_id, transcript_text, transcript_source, is_finalized)
        VALUES (?, ?, ?, ?)
    ");
    $stmt->bind_param("issi", $meetingId, $transcriptText, $transcriptSource, $isFinalized);
    $stmt->execute();
    $transcriptId = $conn->insert_id;
    $stmt->close();
}

// Get updated transcript
$stmt = $conn->prepare("SELECT * FROM meeting_transcripts WHERE id = ?");
$stmt->bind_param("i", $transcriptId);
$stmt->execute();
$transcript = $stmt->get_result()->fetch_assoc();
$stmt->close();

$conn->close();

jsonResponse(true, $transcript, 'Transcript saved successfully');
?>
