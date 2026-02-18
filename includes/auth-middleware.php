<?php
/**
 * Authentication Middleware for API requests
 * Validates user session and returns employee data
 */

require_once __DIR__ . '/../config.php';

/**
 * Check if user is authenticated
 * Returns employee data if authenticated, otherwise sends 401 response
 */
function requireAuth() {
    if (!isset($_SESSION['employee_id'])) {
        http_response_code(401);
        jsonResponse(false, [], 'Unauthorized. Please login.');
    }

    $conn = getDBConnection();
    $stmt = $conn->prepare("SELECT id, employee_name, email, department, designation FROM employees WHERE id = ?");
    $stmt->bind_param("i", $_SESSION['employee_id']);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(401);
        jsonResponse(false, [], 'User not found. Please login again.');
    }

    $employee = $result->fetch_assoc();
    $stmt->close();
    $conn->close();

    return $employee;
}

/**
 * Check if user is authenticated (returns boolean without sending response)
 */
function isAuthenticated() {
    return isset($_SESSION['employee_id']);
}

/**
 * Get current employee ID from session
 */
function getCurrentEmployeeId() {
    return $_SESSION['employee_id'] ?? null;
}

/**
 * Validate required POST fields
 */
function validateRequired($fields, $data) {
    $missing = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim($data[$field]) === '') {
            $missing[] = $field;
        }
    }

    if (!empty($missing)) {
        http_response_code(400);
        jsonResponse(false, [], 'Missing required fields: ' . implode(', ', $missing));
    }

    return true;
}

/**
 * Sanitize input data
 */
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return htmlspecialchars(strip_tags(trim($data)));
}
?>
