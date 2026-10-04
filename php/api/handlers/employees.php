<?php
function handleEmployees(string $method, ?string $id, array $session): void {
    $db    = getDB();
    $query = $_GET;

    // GET /api/employees
    if (!$id && $method === 'GET') {
        $stmt = $db->query('SELECT e.*, u.role FROM employees e JOIN users u ON u.id = e.user_id ORDER BY e.name');
        $employees = array_map(function($e) {
            return [
                'id'          => (int)$e['id'],
                'user_id'     => (int)$e['user_id'],
                'name'        => $e['name'],
                'email'       => $e['email'],
                'department'  => $e['department'],
                'designation' => $e['designation'],
                'salary'      => (float)$e['salary'],
                'joining_date'=> $e['joining_date'],
                'role'        => $e['role'],
            ];
        }, $stmt->fetchAll());
        jsonResponse(['employees' => $employees]);
    }

    // GET /api/employees/search?q=...
    if ($id === 'search' && $method === 'GET') {
        $q = '%' . substr($query['q'] ?? '', 0, 100) . '%';
        $stmt = $db->prepare('SELECT id, name, email, department, designation FROM employees WHERE name LIKE ? OR email LIKE ? LIMIT 20');
        $stmt->execute([$q, $q]);
        jsonResponse(['employees' => $stmt->fetchAll()]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}

function handleTeam(string $method, array $session): void {
    $db    = getDB();
    $query = $_GET;

    if ($method === 'GET') {
        $sql    = 'SELECT e.*, u.role FROM employees e JOIN users u ON u.id = e.user_id WHERE 1=1';
        $params = [];

        if (!empty($query['q'])) {
            $q = '%' . substr($query['q'], 0, 100) . '%';
            $sql .= ' AND (e.name LIKE ? OR e.designation LIKE ? OR e.department LIKE ?)';
            $params[] = $q; $params[] = $q; $params[] = $q;
        }
        if (!empty($query['office'])) {
            $sql .= ' AND e.office = ?';
            $params[] = $query['office'];
        }

        $sql .= ' ORDER BY e.name';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $members = array_map(function($e) {
            return [
                'id'                   => (int)$e['id'],
                'name'                 => $e['name'],
                'email'                => $e['email'],
                'department'           => $e['department'],
                'designation'          => $e['designation'],
                'office'               => $e['office'],
                'joining_date'         => $e['joining_date'],
                'role'                 => $e['role'],
                'is_reporting_manager' => (bool)$e['is_reporting_manager'],
                'reporting_manager_name' => $e['reporting_manager_name'],
            ];
        }, $stmt->fetchAll());
        jsonResponse(['members' => $members, 'total' => count($members)]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
