<?php
/**
 * Search Employees API
 * Returns employees matching the search query for autocomplete
 */

require_once __DIR__ . '/../../includes/auth-middleware.php';

// Verify authentication
$currentEmployee = requireAuth();

// Handle GET request
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    jsonResponse(false, [], 'Method not allowed');
}

$query = isset($_GET['q']) ? sanitizeInput($_GET['q']) : '';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;

if (strlen($query) < 2) {
    jsonResponse(true, [], 'Query too short');
}

$conn = getDBConnection();

// Search for employees by name or email, excluding current user
$searchQuery = "%{$query}%";
$stmt = $conn->prepare("
    SELECT id, employee_name, email, department, designation
    FROM employees
    WHERE (employee_name LIKE ? OR email LIKE ?)
    AND id != ?
    ORDER BY employee_name ASC
    LIMIT ?
");
$stmt->bind_param("ssii", $searchQuery, $searchQuery, $currentEmployee['id'], $limit);
$stmt->execute();
$result = $stmt->get_result();

$employees = [];
while ($row = $result->fetch_assoc()) {
    $employees[] = [
        'id' => (int)$row['id'],
        'name' => $row['employee_name'],
        'email' => $row['email'],
        'department' => $row['department'],
        'designation' => $row['designation']
    ];
}

$stmt->close();
$conn->close();

jsonResponse(true, $employees);
?>
