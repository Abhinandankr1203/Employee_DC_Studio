<?php
function handleLeaves(string $method, ?string $id, ?string $sub, array $session): void {
    $db   = getDB();
    $body = getBody();

    // GET /api/leaves/summary
    if ($id === 'summary' && $method === 'GET') {
        $allocs = $db->query('SELECT * FROM leave_allocations WHERE year = YEAR(NOW())')->fetchAll();
        $empId  = getEmployeeId($session['email']);
        $year   = date('Y');

        $summary = [];
        foreach ($allocs as $a) {
            $used = 0;
            if ($empId) {
                $stmt = $db->prepare("SELECT COALESCE(SUM(no_days),0) as used FROM leave_requests WHERE user_id=? AND type=? AND status='approved' AND YEAR(from_date)=?");
                $stmt->execute([$session['userId'], $a['type'], $year]);
                $used = (float)$stmt->fetch()['used'];
            }
            // For SHR, check monthly usage
            $monthly_used = null;
            if ($a['period'] === 'month') {
                $m = date('Y-m');
                $stmt2 = $db->prepare("SELECT COUNT(*) as cnt FROM leave_requests WHERE user_id=? AND type='SHR' AND status!='rejected' AND DATE_FORMAT(from_date,'%Y-%m')=?");
                $stmt2->execute([$session['userId'], $m]);
                $monthly_used = (int)$stmt2->fetch()['cnt'];
            }
            $summary[] = [
                'type'          => $a['type'],
                'label'         => $a['label'],
                'allocated'     => (int)$a['allocated'],
                'used'          => $used,
                'remaining'     => max(0, $a['allocated'] - $used),
                'period'        => $a['period'],
                'monthly_used'  => $monthly_used,
            ];
        }
        jsonResponse(['summary' => $summary]);
    }

    // GET /api/leaves
    if (!$id && $method === 'GET') {
        if (isAdminOrManager($session)) {
            $stmt = $db->query('SELECT r.*, u.name as user_name FROM leave_requests r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC');
        } else {
            $stmt = $db->prepare('SELECT r.*, u.name as user_name FROM leave_requests r JOIN users u ON u.id=r.user_id WHERE r.user_id=? ORDER BY r.created_at DESC');
            $stmt->execute([$session['userId']]);
        }
        $rows = array_map(function($r) {
            return array_merge($r, ['no_days' => (float)$r['no_days']]);
        }, $stmt->fetchAll());
        jsonResponse(['requests' => $rows]);
    }

    // POST /api/leaves
    if (!$id && $method === 'POST') {
        $type    = strtoupper(trim($body['type'] ?? ''));
        $from    = $body['from_date'] ?? '';
        $to      = $body['to_date']   ?? '';
        $reason  = trim($body['reason'] ?? '');
        if (!$type || !$reason) jsonResponse(['error' => 'Type and reason required'], 400);

        $noDays = 1;
        $nextJoining = null;

        if ($type === 'SHR') {
            $from_time = $body['from_time'] ?? null;
            $to_time   = $body['to_time']   ?? null;
            $duration  = (float)($body['duration'] ?? 0);
            $db->prepare('INSERT INTO leave_requests (user_id,type,from_date,to_date,from_time,to_time,duration,no_days,next_joining_date,reason,status) VALUES (?,?,?,?,?,?,?,0.5,?,?,\'pending\')')
               ->execute([$session['userId'],$type,$from,$from,$from_time,$to_time,$duration,$from,$reason]);
        } else {
            if ($from && $to) {
                $d1 = new DateTime($from);
                $d2 = new DateTime($to);
                $noDays = $d2->diff($d1)->days + 1;
                $next = clone $d2; $next->modify('+1 day');
                // Skip weekends
                while (in_array($next->format('N'), ['6','7'])) $next->modify('+1 day');
                $nextJoining = $next->format('Y-m-d');
            }
            $db->prepare('INSERT INTO leave_requests (user_id,type,from_date,to_date,no_days,next_joining_date,reason,status) VALUES (?,?,?,?,?,?,?,\'pending\')')
               ->execute([$session['userId'],$type,$from,$to,$noDays,$nextJoining,$reason]);
        }

        $lid = $db->lastInsertId();
        $stmt = $db->prepare('SELECT * FROM leave_requests WHERE id=?');
        $stmt->execute([$lid]);
        jsonResponse(['success' => true, 'request' => $stmt->fetch()], 201);
    }

    // DELETE /api/leaves/:id
    if ($id && $method === 'DELETE') {
        $stmt = $db->prepare('SELECT * FROM leave_requests WHERE id=?');
        $stmt->execute([$id]);
        $req = $stmt->fetch();
        if (!$req) jsonResponse(['error' => 'Not found'], 404);
        if ((int)$req['user_id'] !== $session['userId'] && !isAdmin($session)) jsonResponse(['error' => 'Forbidden'], 403);
        if ($req['status'] !== 'pending') jsonResponse(['error' => 'Only pending requests can be cancelled'], 400);
        $db->prepare("UPDATE leave_requests SET status='cancelled' WHERE id=?")->execute([$id]);
        jsonResponse(['success' => true]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
