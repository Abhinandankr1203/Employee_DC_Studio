<?php
// Database Setup Script
// Run this file once to create database and test user

$host = 'localhost';
$user = 'root';
$pass = '';

echo "<h2>DC Studio Employee Portal - Database Setup</h2>";
echo "<pre>";

// Connect to MySQL
$conn = new mysqli($host, $user, $pass);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "Connected to MySQL successfully.\n";

// Create Database
$sql = "CREATE DATABASE IF NOT EXISTS dc_studio_employee";
if ($conn->query($sql) === TRUE) {
    echo "Database 'dc_studio_employee' created successfully.\n";
} else {
    echo "Error creating database: " . $conn->error . "\n";
}

// Select Database
$conn->select_db('dc_studio_employee');

// Create Employees Table
$sql = "CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    department VARCHAR(50),
    designation VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";

if ($conn->query($sql) === TRUE) {
    echo "Table 'employees' created successfully.\n";
} else {
    echo "Error creating table: " . $conn->error . "\n";
}

// Clear existing test user if exists
$conn->query("DELETE FROM employees WHERE email = 'test@dcstudio.com'");

// Create Test User with hashed password
$employee_name = 'Rahul Sharma';
$email = 'test@dcstudio.com';
$password = 'test123';
$hashed_password = password_hash($password, PASSWORD_DEFAULT);
$department = 'Design';
$designation = 'Senior Designer';

$stmt = $conn->prepare("INSERT INTO employees (employee_name, email, password, department, designation) VALUES (?, ?, ?, ?, ?)");
$stmt->bind_param("sssss", $employee_name, $email, $hashed_password, $department, $designation);

if ($stmt->execute()) {
    echo "\n========================================\n";
    echo "TEST USER CREATED SUCCESSFULLY!\n";
    echo "========================================\n";
    echo "Email:    test@dcstudio.com\n";
    echo "Password: test123\n";
    echo "========================================\n";
} else {
    echo "Error creating test user: " . $stmt->error . "\n";
}

$stmt->close();
$conn->close();

echo "\nSetup complete! You can now login at index.php";
echo "</pre>";

echo "<br><br><a href='index.php' style='padding: 10px 20px; background: #eb7846; color: white; text-decoration: none; border-radius: 5px; font-family: Poppins, sans-serif;'>Go to Login Page</a>";
?>
