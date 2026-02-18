<?php
/**
 * Database Migration Script
 * Run this to create the meeting alignment tables
 */

require_once 'config.php';

echo "Starting database migration...\n\n";

$conn = getDBConnection();

// Meeting tables SQL
$migrations = [
    // Main meetings table
    "CREATE TABLE IF NOT EXISTS meetings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        organizer_id INT NOT NULL,
        meeting_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
        google_event_id VARCHAR(255),
        google_meet_link VARCHAR(500),
        status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organizer_id) REFERENCES employees(id) ON DELETE CASCADE
    )",

    // Participants table
    "CREATE TABLE IF NOT EXISTS meeting_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meeting_id INT NOT NULL,
        employee_id INT NULL,
        external_email VARCHAR(255),
        external_name VARCHAR(100),
        participant_type ENUM('internal', 'external') NOT NULL,
        rsvp_status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
        invite_sent_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    )",

    // Google OAuth tokens table
    "CREATE TABLE IF NOT EXISTS google_oauth_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_type VARCHAR(50),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )",

    // Meeting transcripts table
    "CREATE TABLE IF NOT EXISTS meeting_transcripts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meeting_id INT NOT NULL,
        transcript_text LONGTEXT,
        transcript_source ENUM('web_speech_api', 'whisper', 'assemblyai', 'manual') DEFAULT 'web_speech_api',
        is_finalized BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )",

    // Meeting annotations table
    "CREATE TABLE IF NOT EXISTS meeting_annotations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meeting_id INT NOT NULL,
        employee_id INT NOT NULL,
        annotation_text TEXT NOT NULL,
        timestamp_seconds INT DEFAULT 0,
        annotation_type ENUM('note', 'action_item', 'decision', 'question', 'important') DEFAULT 'note',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )"
];

// Indexes to create (with error suppression for duplicates)
$indexes = [
    "CREATE INDEX idx_meetings_organizer ON meetings(organizer_id)",
    "CREATE INDEX idx_meetings_date ON meetings(meeting_date)",
    "CREATE INDEX idx_meetings_status ON meetings(status)",
    "CREATE INDEX idx_participants_meeting ON meeting_participants(meeting_id)",
    "CREATE INDEX idx_participants_employee ON meeting_participants(employee_id)",
    "CREATE INDEX idx_annotations_meeting ON meeting_annotations(meeting_id)",
    "CREATE INDEX idx_transcripts_meeting ON meeting_transcripts(meeting_id)"
];

$success = 0;
$failed = 0;

// Run table migrations
foreach ($migrations as $i => $sql) {
    $tableMatch = [];
    preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/', $sql, $tableMatch);
    $tableName = $tableMatch[1] ?? "Table " . ($i + 1);

    echo "Creating table: $tableName... ";

    if ($conn->query($sql)) {
        echo "OK\n";
        $success++;
    } else {
        echo "FAILED: " . $conn->error . "\n";
        $failed++;
    }
}

echo "\n";

// Run index migrations (suppress duplicate index errors)
foreach ($indexes as $sql) {
    $indexMatch = [];
    preg_match('/CREATE INDEX (\w+)/', $sql, $indexMatch);
    $indexName = $indexMatch[1] ?? "Index";

    echo "Creating index: $indexName... ";

    if ($conn->query($sql)) {
        echo "OK\n";
        $success++;
    } else {
        if (strpos($conn->error, 'Duplicate') !== false) {
            echo "SKIPPED (already exists)\n";
        } else {
            echo "FAILED: " . $conn->error . "\n";
            $failed++;
        }
    }
}

$conn->close();

echo "\n========================================\n";
echo "Migration completed!\n";
echo "Success: $success\n";
echo "Failed: $failed\n";
echo "========================================\n";

if ($failed === 0) {
    echo "\nAll tables created successfully!\n";
} else {
    echo "\nSome migrations failed. Please check the errors above.\n";
}
?>
