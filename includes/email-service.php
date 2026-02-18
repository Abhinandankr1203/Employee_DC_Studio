<?php
/**
 * Email Service using SendGrid
 * Handles sending meeting invitations with ICS attachments
 */

require_once __DIR__ . '/../config.php';

/**
 * Generate ICS calendar file content
 */
function generateICS($meeting, $organizer, $attendeeEmail) {
    $uid = uniqid('meeting-', true) . '@dcstudio.com';
    $dtstamp = gmdate('Ymd\THis\Z');

    // Parse date and time
    $startDateTime = new DateTime($meeting['meeting_date'] . ' ' . $meeting['start_time'], new DateTimeZone($meeting['timezone']));
    $endDateTime = new DateTime($meeting['meeting_date'] . ' ' . $meeting['end_time'], new DateTimeZone($meeting['timezone']));

    $dtstart = $startDateTime->format('Ymd\THis');
    $dtend = $endDateTime->format('Ymd\THis');

    $summary = str_replace(["\r", "\n"], '', $meeting['title']);
    $description = str_replace(["\r\n", "\r", "\n"], '\n', $meeting['description'] ?? '');

    $location = $meeting['google_meet_link'] ?? 'Online Meeting';

    $ics = "BEGIN:VCALENDAR\r\n";
    $ics .= "VERSION:2.0\r\n";
    $ics .= "PRODID:-//DC Studio//Meeting Alignment//EN\r\n";
    $ics .= "CALSCALE:GREGORIAN\r\n";
    $ics .= "METHOD:REQUEST\r\n";
    $ics .= "BEGIN:VTIMEZONE\r\n";
    $ics .= "TZID:" . $meeting['timezone'] . "\r\n";
    $ics .= "END:VTIMEZONE\r\n";
    $ics .= "BEGIN:VEVENT\r\n";
    $ics .= "UID:" . $uid . "\r\n";
    $ics .= "DTSTAMP:" . $dtstamp . "\r\n";
    $ics .= "DTSTART;TZID=" . $meeting['timezone'] . ":" . $dtstart . "\r\n";
    $ics .= "DTEND;TZID=" . $meeting['timezone'] . ":" . $dtend . "\r\n";
    $ics .= "SUMMARY:" . $summary . "\r\n";
    $ics .= "DESCRIPTION:" . $description . "\r\n";
    $ics .= "LOCATION:" . $location . "\r\n";
    $ics .= "ORGANIZER;CN=" . $organizer['employee_name'] . ":mailto:" . $organizer['email'] . "\r\n";
    $ics .= "ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:" . $attendeeEmail . "\r\n";
    $ics .= "STATUS:CONFIRMED\r\n";
    $ics .= "SEQUENCE:0\r\n";
    $ics .= "END:VEVENT\r\n";
    $ics .= "END:VCALENDAR\r\n";

    return $ics;
}

/**
 * Send meeting invitation email via SendGrid
 */
