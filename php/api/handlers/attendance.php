<?php
function handleAttendance(string $method, array $session): void {
    $db    = getDB();
    $query = $_GET;

    // GET /api/attendance/monthly-summary
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (str_contains($uri, 'monthly-summary') && $method === 'GET') {
        $month = $query['month'] ?? date('Y-m');
        $stmt  = $db->prepare("SELECT COUNT(*) as present, SUM(late) as late_count FROM attendance WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?");
        $stmt->execute([$session['userId'], $month]);
        $row = $stmt->fetch();
        jsonResponse([
            'month'      => $month,
            'present'    => (int)$row['present'],
            'late'       => (int)$row['late_count'],
            'absent'     => 0,
            'wfh'        => 0,
        ]);
    }

    // GET /api/attendance
    if ($method === 'GET') {
        $stmt = $db->prepare("SELECT * FROM attendance WHERE user_id=? ORDER BY date DESC LIMIT 60");
        $stmt->execute([$session['userId']]);
        jsonResponse(['records' => $stmt->fetchAll()]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
