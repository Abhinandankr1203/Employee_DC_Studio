<?php
function getTaskAssignees(PDO $db, int $taskId): array {
    $stmt = $db->prepare('SELECT employee_id, employee_name FROM task_assignees WHERE task_id = ?');
    $stmt->execute([$taskId]);
    $rows = $stmt->fetchAll();
    return [
        'assignee_ids'   => array_map(fn($r) => (int)$r['employee_id'], $rows),
        'assignee_names' => array_map(fn($r) => $r['employee_name'], $rows),
    ];
}

function formatTask(array $t, PDO $db): array {
    $a = getTaskAssignees($db, (int)$t['id']);
    return [
        'id'             => (int)$t['id'],
        'title'          => $t['title'],
        'description'    => $t['description'] ?? '',
        'priority'       => $t['priority'],
        'status'         => $t['status'],
        'due_date'       => $t['due_date'],
        'project'        => $t['project_code'],
        'assignee_ids'   => $a['assignee_ids'],
        'assignee_names' => $a['assignee_names'],
        'created_at'     => $t['created_at'],
        'updated_at'     => $t['updated_at'],
    ];
}

function handleTasks(string $method, ?string $id, ?string $sub, array $session): void {
    $db    = getDB();
    $body  = getBody();
    $query = $_GET;

    // PATCH /api/tasks/:id/status
    if ($id && $sub === 'status' && $method === 'PATCH') {
        $newStatus = $body['status'] ?? '';
        $allowed   = ['to-do','in-progress','done','pending-approval'];
        if (!in_array($newStatus, $allowed)) jsonResponse(['error' => 'Invalid status'], 400);

        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
        $stmt->execute([$id]);
        $task = $stmt->fetch();
        if (!$task) jsonResponse(['error' => 'Task not found'], 404);

        // Non-admin marking done → pending-approval
        if ($newStatus === 'done' && !isAdmin($session)) {
            $db->prepare("UPDATE tasks SET status='pending-approval', updated_at=NOW() WHERE id=?")->execute([$id]);
            jsonResponse(['success' => true, 'approval_pending' => true]);
        }

        $db->prepare('UPDATE tasks SET status=?, updated_at=NOW() WHERE id=?')->execute([$newStatus, $id]);
        jsonResponse(['success' => true]);
    }

    // GET /api/tasks
    if (!$id && $method === 'GET') {
        $sql    = 'SELECT t.* FROM tasks t';
        $params = [];

        // Non-admin only sees their tasks
        if (!isAdmin($session)) {
            $empId = getEmployeeId($session['email']);
            if ($empId === null) jsonResponse(['tasks' => [], 'counts' => ['total'=>0,'to-do'=>0,'in-progress'=>0,'done'=>0]]);
            $sql .= ' JOIN task_assignees ta ON ta.task_id = t.id AND ta.employee_id = ?';
            $params[] = $empId;
        }

        $where = [];
        if (!empty($query['priority'])) { $where[] = 't.priority = ?'; $params[] = $query['priority']; }
        if (!empty($query['project']))  { $where[] = 't.project_code = ?'; $params[] = $query['project']; }
        if (!empty($query['assignee_id'])) {
            $sql .= (isAdmin($session) ? ' JOIN task_assignees ta2 ON ta2.task_id = t.id AND ta2.employee_id = ?' : ' AND ta.employee_id = ?');
            if (isAdmin($session)) $params[] = (int)$query['assignee_id'];
        }
        if (!empty($query['search'])) {
            $s = '%' . substr($query['search'], 0, 100) . '%';
            $where[] = '(t.title LIKE ? OR t.description LIKE ?)';
            $params[] = $s; $params[] = $s;
        }

        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' GROUP BY t.id ORDER BY t.created_at DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $allTasks = $stmt->fetchAll();

        // Counts before status filter
        $counts = ['total' => count($allTasks), 'to-do' => 0, 'in-progress' => 0, 'done' => 0];
        foreach ($allTasks as $t) {
            if (isset($counts[$t['status']])) $counts[$t['status']]++;
        }

        if (!empty($query['status'])) {
            $allTasks = array_values(array_filter($allTasks, fn($t) => $t['status'] === $query['status']));
        }

        $formatted = array_map(fn($t) => formatTask($t, $db), $allTasks);
        jsonResponse(['tasks' => $formatted, 'total' => count($formatted), 'counts' => $counts]);
    }

    // GET /api/tasks/:id
    if ($id && !$sub && $method === 'GET') {
        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
        $stmt->execute([$id]);
        $task = $stmt->fetch();
        if (!$task) jsonResponse(['error' => 'Task not found'], 404);
        jsonResponse(['task' => formatTask($task, $db)]);
    }

    // POST /api/tasks
    if (!$id && $method === 'POST') {
        $title = trim($body['title'] ?? '');
        if (!$title) jsonResponse(['error' => 'Title is required'], 400);

        $priorities = ['low','medium','high'];
        $statuses   = ['to-do','in-progress','done'];

        $db->prepare('INSERT INTO tasks (title,description,priority,status,due_date,project_code) VALUES (?,?,?,?,?,?)')
           ->execute([
               $title,
               trim($body['description'] ?? ''),
               in_array($body['priority'] ?? '', $priorities) ? $body['priority'] : 'medium',
               in_array($body['status'] ?? '', $statuses)   ? $body['status']   : 'to-do',
               !empty($body['due_date']) ? $body['due_date'] : null,
               !empty($body['project']) ? $body['project'] : null,
           ]);
        $taskId = (int)$db->lastInsertId();

        // Insert assignees
        $ids   = array_map('intval', (array)($body['assignee_ids'] ?? []));
        $names = (array)($body['assignee_names'] ?? []);
        foreach ($ids as $i => $eid) {
            $db->prepare('INSERT IGNORE INTO task_assignees (task_id,employee_id,employee_name) VALUES (?,?,?)')
               ->execute([$taskId, $eid, $names[$i] ?? '']);
        }

        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
        $stmt->execute([$taskId]);
        jsonResponse(['success' => true, 'task' => formatTask($stmt->fetch(), $db)], 201);
    }

    // PUT /api/tasks/:id
    if ($id && !$sub && $method === 'PUT') {
        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) jsonResponse(['error' => 'Task not found'], 404);

        $priorities = ['low','medium','high'];
        $statuses   = ['to-do','in-progress','done'];
        $fields = []; $params = [];

        if (isset($body['title']))       { $fields[] = 'title=?';       $params[] = trim($body['title']); }
        if (isset($body['description'])) { $fields[] = 'description=?'; $params[] = trim($body['description']); }
        if (isset($body['priority']) && in_array($body['priority'], $priorities)) { $fields[] = 'priority=?'; $params[] = $body['priority']; }
        if (isset($body['status'])   && in_array($body['status'], $statuses))     { $fields[] = 'status=?';   $params[] = $body['status']; }
        if (array_key_exists('due_date', $body)) { $fields[] = 'due_date=?'; $params[] = $body['due_date'] ?: null; }
        if (array_key_exists('project', $body))  { $fields[] = 'project_code=?'; $params[] = $body['project'] ?: null; }

        if ($fields) {
            $fields[] = 'updated_at=NOW()';
            $params[] = $id;
            $db->prepare('UPDATE tasks SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
        }

        // Update assignees
        if (isset($body['assignee_ids'])) {
            $db->prepare('DELETE FROM task_assignees WHERE task_id=?')->execute([$id]);
            $ids   = array_map('intval', (array)$body['assignee_ids']);
            $names = (array)($body['assignee_names'] ?? []);
            foreach ($ids as $i => $eid) {
                $db->prepare('INSERT IGNORE INTO task_assignees (task_id,employee_id,employee_name) VALUES (?,?,?)')
                   ->execute([$id, $eid, $names[$i] ?? '']);
            }
        }

        $stmt = $db->prepare('SELECT * FROM tasks WHERE id=?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'task' => formatTask($stmt->fetch(), $db)]);
    }

    // DELETE /api/tasks/:id
    if ($id && !$sub && $method === 'DELETE') {
        $db->prepare('DELETE FROM tasks WHERE id=?')->execute([$id]);
        jsonResponse(['success' => true]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
