<?php
function handleAuth(string $method, ?string $action): void {
    $db   = getDB();
    $body = getBody();

    // POST /api/auth/login
    if ($action === 'login' && $method === 'POST') {
        $email = strtolower(trim($body['email'] ?? ''));
        $pass  = $body['password'] ?? '';
        if (!$email || !$pass) jsonResponse(['error' => 'Invalid credentials'], 401);

        $stmt = $db->prepare('SELECT * FROM users WHERE LOWER(email) = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || hashPassword($pass, $user['salt']) !== $user['password_hash']) {
            jsonResponse(['error' => 'Invalid email or password'], 401);
        }

        $token = createSession($user);
        jsonResponse([
            'success' => true,
            'token'   => $token,
            'name'    => $user['name'],
            'email'   => $user['email'],
            'role'    => $user['role'],
        ]);
    }

    // POST /api/auth/logout
    if ($action === 'logout' && $method === 'POST') {
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (str_starts_with($h, 'Bearer ')) {
            $token = substr($h, 7);
            $db->prepare('DELETE FROM sessions WHERE token = ?')->execute([$token]);
        }
        jsonResponse(['success' => true]);
    }

    // GET /api/auth/me
    if ($action === 'me' && $method === 'GET') {
        $session = getSession();
        if (!$session) jsonResponse(['error' => 'Unauthorized'], 401);
        jsonResponse(['success' => true, 'name' => $session['name'], 'email' => $session['email'], 'role' => $session['role']]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