function sendMeetingInvite($meeting, $organizer, $participant) {
    $recipientEmail = $participant['participant_type'] === 'internal'
        ? $participant['employee_email']
        : $participant['external_email'];

    $recipientName = $participant['participant_type'] === 'internal'
        ? $participant['employee_name']
        : ($participant['external_name'] ?: $recipientEmail);

    if (!$recipientEmail) {
        return ['error' => 'No email address for participant'];
    }

    // Format date and time for display
    $meetingDate = date('l, F j, Y', strtotime($meeting['meeting_date']));
    $startTime = date('g:i A', strtotime($meeting['start_time']));
    $endTime = date('g:i A', strtotime($meeting['end_time']));

    // Generate ICS content
    $icsContent = generateICS($meeting, $organizer, $recipientEmail);

    // Build email HTML
    $meetLink = $meeting['google_meet_link']
        ? '<p><strong>Join Meeting:</strong> <a href="' . $meeting['google_meet_link'] . '">' . $meeting['google_meet_link'] . '</a></p>'
        : '';

    $htmlContent = '
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #eb7846; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .meeting-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .meeting-details p { margin: 10px 0; }
            .btn { display: inline-block; padding: 12px 24px; background: #eb7846; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>' . htmlspecialchars($meeting['title']) . '</h1>
            </div>
            <div class="content">
                <p>Hi ' . htmlspecialchars($recipientName) . ',</p>
                <p>You have been invited to a meeting by <strong>' . htmlspecialchars($organizer['employee_name']) . '</strong>.</p>

                <div class="meeting-details">
                    <p><strong>Date:</strong> ' . $meetingDate . '</p>
                    <p><strong>Time:</strong> ' . $startTime . ' - ' . $endTime . ' (' . $meeting['timezone'] . ')</p>
                    ' . $meetLink . '
                    ' . ($meeting['description'] ? '<p><strong>Description:</strong><br>' . nl2br(htmlspecialchars($meeting['description'])) . '</p>' : '') . '
                </div>

                <p>Please add this meeting to your calendar using the attached .ics file or by clicking the button below.</p>

                ' . ($meeting['google_meet_link'] ? '<a href="' . $meeting['google_meet_link'] . '" class="btn">Join Meeting</a>' : '') . '
            </div>
            <div class="footer">
                <p>This invitation was sent from DC Studio Employee Portal</p>
                <p>&copy; ' . date('Y') . ' DC Studio. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>';

    $textContent = "You have been invited to: {$meeting['title']}\n\n"
        . "Date: {$meetingDate}\n"
        . "Time: {$startTime} - {$endTime} ({$meeting['timezone']})\n"
        . ($meeting['google_meet_link'] ? "Join: {$meeting['google_meet_link']}\n" : '')
        . ($meeting['description'] ? "\nDescription:\n{$meeting['description']}\n" : '')
        . "\nOrganizer: {$organizer['employee_name']}\n";

    // SendGrid API request
    $data = [
        'personalizations' => [[
            'to' => [['email' => $recipientEmail, 'name' => $recipientName]],
            'subject' => 'Meeting Invitation: ' . $meeting['title']
        ]],
        'from' => [
            'email' => SENDGRID_FROM_EMAIL,
            'name' => SENDGRID_FROM_NAME
        ],
        'reply_to' => [
            'email' => $organizer['email'],
            'name' => $organizer['employee_name']
        ],
        'content' => [
            ['type' => 'text/plain', 'value' => $textContent],
            ['type' => 'text/html', 'value' => $htmlContent]
        ],
        'attachments' => [[
            'content' => base64_encode($icsContent),
            'filename' => 'meeting.ics',
            'type' => 'text/calendar',
            'disposition' => 'attachment'
        ]]
    ];

    $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . SENDGRID_API_KEY,
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // SendGrid returns 202 for accepted
    if ($httpCode === 202 || $httpCode === 200) {
        return ['success' => true, 'email' => $recipientEmail];
    }

    return ['error' => 'Failed to send email', 'code' => $httpCode, 'response' => $response];
}

/**
 * Send meeting invites to all participants
 */
function sendAllMeetingInvites($meetingId) {
    $conn = getDBConnection();

    // Get meeting details
    $stmt = $conn->prepare("
        SELECT m.*, e.employee_name, e.email
        FROM meetings m
        JOIN employees e ON m.organizer_id = e.id
        WHERE m.id = ?
    ");
    $stmt->bind_param("i", $meetingId);
    $stmt->execute();
    $meeting = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$meeting) {
        return ['error' => 'Meeting not found'];
    }

    $organizer = [
        'employee_name' => $meeting['employee_name'],
        'email' => $meeting['email']
    ];

    // Get participants (excluding organizer)
    $stmt = $conn->prepare("
        SELECT mp.*, e.employee_name, e.email as employee_email
        FROM meeting_participants mp
        LEFT JOIN employees e ON mp.employee_id = e.id
        WHERE mp.meeting_id = ? AND mp.employee_id != ?
    ");
    $stmt->bind_param("ii", $meetingId, $meeting['organizer_id']);
    $stmt->execute();
    $participants = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $results = [
        'sent' => [],
        'failed' => []
    ];

    foreach ($participants as $participant) {
        $result = sendMeetingInvite($meeting, $organizer, $participant);

        if (isset($result['success'])) {
            $results['sent'][] = $result['email'];

            // Update invite_sent_at
            $updateStmt = $conn->prepare("UPDATE meeting_participants SET invite_sent_at = CURRENT_TIMESTAMP WHERE id = ?");
            $updateStmt->bind_param("i", $participant['id']);
            $updateStmt->execute();
            $updateStmt->close();
        } else {
            $results['failed'][] = [
                'email' => $participant['employee_email'] ?? $participant['external_email'],
                'error' => $result['error']
            ];
        }
    }

    $conn->close();

    return $results;
}
?>
