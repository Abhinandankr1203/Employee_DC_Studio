<?php
header('Content-Type: application/json');
require_once 'config.php';

if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
    echo json_encode([
        'logged_in' => true,
        'employee_name' => $_SESSION['employee_name'],
        'employee_email' => $_SESSION['employee_email'],
        'department' => $_SESSION['employee_department'],
        'designation' => $_SESSION['employee_designation']
    ]);
} else {
    echo json_encode([
        'logged_in' => false
    ]);
}
?>
