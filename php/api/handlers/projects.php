<?php
function formatProject(array $p, PDO $db): array {
    $phases = json_decode($p['phases_done'] ?? '[]', true) ?? [];
    $stmt   = $db->prepare('SELECT employee_id FROM project_team_members WHERE project_id=?');
    $stmt->execute([$p['id']]);
    $teamIds = array_column($stmt->fetchAll(), 'employee_id');

    return [
        'id'             => (int)$p['id'],
        'code'           => $p['code'],
        'name'           => $p['name'],
        'client'         => $p['client'],
        'client_email'   => $p['client_email'],
        'client_phone'   => $p['client_phone'],
        'location'       => $p['location'],
        'area_sqft'      => $p['area_sqft'] ? (int)$p['area_sqft'] : null,
        'description'    => $p['description'],
        'current_phase'  => $p['current_phase'],
        'phases_done'    => $phases,
        'start_date'     => $p['start_date'],
        'end_date'       => $p['end_date'],
        'status'         => $p['status'],
        'project_type'   => $p['project_type'],
        'po_number'      => $p['po_number'],
        'po_date'        => $p['po_date'],
        'billing_address'=> $p['billing_address'],
        'ship_to_gstin'  => $p['ship_to_gstin'],
        'site_name'      => $p['site_name'],
        'site_address'   => $p['site_address'],
        'team_member_ids'=> array_map('intval', $teamIds),
        'created_at'     => $p['created_at'],
        'updated_at'     => $p['updated_at'],
    ];
}

function handleProjects(string $method, ?string $id, ?string $sub, array $session): void {
    $db    = getDB();
    $body  = getBody();
    $query = $_GET;

    // GET /api/projects/clients
    if ($id === 'clients' && $method === 'GET') {
        $stmt = $db->query('SELECT DISTINCT client, client_email FROM projects WHERE client IS NOT NULL ORDER BY client');
        $rows = $stmt->fetchAll();
        jsonResponse(['clients' => $rows]);
    }

    // GET /api/projects
    if (!$id && $method === 'GET') {
        $sql = 'SELECT * FROM projects';
        $params = [];
        $where  = [];

        if (!isAdminOrManager($session)) {
            $empId = getEmployeeId($session['email']);
            if ($empId === null) jsonResponse(['projects' => [], 'total' => 0]);
            $sql .= ' WHERE id IN (SELECT project_id FROM project_team_members WHERE employee_id=?)';
            $params[] = $empId;
            if (!empty($query['status'])) {
                $sql .= ' AND status=?'; $params[] = $query['status'];
            }
        } else {
            if (!empty($query['status'])) { $where[] = 'status=?'; $params[] = $query['status']; }
            if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY created_at DESC';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $formatted = array_map(fn($p) => formatProject($p, $db), $rows);
        jsonResponse(['projects' => $formatted, 'total' => count($formatted)]);
    }

    // GET /api/projects/:id
    if ($id && !$sub && $method === 'GET') {
        $stmt = $db->prepare('SELECT * FROM projects WHERE id=?');
        $stmt->execute([$id]);
        $p = $stmt->fetch();
        if (!$p) jsonResponse(['error' => 'Not found'], 404);
        jsonResponse(['project' => formatProject($p, $db)]);
    }

    // POST /api/projects
    if (!$id && $method === 'POST') {
        if (!isAdminOrManager($session)) jsonResponse(['error' => 'Access denied'], 403);
        $code = strtoupper(trim($body['code'] ?? ''));
        $name = trim($body['name'] ?? '');
        if (!$code || !$name) jsonResponse(['error' => 'Code and name required'], 400);

        $db->prepare('INSERT INTO projects (code,name,client,client_email,client_phone,location,area_sqft,description,current_phase,phases_done,start_date,end_date,status,project_type,po_number,po_date,billing_address,ship_to_gstin,site_name,site_address) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
           ->execute([
               $code, $name,
               $body['client'] ?? null, $body['client_email'] ?? null, $body['client_phone'] ?? null,
               $body['location'] ?? null, $body['area_sqft'] ?? null, $body['description'] ?? null,
               $body['current_phase'] ?? 'concept',
               json_encode($body['phases_done'] ?? []),
               $body['start_date'] ?? null, $body['end_date'] ?? null,
               $body['status'] ?? 'active',
               $body['project_type'] ?? null, $body['po_number'] ?? null, $body['po_date'] ?? null,
               $body['billing_address'] ?? null, $body['ship_to_gstin'] ?? null,
               $body['site_name'] ?? null, $body['site_address'] ?? null,
           ]);
        $pid = (int)$db->lastInsertId();

        // Team members
        foreach ((array)($body['team_member_ids'] ?? []) as $eid) {
            $db->prepare('INSERT IGNORE INTO project_team_members (project_id,employee_id) VALUES (?,?)')->execute([$pid, (int)$eid]);
        }

        $stmt = $db->prepare('SELECT * FROM projects WHERE id=?');
        $stmt->execute([$pid]);
        jsonResponse(['success' => true, 'project' => formatProject($stmt->fetch(), $db)], 201);
    }

    // PUT /api/projects/:id
    if ($id && !$sub && $method === 'PUT') {
        if (!isAdminOrManager($session)) jsonResponse(['error' => 'Access denied'], 403);
        $stmt = $db->prepare('SELECT * FROM projects WHERE id=?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) jsonResponse(['error' => 'Not found'], 404);

        $db->prepare('UPDATE projects SET name=?,client=?,client_email=?,client_phone=?,location=?,area_sqft=?,description=?,current_phase=?,phases_done=?,start_date=?,end_date=?,status=?,project_type=?,po_number=?,po_date=?,billing_address=?,ship_to_gstin=?,site_name=?,site_address=?,updated_at=NOW() WHERE id=?')
           ->execute([
               $body['name'] ?? '', $body['client'] ?? null, $body['client_email'] ?? null, $body['client_phone'] ?? null,
               $body['location'] ?? null, $body['area_sqft'] ?? null, $body['description'] ?? null,
               $body['current_phase'] ?? 'concept',
               json_encode($body['phases_done'] ?? []),
               $body['start_date'] ?? null, $body['end_date'] ?? null, $body['status'] ?? 'active',
               $body['project_type'] ?? null, $body['po_number'] ?? null, $body['po_date'] ?? null,
               $body['billing_address'] ?? null, $body['ship_to_gstin'] ?? null,
               $body['site_name'] ?? null, $body['site_address'] ?? null,
               $id,
           ]);

        // Update team
        if (isset($body['team_member_ids'])) {
            $db->prepare('DELETE FROM project_team_members WHERE project_id=?')->execute([$id]);
            foreach ((array)$body['team_member_ids'] as $eid) {
                $db->prepare('INSERT IGNORE INTO project_team_members (project_id,employee_id) VALUES (?,?)')->execute([$id, (int)$eid]);
            }
        }

        $stmt = $db->prepare('SELECT * FROM projects WHERE id=?');
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'project' => formatProject($stmt->fetch(), $db)]);
    }

    // DELETE /api/projects/:id
    if ($id && !$sub && $method === 'DELETE') {
        if (!isAdmin($session)) jsonResponse(['error' => 'Admin only'], 403);
        $db->prepare('DELETE FROM projects WHERE id=?')->execute([$id]);
        jsonResponse(['success' => true]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
