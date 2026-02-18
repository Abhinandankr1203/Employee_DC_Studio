-- Create Database
CREATE DATABASE IF NOT EXISTS dc_studio_employee;
USE dc_studio_employee;

-- Create Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    department VARCHAR(50),
    designation VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- DUMMY TEST USER CREDENTIALS:
-- Email:    test@dcstudio.com
-- Password: test123
-- ================================================

-- Insert Dummy Test User (password: test123)
INSERT INTO employees (employee_name, email, password, department, designation) VALUES
('Rahul Sharma', 'test@dcstudio.com', '$2y$10$8K1p0a0dL1LXMIgoH1TJHOFfHiYQ5Pq8kL8vx3IiVjHHKqK6Wm6u', 'Design', 'Senior Designer');

-- ================================================
-- MEETING ALIGNMENT FEATURE TABLES
-- ================================================

-- Main meetings table
CREATE TABLE IF NOT EXISTS meetings (
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
);

-- Participants (internal + external)
CREATE TABLE IF NOT EXISTS meeting_participants (
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
);

-- Google OAuth tokens (encrypted)
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Meeting transcripts
CREATE TABLE IF NOT EXISTS meeting_transcripts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL,
    transcript_text LONGTEXT,
    transcript_source ENUM('web_speech_api', 'whisper', 'assemblyai', 'manual') DEFAULT 'web_speech_api',
    is_finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Annotations/notes during meetings
CREATE TABLE IF NOT EXISTS meeting_annotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL,
    employee_id INT NOT NULL,
    annotation_text TEXT NOT NULL,
    timestamp_seconds INT DEFAULT 0,
    annotation_type ENUM('note', 'action_item', 'decision', 'question', 'important') DEFAULT 'note',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_meetings_organizer ON meetings(organizer_id);
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX idx_participants_employee ON meeting_participants(employee_id);
CREATE INDEX idx_annotations_meeting ON meeting_annotations(meeting_id);
CREATE INDEX idx_transcripts_meeting ON meeting_transcripts(meeting_id);
