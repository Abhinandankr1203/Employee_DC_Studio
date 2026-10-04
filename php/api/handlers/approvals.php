<?php
function handleApprovals(string $method, ?string $id, ?string $sub, array $session): void {
    $db   = getDB();
    $body = getBody();

    if (!isAdminOrManager($session)) jsonResponse(['error' => 'Access denied'], 403);

    // GET /api/approvals/badge
    if ($id === 'badge' && $method === 'GET') {
        $stmt = $db->query("SELECT type, COUNT(*) as cnt FROM approvals WHERE status='pending' GROUP BY type");
        $rows = $stmt->fetchAll();
        $by_type = ['leave' => 0, 'reimbursement' => 0, 'task' => 0, 'employee' => 0, 'project' => 0];
        $total = 0;
        foreach ($rows as $r) { $by_type[$r['type']] = (int)$r['cnt']; $total += (int)$r['cnt']; }
        jsonResponse(['total' => $total, 'approvals_by_type' => $by_type]);
    }

    // GET /api/approvals
    if (!$id && $method === 'GET') {
        $sql = "SELECT * FROM approvals";
        $params = [];
        if (!empty($_GET['status'])) { $sql .= " WHERE status=?"; $params[] = $_GET['status']; }
        $sql .= " ORDER BY submitted_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = array_map(function($r) {
            return array_merge($r, [
                'id'     => (int)$r['id'],
                'ref_id' => (int)$r['ref_id'],
                'details'=> json_decode($r['details'] ?? '{}', true),
            ]);
        }, $stmt->fetchAll());
        jsonResponse(['approvals' => $rows, 'total' => count($rows)]);
    }

    // POST /api/approvals/:id/review
    if ($id && $sub === 'review' && $method === 'POST') {
        $stmt = $db->prepare('SELECT * FROM approvals WHERE id=?');
        $stmt->execute([$id]);
        $appr = $stmt->fetch();
        if (!$appr) jsonResponse(['error' => 'Not found'], 404);

        $decision = $body['decision'] ?? '';
        if (!in_array($decision, ['approved','rejected'])) jsonResponse(['error' => 'Invalid decision'], 400);

        $db->prepare('UPDATE approvals SET status=?,reviewed_by_id=?,reviewed_by_name=?,reviewed_at=NOW(),comment=? WHERE id=?')
           ->execute([$decision, $session['userId'], $session['name'], $body['comment'] ?? null, $id]);

        // If leave approval → update leave_requests status
        if ($appr['type'] === 'leave') {
            $db->prepare('UPDATE leave_requests SET status=?,approver_comments=?,actioned_at=NOW() WHERE id=?')
               ->execute([$decision, $body['comment'] ?? null, $appr['ref_id']]);
        }
        // If task approval → mark done
        if ($appr['type'] === 'task' && $decision === 'approved') {
            $db->prepare("UPDATE tasks SET status='done', updated_at=NOW() WHERE id=?")->execute([$appr['ref_id']]);
        }
        if ($appr['type'] === 'task' && $decision === 'rejected') {
            $db->prepare("UPDATE tasks SET status='in-progress', updated_at=NOW() WHERE id=?")->execute([$appr['ref_id']]);
        }

        jsonResponse(['success' => true]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
