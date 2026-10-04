<?php
// DC Studio — Login Diagnostics + Password Reset
// Visit: http://localhost/test-login.php

require_once __DIR__ . '/config/db.php';

echo "<style>body{font-family:monospace;padding:20px;background:#111;color:#0f0;} .err{color:red;} .ok{color:lime;} .warn{color:orange;}</style>";
echo "<h2>DC Studio — Login Diagnostics</h2>";

// 1. Test DB connection
echo "<h3>1. Database Connection</h3>";
try {
    $db = getDB();
    echo "<p class='ok'>✔ Connected to MySQL</p>";
} catch (Exception $e) {
    echo "<p class='err'>✘ DB Error: " . $e->getMessage() . "</p>";
    exit;
}

// 2. Check users table
echo "<h3>2. Users in Database</h3>";
try {
    $stmt = $db->query("SELECT id, email, role, salt, password_hash FROM users");
    $users = $stmt->fetchAll();
    if (empty($users)) {
        echo "<p class='err'>✘ No users found — database not populated!</p>";
    } else {
        foreach ($users as $u) {
            echo "<p class='ok'>✔ ID:{$u['id']} | {$u['email']} | {$u['role']}</p>";
            echo "<p style='color:#aaa;font-size:11px;'>   Salt: {$u['salt']}<br>   Hash: {$u['password_hash']}</p>";
        }
    }
} catch (Exception $e) {
    echo "<p class='err'>✘ " . $e->getMessage() . "</p>";
}

// 3. Test password hash
echo "<h3>3. Password Hash Test (Admin@123)</h3>";
try {
    $stmt = $db->prepare("SELECT * FROM users WHERE email = 'admin@dcstudio.com'");
    $stmt->execute();
    $admin = $stmt->fetch();

    if (!$admin) {
        echo "<p class='err'>✘ admin@dcstudio.com not found in database</p>";
    } else {
        $salt      = $admin['salt'];
        $stored    = $admin['password_hash'];
        $computed  = hash_hmac('sha256', 'Admin@123', $salt);
        echo "<p>Salt:     <span style='color:#aaa'>$salt</span></p>";
        echo "<p>Stored:   <span style='color:#aaa'>$stored</span></p>";
        echo "<p>Computed: <span style='color:#aaa'>$computed</span></p>";
        if ($computed === $stored) {
            echo "<p class='ok'>✔ Password hash MATCHES — login should work!</p>";
        } else {
            echo "<p class='err'>✘ Hash MISMATCH — fixing now...</p>";

            // Auto-fix: reset admin password
            $newSalt = bin2hex(random_bytes(16));
            $newHash = hash_hmac('sha256', 'Admin@123', $newSalt);
            $db->prepare("UPDATE users SET salt=?, password_hash=? WHERE email='admin@dcstudio.com'")
               ->execute([$newSalt, $newHash]);
            echo "<p class='ok'>✔ Admin password RESET to Admin@123</p>";
        }
    }
} catch (Exception $e) {
    echo "<p class='err'>✘ " . $e->getMessage() . "</p>";
}

// 4. Test API route
echo "<h3>4. API Route Test</h3>";
$ch = curl_init('http://localhost/api/auth/login');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['email'=>'admin@dcstudio.com','password'=>'Admin@123']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$result = curl_exec($ch);
$code   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "<p>HTTP Status: <span style='color:yellow'>$code</span></p>";
echo "<p>Response: <span style='color:yellow'>" . htmlspecialchars($result) . "</span></p>";

if ($code === 200 && str_contains($result, 'token')) {
    echo "<p class='ok'>✔ Login API is working correctly!</p>";
} elseif ($code === 401) {
    echo "<p class='err'>✘ Wrong credentials — password fix above should resolve this</p>";
} elseif ($code === 404) {
    echo "<p class='err'>✘ API route not found — mod_rewrite issue</p>";
} else {
    echo "<p class='warn'>⚠ Unexpected response</p>";
}

// 5. Quick fix: Insert/reset all users
echo "<h3>5. Reset All User Passwords</h3>";
$defaultPasswords = [
    'admin@dcstudio.com'  => 'Admin@123',
    'rahul@dcstudio.com'  => 'Rahul@123',
    'priya@dcstudio.com'  => 'Priya@123',
    'amit@dcstudio.com'   => 'Amit@123',
    'sneha@dcstudio.com'  => 'Sneha@123',
    'vikram@dcstudio.com' => 'Vikram@123',
    'meera@dcstudio.com'  => 'Meera@123',
    'suresh@dcstudio.com' => 'Suresh@123',
];

foreach ($defaultPasswords as $email => $pass) {
    $salt = bin2hex(random_bytes(16));
    $hash = hash_hmac('sha256', $pass, $salt);
    $db->prepare("UPDATE users SET salt=?, password_hash=? WHERE email=?")->execute([$salt, $hash, $email]);
    echo "<p class='ok'>✔ Reset: $email → password: $pass</p>";
}

echo "<hr>";
echo "<h2 style='color:lime'>All passwords reset! Now try logging in:</h2>";
echo "<p style='font-size:16px;color:white'>Email: <b>admin@dcstudio.com</b><br>Password: <b>Admin@123</b></p>";
echo "<p><a href='http://localhost' style='color:cyan;font-size:18px;'>→ Go to Login Page</a></p>";
echo "<p style='color:orange'>Delete this file after testing: sudo rm /var/www/html/test-login.php</p>";
?>
