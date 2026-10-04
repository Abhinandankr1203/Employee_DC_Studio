<?php
function formatMeeting(array $m, PDO $db): array {
    $stmt = $db->prepare('SELECT * FROM meeting_participants WHERE meeting_id=?');
    $stmt->execute([$m['id']]);
    $participants = array_map(function($p) {
        return [
            'employee_id' => $p['employee_id'] ? (int)$p['employee_id'] : null,
            'name'        => $p['name'],
            'email'       => $p['email'],
            'type'        => $p['type'],
        ];
    }, $stmt->fetchAll());

    return [
        'id'              => (int)$m['id'],
        'title'           => $m['title'],
        'description'     => $m['description'],
        'meeting_date'    => $m['meeting_date'],
        'start_time'      => $m['start_time'],
        'end_time'        => $m['end_time'],
        'timezone'        => $m['timezone'],
        'status'          => $m['status'],
        'organizer_name'  => $m['organizer_name'],
        'organizer_email' => $m['organizer_email'],
        'google_meet_link'=> $m['google_meet_link'],
        'participants'    => $participants,
        'created_at'      => $m['created_at'],
        'updated_at'      => $m['updated_at'],
    ];
}

function handleMeetings(string $method, ?string $id, array $session): void {
    $db   = getDB();
    $body = getBody();

    // GET /api/meetings
    if (!$id && $method === 'GET') {
        $stmt = $db->query('SELECT * FROM meetings ORDER BY meeting_date DESC');
        $meetings = array_map(fn($m) => formatMeeting($m, $db), $stmt->fetchAll());
        jsonResponse(['meetings' => $meetings]);
    }

    // POST /api/meetings
    if (!$id && $method === 'POST') {
        $title = trim($body['title'] ?? '');
        if (!$title) jsonResponse(['error' => 'Title required'], 400);

        $db->prepare('INSERT INTO meetings (title,description,meeting_date,start_time,end_time,timezone,status,organizer_name,organizer_email,google_meet_link) VALUES (?,?,?,?,?,?,?,?,?,?)')
           ->execute([
               $title, $body['description'] ?? null,
               $body['meeting_date'] ?? null,
               $body['start_time'] ?? null, $body['end_time'] ?? null,
               $body['timezone'] ?? 'Asia/Kolkata',
               $body['status'] ?? 'scheduled',
               $body['organizer_name'] ?? $session['name'],
               $body['organizer_email'] ?? $session['email'],
               $body['google_meet_link'] ?? null,
           ]);
        $mid = (int)$db->lastInsertId();

        // Participants
        foreach ((array)($body['participants'] ?? []) as $p) {
            $db->prepare('INSERT INTO meeting_participants (meeting_id,employee_id,name,email,type) VALUES (?,?,?,?,?)')
               ->execute([$mid, $p['employee_id'] ?? null, $p['name'] ?? '', $p['email'] ?? null, $p['type'] ?? 'internal']);
        }

        $stmt = $db->prepare('SELECT * FROM meetings WHERE id=?');
        $stmt->execute([$mid]);
        jsonResponse(['success' => true, 'meeting' => formatMeeting($stmt->fetch(), $db)], 201);
    }

    // PUT /api/meetings/:id
    if ($id && $method === 'PUT') {
        $stmt = $db->prepare('SELECT * FROM meetings WHERE id=?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) jsonResponse(['error' => 'Not found'], 404);

        $db->prepare('UPDATE meetings SET title=?,description=?,meeting_date=?,start_time=?,end_time=?,status=?,organizer_name=?,organizer_email=?,google_meet_link=?,updated_at=NOW() WHERE id=?')
           ->execute([
               $body['title'] ?? '', $body['description'] ?? null,
               $body['meeting_date'] ?? null, $body['start_time'] ?? null, $body['end_time'] ?? null,
               $body['status'] ?? 'scheduled', $body['organizer_name'] ?? '', $body['organizer_email'] ?? null,
               $body['google_meet_link'] ?? null, $id,
           ]);

        if (isset($body['participants'])) {
            $db->prepare('DELETE FROM meeting_participants WHERE meeting_id=?')->execute([$id]);
            foreach ((array)$body['participants'] as $p) {
                $db->prepare('INSERT INTO meeting_participants (meeting_id,employee_id,name,email,type) VALUES (?,?,?,?,?)')
                   ->execute([$id, $p['employee_id'] ?? null, $p['name'] ?? '', $p['email'] ?? null, $p['type'] ?? 'internal']);
            }
        }

        $stmt = $db->prepare('SELECT * FROM meetings WHERE id=?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'meeting' => formatMeeting($stmt->fetch(), $db)]);
    }

    // DELETE /api/meetings/:id
    if ($id && $method === 'DELETE') {
        $db->prepare('DELETE FROM meetings WHERE id=?')->execute([$id]);
        jsonResponse(['success' => true]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
