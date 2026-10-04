<?php
function handleCalendar(string $method, ?string $id, array $session): void {
    $db    = getDB();
    $query = $_GET;

    // GET /api/calendar/combined
    if ($id === 'combined' && $method === 'GET') {
        $year  = (int)($query['year']  ?? date('Y'));
        $month = (int)($query['month'] ?? date('n'));
        $combined = [];
        $empId = isAdminOrManager($session) ? null : getEmployeeId($session['email']);

        // Tasks due this month
        $sql    = 'SELECT t.id, t.title, t.due_date, t.priority, t.status, ta.employee_name FROM tasks t LEFT JOIN task_assignees ta ON ta.task_id=t.id WHERE YEAR(t.due_date)=? AND MONTH(t.due_date)=?';
        $params = [$year, $month];
        if ($empId !== null) { $sql .= ' AND ta.employee_id=?'; $params[] = $empId; }
        $sql .= ' GROUP BY t.id';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        foreach ($stmt->fetchAll() as $t) {
            $combined[] = [
                'id'          => 't-' . $t['id'],
                'title'       => $t['title'],
                'type'        => 'task',
                'date'        => $t['due_date'],
                'priority'    => $t['priority'],
                'status'      => $t['status'],
                'assignee'    => $t['employee_name'],
                'description' => '',
                'source'      => 'local',
            ];
        }

        // Meetings this month
        $sql2 = 'SELECT m.* FROM meetings m WHERE YEAR(m.meeting_date)=? AND MONTH(m.meeting_date)=?';
        $params2 = [$year, $month];
        if ($empId !== null) {
            $sql2 .= ' AND m.id IN (SELECT meeting_id FROM meeting_participants WHERE employee_id=?)';
            $params2[] = $empId;
        }
        $stmt2 = $db->prepare($sql2);
        $stmt2->execute($params2);
        foreach ($stmt2->fetchAll() as $m) {
            $combined[] = [
                'id'          => 'm-' . $m['id'],
                'title'       => $m['title'],
                'type'        => 'meeting',
                'date'        => $m['meeting_date'],
                'startTime'   => $m['start_time'],
                'endTime'     => $m['end_time'],
                'meetLink'    => $m['google_meet_link'],
                'description' => $m['description'] ?? '',
                'status'      => $m['status'],
                'source'      => 'local',
            ];
        }

        // Project deadlines this month
        $sql3 = 'SELECT p.* FROM projects p WHERE YEAR(p.end_date)=? AND MONTH(p.end_date)=?';
        $params3 = [$year, $month];
        if ($empId !== null) {
            $sql3 .= ' AND p.id IN (SELECT project_id FROM project_team_members WHERE employee_id=?)';
            $params3[] = $empId;
        }
        $stmt3 = $db->prepare($sql3);
        $stmt3->execute($params3);
        foreach ($stmt3->fetchAll() as $p) {
            $combined[] = [
                'id'          => 'p-' . $p['id'],
                'title'       => $p['name'] . ' — Deadline',
                'type'        => 'project',
                'date'        => $p['end_date'],
                'status'      => $p['status'],
                'client'      => $p['client'],
                'description' => 'Project deadline · ' . ($p['client'] ?? ''),
                'source'      => 'local',
            ];
        }

        // Sort by date
        usort($combined, fn($a,$b) => strcmp($a['date'],$b['date']));
        jsonResponse(['events' => $combined]);
    }

    // GET /api/calendar/events
    if ($id === 'events' && $method === 'GET') {
        jsonResponse(['events' => []]);
    }

    // POST /api/calendar/events
    if ($id === 'events' && $method === 'POST') {
        jsonResponse(['success' => true, 'event' => []]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
