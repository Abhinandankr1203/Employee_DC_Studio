<?php
require_once __DIR__ . '/../config/db.php';

// ── JSON response ──────────────────────────────────────────────────────────
function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

// ── Password (matches Node.js: createHmac('sha256', salt).update(pass)) ───
function hashPassword(string $password, string $salt): string {
    return hash_hmac('sha256', $password, $salt);
}

function generateSalt(): string {
    return bin2hex(random_bytes(16));
}

function generateToken(): string {
    return bin2hex(random_bytes(32));
}

// ── Session / Auth ─────────────────────────────────────────────────────────
function createSession(array $user): string {
    $db    = getDB();
    $token = generateToken();
    $exp   = date('Y-m-d H:i:s', strtotime('+8 hours'));
    // Clean old sessions for this user
    $db->prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < NOW()')->execute([$user['id']]);
    $db->prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?,?,?)')
       ->execute([$user['id'], $token, $exp]);
    return $token;
}

function getSession(): ?array {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($h, 'Bearer ')) return null;
    $token = substr($h, 7);
    if (!$token) return null;

    $db   = getDB();
    $stmt = $db->prepare('SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role
                          FROM sessions s JOIN users u ON u.id = s.user_id
                          WHERE s.token = ? AND s.expires_at > NOW()');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) return null;

    return [
        'userId' => (int)$row['id'],
        'name'   => $row['name'],
        'email'  => $row['email'],
        'role'   => $row['role'],
        'token'  => $token,
    ];
}

function requireAuth(): array {
    $session = getSession();
    if (!$session) jsonResponse(['error' => 'Unauthorized'], 401);
    return $session;
}

function isAdmin(array $s): bool          { return $s['role'] === 'admin'; }
function isAdminOrManager(array $s): bool { return in_array($s['role'], ['admin','manager']); }

function getEmployeeId(string $email): ?int {
    $stmt = getDB()->prepare('SELECT id FROM employees WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    return $row ? (int)$row['id'] : null;
}

// ── Request body ───────────────────────────────────────────────────────────
function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// ── Pagination ─────────────────────────────────────────────────────────────
function paginate(array $items, int $page = 1, int $limit = 100): array {
    $total  = count($items);
    $offset = ($page - 1) * $limit;
    return ['data' => array_slice($items, $offset, $limit), 'total' => $total];
}
