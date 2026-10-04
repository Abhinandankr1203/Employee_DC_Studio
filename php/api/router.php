<?php
// Set CORS and JSON headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/helpers.php';

// Parse the path after /api/
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = preg_replace('#^.*?/api/#', '', $uri); // strip prefix up to /api/
$parts  = array_values(array_filter(explode('/', $uri)));
$resource = $parts[0] ?? '';
$id       = $parts[1] ?? null;
$sub      = $parts[2] ?? null;

$method = $_SERVER['REQUEST_METHOD'];

// Dispatch
switch ($resource) {
    case 'auth':
        require_once __DIR__ . '/handlers/auth.php';
        handleAuth($method, $id);
        break;

    case 'tasks':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/tasks.php';
        handleTasks($method, $id, $sub, $session);
        break;

    case 'projects':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/projects.php';
        handleProjects($method, $id, $sub, $session);
        break;

    case 'employees':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/employees.php';
        handleEmployees($method, $id, $session);
        break;

    case 'team':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/employees.php';
        handleTeam($method, $session);
        break;

    case 'leaves':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/leaves.php';
        handleLeaves($method, $id, $sub, $session);
        break;

    case 'meetings':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/meetings.php';
        handleMeetings($method, $id, $session);
        break;

    case 'salary':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/salary.php';
        handleSalary($method, $id, $session);
        break;

    case 'reimbursements':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/salary.php';
        handleReimbursements($method, $id, $session);
        break;

    case 'approvals':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/approvals.php';
        handleApprovals($method, $id, $sub, $session);
        break;

    case 'attendance':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/attendance.php';
        handleAttendance($method, $session);
        break;

    case 'calendar':
        $session = requireAuth();
        require_once __DIR__ . '/handlers/calendar.php';
        handleCalendar($method, $id, $session);
        break;

    default:
        jsonResponse(['error' => 'Not found'], 404);
}
