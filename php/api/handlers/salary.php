<?php
function handleSalary(string $method, ?string $id, array $session): void {
    $db = getDB();

    // GET /api/salary/payslips
    if ($id === 'payslips' && $method === 'GET') {
        $empId = getEmployeeId($session['email']);
        if (!$empId) jsonResponse(['payslips' => []]);
        $stmt = $db->prepare('SELECT * FROM payslips WHERE employee_id=? ORDER BY month DESC');
        $stmt->execute([$empId]);
        $payslips = array_map(function($p) {
            return array_merge($p, [
                'id'           => (int)$p['id'],
                'employee_id'  => (int)$p['employee_id'],
                'basic'        => (float)$p['basic'],
                'hra'          => (float)$p['hra'],
                'travel'       => (float)$p['travel'],
                'incentive'    => (float)$p['incentive'],
                'reimbursement'=> (float)$p['reimbursement'],
                'pf'           => (float)$p['pf'],
                'tds'          => (float)$p['tds'],
                'professional_tax' => (float)$p['professional_tax'],
                'net_pay'      => (float)$p['net_pay'],
            ]);
        }, $stmt->fetchAll());
        jsonResponse(['payslips' => $payslips]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}

function handleReimbursements(string $method, ?string $id, array $session): void {
    $db   = getDB();
    $body = getBody();

    // GET /api/reimbursements
    if (!$id && $method === 'GET') {
        $empId = getEmployeeId($session['email']);
        if (isAdminOrManager($session)) {
            $stmt = $db->query('SELECT r.*, e.name as employee_name FROM reimbursements r JOIN employees e ON e.id=r.employee_id ORDER BY r.submitted_at DESC');
        } else {
            $stmt = $db->prepare('SELECT r.*, e.name as employee_name FROM reimbursements r JOIN employees e ON e.id=r.employee_id WHERE r.employee_id=? ORDER BY r.submitted_at DESC');
            $stmt->execute([$empId]);
        }
        $rows = array_map(fn($r) => array_merge($r, ['id' => (int)$r['id'], 'amount' => (float)$r['amount']]), $stmt->fetchAll());
        jsonResponse(['reimbursements' => $rows]);
    }

    // POST /api/reimbursements
    if (!$id && $method === 'POST') {
        $empId = getEmployeeId($session['email']);
        if (!$empId) jsonResponse(['error' => 'Employee not found'], 404);
        $amount = (float)($body['amount'] ?? 0);
        if ($amount <= 0) jsonResponse(['error' => 'Amount required'], 400);

        $db->prepare('INSERT INTO reimbursements (employee_id,project,description,amount,bill_date,category,filename,status) VALUES (?,?,?,?,?,?,?,\'pending\')')
           ->execute([$empId, $body['project'] ?? null, $body['description'] ?? null, $amount, $body['bill_date'] ?? null, $body['category'] ?? null, $body['filename'] ?? null]);

        jsonResponse(['success' => true], 201);
    }

    // DELETE /api/reimbursements/:id
    if ($id && $method === 'DELETE') {
        $stmt = $db->prepare('SELECT * FROM reimbursements WHERE id=?');
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        if (!$r) jsonResponse(['error' => 'Not found'], 404);

        $empId = getEmployeeId($session['email']);
        if ((int)$r['employee_id'] !== $empId && !isAdmin($session)) jsonResponse(['error' => 'Forbidden'], 403);
        if ($r['status'] !== 'pending') jsonResponse(['error' => 'Only pending claims can be cancelled'], 400);

        $db->prepare('DELETE FROM reimbursements WHERE id=?')->execute([$id]);
        jsonResponse(['success' => true]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
