<?php
header('Content-Type: application/json');
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = isset($_POST['email']) ? trim($_POST['email']) : '';
    $password = isset($_POST['password']) ? $_POST['password'] : '';

    // Validate input
    if (empty($email) || empty($password)) {
        echo json_encode([
            'success' => false,
            'message' => 'Please enter both email and password.'
        ]);
        exit;
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode([
            'success' => false,
            'message' => 'Please enter a valid email address.'
        ]);
        exit;
    }

    try {
        $conn = getDBConnection();

        // Prepare statement to prevent SQL injection
        $stmt = $conn->prepare("SELECT id, employee_name, email, password, department, designation FROM employees WHERE email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 1) {
            $employee = $result->fetch_assoc();

            // Verify password
            if (password_verify($password, $employee['password'])) {
                // Set session variables
                $_SESSION['employee_id'] = $employee['id'];
                $_SESSION['employee_name'] = $employee['employee_name'];
                $_SESSION['employee_email'] = $employee['email'];
                $_SESSION['employee_department'] = $employee['department'];
                $_SESSION['employee_designation'] = $employee['designation'];
                $_SESSION['logged_in'] = true;

                echo json_encode([
                    'success' => true,
                    'message' => 'Login successful!',
                    'employee_name' => $employee['employee_name'],
                    'department' => $employee['department'],
                    'designation' => $employee['designation']
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid password. Please try again.'
                ]);
            }
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'No account found with this email.'
            ]);
        }

        $stmt->close();
        $conn->close();

    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Database connection error. Please try again later.'
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request method.'
    ]);
}
?>
