const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const { google } = require('googleapis');

// ── Load .env file if present ──────────────────────────────────────────────
(function loadEnv() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (!fs.existsSync(envPath)) return;
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
            if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
        });
    } catch (_) {}
})();

// ── Config ─────────────────────────────────────────────────────────────────
const PORT           = parseInt(process.env.PORT)   || 8000;
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL       || 'ak53429651201@gmail.com';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN    || '*';

const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.send'
];

// ── File paths ─────────────────────────────────────────────────────────────
const DATA_DIR            = path.join(__dirname, 'data');
const CREDENTIALS_PATH    = path.join(__dirname, 'credentials.json');
const TOKEN_PATH          = path.join(__dirname, 'token.json');
const MEETINGS_PATH       = path.join(DATA_DIR, 'meetings.json');
const EMPLOYEES_PATH      = path.join(DATA_DIR, 'employees.json');
const TASKS_PATH          = path.join(DATA_DIR, 'tasks.json');
const LEAVES_PATH         = path.join(DATA_DIR, 'leaves.json');
const PAYSLIPS_PATH       = path.join(DATA_DIR, 'payslips.json');
const REIMBURSEMENTS_PATH = path.join(DATA_DIR, 'reimbursements.json');
const USERS_PATH          = path.join(DATA_DIR, 'users.json');
const PROJECTS_PATH       = path.join(DATA_DIR, 'projects.json');
const TEAM_PATH           = path.join(DATA_DIR, 'team.json');
const APPROVALS_PATH      = path.join(DATA_DIR, 'approvals.json');

// ── Session store & rate limiter (in-memory) ───────────────────────────────
const sessions   = new Map(); // token → { userId, name, email, role, expiresAt }
const rateLimits = new Map(); // ip → { count, resetAt }

const SESSION_TTL  = 8 * 60 * 60 * 1000; // 8 hours
const RATE_LIMIT   = 120;                 // max requests per window per IP
const RATE_WINDOW  = 60 * 1000;          // 1 minute

// Clean up expired sessions every hour
setInterval(() => {
    const now = Date.now();
    for (const [token, s] of sessions) if (s.expiresAt < now) sessions.delete(token);
    for (const [ip,   r] of rateLimits) if (r.resetAt   < now) rateLimits.delete(ip);
}, 60 * 60 * 1000);

// ── Auth helpers ───────────────────────────────────────────────────────────
function hashPassword(password, salt) {
    return crypto.createHmac('sha256', salt).update(password).digest('hex');
}
function generateSalt()  { return crypto.randomBytes(16).toString('hex'); }
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

function createSession(user) {
    const token = generateToken();
    sessions.set(token, {
        userId: user.id, name: user.name, email: user.email,
        role: user.role || 'employee',
        expiresAt: Date.now() + SESSION_TTL
    });
    return token;
}
function getSession(token) {
    if (!token) return null;
    const s = sessions.get(token);
    if (!s) return null;
    if (s.expiresAt < Date.now()) { sessions.delete(token); return null; }
    return s;
}
function requireAuth(req) {
    const h = req.headers['authorization'] || '';
    return getSession(h.startsWith('Bearer ') ? h.slice(7) : null);
}
function isAdmin(session)          { return session && session.role === 'admin'; }
function isAdminOrManager(session) { return session && (session.role === 'admin' || session.role === 'manager'); }
async function getEmployeeId(email) {
    const { employees } = await loadEmployees();
    const emp = employees.find(e => e.email === email);
    return emp ? emp.id : null;
}

// ── Rate limiting ──────────────────────────────────────────────────────────
function checkRateLimit(ip) {
    const now = Date.now();
    const r = rateLimits.get(ip);
    if (!r || r.resetAt < now) { rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW }); return true; }
    if (r.count >= RATE_LIMIT) return false;
    r.count++;
    return true;
}

// ── Validation helpers ─────────────────────────────────────────────────────
function isStr(v, max = 500) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
function isDate(v)  { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function isTime(v)  { return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v); }
function isEmail(v) { return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254; }
function isNum(v)   { return typeof v === 'number' && isFinite(v) && v >= 0; }
function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Logging ────────────────────────────────────────────────────────────────
function log(req, status) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '-';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${status} — ${ip}`);
}

// ── Pagination helper ──────────────────────────────────────────────────────
function paginate(arr, query) {
    const limit  = Math.min(parseInt(query.limit)  || 50, 200);
    const offset = Math.max(parseInt(query.offset) || 0,  0);
    return { data: arr.slice(offset, offset + limit), total: arr.length, limit, offset };
}

// ── MIME types ─────────────────────────────────────────────────────────────
const mimeTypes = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.pdf': 'application/pdf',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

// ── Async data loaders/savers ──────────────────────────────────────────────
async function readJSON(filePath, fallback) {
    try { return JSON.parse(await fs.promises.readFile(filePath, 'utf8')); }
    catch (_) { return fallback; }
}
async function writeJSON(filePath, data) {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
}

const loadMeetings       = () => readJSON(MEETINGS_PATH,       { meetings: [], nextId: 1 });
const loadEmployees      = () => readJSON(EMPLOYEES_PATH,      { employees: [] });
const loadTasks          = () => readJSON(TASKS_PATH,          { tasks: [], nextId: 1 });
const loadLeaves         = () => readJSON(LEAVES_PATH,         { allocations: [], requests: [], nextId: 1 });
const loadPayslips       = () => readJSON(PAYSLIPS_PATH,       { payslips: [], nextId: 1 });
const loadReimbursements = () => readJSON(REIMBURSEMENTS_PATH, { claims: [], nextId: 1 });
const loadUsers          = () => readJSON(USERS_PATH,          { users: [], nextId: 1 });
const loadProjects       = () => readJSON(PROJECTS_PATH,       { projects: [], nextId: 1 });
const loadTeam           = () => readJSON(TEAM_PATH,           { members: [], nextId: 1 });
const loadApprovals      = () => readJSON(APPROVALS_PATH,      { approvals: [], nextId: 1 });

const saveMeetings       = d => writeJSON(MEETINGS_PATH,       d);
const saveEmployees      = d => writeJSON(EMPLOYEES_PATH,      d);
const saveTasks          = d => writeJSON(TASKS_PATH,          d);
const saveLeaves         = d => writeJSON(LEAVES_PATH,         d);
const savePayslips       = d => writeJSON(PAYSLIPS_PATH,       d);
const saveReimbursements = d => writeJSON(REIMBURSEMENTS_PATH, d);
const saveUsers          = d => writeJSON(USERS_PATH,          d);
const saveProjects       = d => writeJSON(PROJECTS_PATH,       d);
const saveTeam           = d => writeJSON(TEAM_PATH,           d);
const saveApprovals      = d => writeJSON(APPROVALS_PATH,      d);

// ── Startup: ensure data directory and seed files ─────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

if (!fs.existsSync(MEETINGS_PATH))
    fs.writeFileSync(MEETINGS_PATH, JSON.stringify({ meetings: [], nextId: 1 }, null, 2));

if (!fs.existsSync(EMPLOYEES_PATH)) {
    fs.writeFileSync(EMPLOYEES_PATH, JSON.stringify({
        employees: [
            { id: 1, name: 'Admin User',    email: ADMIN_EMAIL,                department: 'Management',  designation: 'Admin' },
            { id: 2, name: 'Priya Patel',   email: 'priya@dcstudio.com',       department: 'Development', designation: 'Full Stack Developer' },
            { id: 3, name: 'Amit Kumar',    email: 'amit@dcstudio.com',        department: 'Design',      designation: 'UI/UX Designer' },
            { id: 4, name: 'Sneha Reddy',   email: 'sneha@dcstudio.com',       department: 'Marketing',   designation: 'Marketing Manager' },
            { id: 5, name: 'Vikram Singh',  email: 'vikram@dcstudio.com',      department: 'Development', designation: 'Backend Developer' }
        ]
    }, null, 2));
}

if (!fs.existsSync(LEAVES_PATH)) {
    fs.writeFileSync(LEAVES_PATH, JSON.stringify({
        allocations: [
            { year: 2026, type: 'CL', label: 'Casual Leave',    allocated: 12 },
            { year: 2026, type: 'PL', label: 'Privilege Leave',  allocated: 15 },
            { year: 2026, type: 'SL', label: 'Sick Leave',       allocated: 7  }
        ],
        requests: [], nextId: 1
    }, null, 2));
}

if (!fs.existsSync(PAYSLIPS_PATH)) {
    fs.writeFileSync(PAYSLIPS_PATH, JSON.stringify({
        payslips: [
            { id: 1, period: 'December 2025', period_date: '2025-12-01', gross_salary: 50000, basic: 25000, hra: 10000, travel_allowance: 5000, other_allowance: 10000, pf: 1800, tds: 2500, professional_tax: 200, total_deductions: 4500, net_pay: 45500, status: 'paid', paid_on: '2025-12-31', created_at: '2025-12-31T10:00:00.000Z' },
            { id: 2, period: 'January 2026',  period_date: '2026-01-01', gross_salary: 50000, basic: 25000, hra: 10000, travel_allowance: 5000, other_allowance: 10000, pf: 1800, tds: 2500, professional_tax: 200, total_deductions: 4500, net_pay: 45500, status: 'paid', paid_on: '2026-01-31', created_at: '2026-01-31T10:00:00.000Z' },
            { id: 3, period: 'February 2026', period_date: '2026-02-01', gross_salary: 50000, basic: 25000, hra: 10000, travel_allowance: 5000, other_allowance: 10000, pf: 1800, tds: 2500, professional_tax: 200, total_deductions: 4500, net_pay: 45500, status: 'paid', paid_on: '2026-02-28', created_at: '2026-02-28T10:00:00.000Z' }
        ],
        nextId: 4
    }, null, 2));
}

if (!fs.existsSync(REIMBURSEMENTS_PATH))
    fs.writeFileSync(REIMBURSEMENTS_PATH, JSON.stringify({ claims: [], nextId: 1 }, null, 2));

if (!fs.existsSync(TASKS_PATH)) {
    fs.writeFileSync(TASKS_PATH, JSON.stringify({
        tasks: [
            { id: 1, title: 'Design homepage mockup',        description: 'Create wireframes and high-fidelity mockup for the new homepage layout', priority: 'high',   status: 'in-progress', due_date: '2026-02-20', assignee_id: 3, assignee_name: 'Amit Kumar',    created_at: '2026-02-10T09:00:00.000Z', updated_at: '2026-02-10T09:00:00.000Z' },
            { id: 2, title: 'Fix login page responsiveness',  description: 'Login form breaks on mobile screens below 375px',                        priority: 'high',   status: 'to-do',       due_date: '2026-02-15', assignee_id: 2, assignee_name: 'Priya Patel',   created_at: '2026-02-10T09:30:00.000Z', updated_at: '2026-02-10T09:30:00.000Z' },
            { id: 3, title: 'Set up project documentation',  description: 'Create README and contributing guidelines',                                priority: 'medium', status: 'done',        due_date: '2026-02-12', assignee_id: 5, assignee_name: 'Vikram Singh',  created_at: '2026-02-08T10:00:00.000Z', updated_at: '2026-02-11T14:00:00.000Z' },
            { id: 4, title: 'Social media campaign plan',    description: 'Draft Q1 marketing campaign for social media channels',                   priority: 'medium', status: 'to-do',       due_date: '2026-02-25', assignee_id: 4, assignee_name: 'Sneha Reddy',   created_at: '2026-02-10T11:00:00.000Z', updated_at: '2026-02-10T11:00:00.000Z' },
            { id: 5, title: 'API performance audit',         description: 'Profile and optimize slow API endpoints',                                  priority: 'low',    status: 'to-do',       due_date: null,         assignee_id: 5, assignee_name: 'Vikram Singh',  created_at: '2026-02-11T08:00:00.000Z', updated_at: '2026-02-11T08:00:00.000Z' }
        ],
        nextId: 6
    }, null, 2));
}

// Create default admin user (only if users.json doesn't exist yet)
if (!fs.existsSync(USERS_PATH)) {
    const salt = generateSalt();
    const password_hash = hashPassword('Admin@123', salt);
    fs.writeFileSync(USERS_PATH, JSON.stringify({
        users: [{ id: 1, email: 'admin@dcstudio.com', name: 'Admin User', role: 'admin', password_hash, salt }],
        nextId: 2
    }, null, 2));
    console.log('\n  ✔ Default admin created → email: admin@dcstudio.com  password: Admin@123\n');
}

// ── Google OAuth helpers ───────────────────────────────────────────────────
function loadCredentials() {
    try { return JSON.parse(fs.readFileSync(CREDENTIALS_PATH)); }
    catch (_) { return null; }
}
function createOAuth2Client() {
    const creds = loadCredentials();
    if (!creds) return null;
    const { client_secret, client_id, redirect_uris } = creds.web || creds.installed;
    const redirectUri = redirect_uris?.[0] || `http://localhost:${PORT}/auth/google/callback`;
    return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}
function loadToken() {
    try { return fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH)) : null; }
    catch (_) { return null; }
}
function saveToken(token) { fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2)); }
function getAuthenticatedClient() {
    const oAuth2Client = createOAuth2Client();
    if (!oAuth2Client) return null;
    const token = loadToken();
    if (!token) return null;
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
}

// ── Google Calendar event creation ────────────────────────────────────────
async function createCalendarEvent(auth, meetingData) {
    const calendar = google.calendar({ version: 'v3', auth });
    const startDateTime = new Date(`${meetingData.meeting_date}T${meetingData.start_time}:00`);
    const endDateTime   = new Date(`${meetingData.meeting_date}T${meetingData.end_time}:00`);

    const event = {
        summary: meetingData.title,
        description: meetingData.description || '',
        start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
        end:   { dateTime: endDateTime.toISOString(),   timeZone: 'Asia/Kolkata' },
        attendees: meetingData.participants.map(p => ({ email: p.email })),
        conferenceData: {
            createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } }
        },
        reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 30 }, { method: 'popup', minutes: 10 }] }
    };

    try {
        const response = await calendar.events.insert({ calendarId: 'primary', resource: event, conferenceDataVersion: 1, sendUpdates: 'all' });
        return {
            success: true,
            eventId: response.data.id,
            meetLink: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri,
            htmlLink: response.data.htmlLink
        };
    } catch (error) {
        console.error('Error creating calendar event:', error);
        return { success: false, error: error.message };
    }
}

// ── Gmail send helper ──────────────────────────────────────────────────────
async function sendEmail(auth, to, subject, htmlBody) {
    const gmail = google.gmail({ version: 'v1', auth });
    const message = [
        'Content-Type: text/html; charset=utf-8', 'MIME-Version: 1.0',
        `To: ${to}`, `From: ${ADMIN_EMAIL}`, `Subject: ${subject}`, '', htmlBody
    ].join('\n');
    const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    try {
        await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
        return { success: true };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

async function sendMeetingInvites(auth, meeting) {
    const subject  = `Meeting Invitation: ${escHtml(meeting.title)}`;
    const safeLink = meeting.google_meet_link?.startsWith('https://') ? meeting.google_meet_link : '';
    const meetHtml = safeLink
        ? `<p><strong>Join Google Meet:</strong> <a href="${escHtml(safeLink)}">${escHtml(safeLink)}</a></p>`
        : '';

    const htmlBody = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#eb7846,#e85d2d);padding:20px;text-align:center;">
                <h1 style="color:white;margin:0;">DC Studio Meeting Invitation</h1>
            </div>
            <div style="padding:20px;background:#f9f9f9;">
                <h2 style="color:#333;">${escHtml(meeting.title)}</h2>
                <p><strong>Date:</strong> ${escHtml(new Date(meeting.meeting_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' }))}</p>
                <p><strong>Time:</strong> ${escHtml(meeting.start_time)} – ${escHtml(meeting.end_time)}</p>
                <p><strong>Organizer:</strong> ${escHtml(meeting.organizer_name)}</p>
                ${meeting.description ? `<p><strong>Description:</strong> ${escHtml(meeting.description)}</p>` : ''}
                ${meetHtml}
                <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
                <p style="color:#666;font-size:12px;">Sent from DC Studio Meeting System.</p>
            </div>
        </div>`;

    const results = [];
    for (const participant of meeting.participants) {
        if (isEmail(participant.email) && participant.email !== ADMIN_EMAIL) {
            results.push({ email: participant.email, ...await sendEmail(auth, participant.email, subject, htmlBody) });
        }
    }
    return results;
}

// ── HTTP body parser (with 1 MB size limit) ────────────────────────────────
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '', size = 0;
        const MAX = 1024 * 1024; // 1 MB
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX) { reject(new Error('Request body too large (max 1 MB)')); return; }
            body += chunk;
        });
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { reject(new Error('Invalid JSON body')); }
        });
        req.on('error', reject);
    });
}

// ── Response helpers ───────────────────────────────────────────────────────
function sendJSON(res, req, data, statusCode = 200) {
    log(req, statusCode);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify(data));
}

// ── Public routes (no auth required) ──────────────────────────────────────
const PUBLIC_ROUTES = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/register', '/api/oauth/init', '/api/oauth/status', '/api/oauth/logout', '/api/oauth/callback', '/auth/google/callback']);

// ════════════════════════════════════════════════════════════════════════════
// API Route Handler
// ════════════════════════════════════════════════════════════════════════════
async function handleAPI(req, res, pathname, query) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true'
        });
        res.end();
        return;
    }

    // Rate limiting
    if (!checkRateLimit(ip)) {
        sendJSON(res, req, { error: 'Too many requests. Please slow down.' }, 429);
        return;
    }

    // Auth guard — all routes except public ones require a valid session
    if (!PUBLIC_ROUTES.has(pathname) && !pathname.startsWith('/auth/')) {
        const session = requireAuth(req);
        if (!session) {
            sendJSON(res, req, { error: 'Unauthorized. Please log in.' }, 401);
            return;
        }
    }

    // ── Auth: Login ──────────────────────────────────────────────────────
    if (pathname === '/api/auth/login' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!isEmail(body.email) || !isStr(body.password, 128)) {
                sendJSON(res, req, { error: 'Invalid credentials' }, 401);
                return;
            }
            const data = await loadUsers();
            const user = data.users.find(u => u.email.toLowerCase() === body.email.toLowerCase());
            if (!user || hashPassword(body.password, user.salt) !== user.password_hash) {
                sendJSON(res, req, { error: 'Invalid email or password' }, 401);
                return;
            }
            const token = createSession(user);
            sendJSON(res, req, { success: true, token, name: user.name, email: user.email, role: user.role });
        } catch (error) {
            sendJSON(res, req, { error: 'Login failed' }, 500);
        }
        return;
    }

    // ── Auth: Logout ─────────────────────────────────────────────────────
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const h = req.headers['authorization'] || '';
        if (h.startsWith('Bearer ')) sessions.delete(h.slice(7));
        sendJSON(res, req, { success: true });
        return;
    }

    // ── Users: List employees (admin only) ───────────────────────────────
    if (pathname === '/api/users' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            if (!isAdmin(session)) { sendJSON(res, req, { error: 'Admin access required' }, 403); return; }
            const usersData = await loadUsers();
            const employees = usersData.users
                .filter(u => u.role === 'employee')
                .map(u => ({ id: u.id, name: u.name, email: u.email }));
            sendJSON(res, req, { users: employees });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Auth: Me ─────────────────────────────────────────────────────────
    if (pathname === '/api/auth/me' && req.method === 'GET') {
        const session = requireAuth(req);
        if (!session) { sendJSON(res, req, { authenticated: false }, 401); return; }
        sendJSON(res, req, { authenticated: true, name: session.name, email: session.email, role: session.role });
        return;
    }

    // ── Profile: Get full employee profile ───────────────────────────────
    if (pathname === '/api/profile' && req.method === 'GET') {
        const session = requireAuth(req);
        if (!session) { sendJSON(res, req, { error: 'Unauthorized' }, 401); return; }
        try {
            const { employees } = await loadEmployees();
            const emp = employees.find(e => e.email === session.email);
            if (!emp) {
                sendJSON(res, req, { profile: { name: session.name, email: session.email, role: session.role } });
            } else {
                const { password_hash, salt, ...safeEmp } = emp;
                sendJSON(res, req, { profile: safeEmp });
            }
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Profile: Update employee profile ─────────────────────────────────
    if (pathname === '/api/profile' && req.method === 'PUT') {
        const session = requireAuth(req);
        if (!session) { sendJSON(res, req, { error: 'Unauthorized' }, 401); return; }
        try {
            const body = await parseBody(req);
            const empData = await loadEmployees();
            const idx = empData.employees.findIndex(e => e.email === session.email);
            if (idx === -1) {
                // Create a basic record if not in employees.json
                const usersData = await loadUsers();
                const user = usersData.users.find(u => u.email === session.email);
                const newEmp = {
                    id: (empData.employees.length + 1),
                    name: session.name,
                    email: session.email,
                    designation: body.designation || '',
                    department: body.department || '',
                    dateOfJoining: body.dateOfJoining || '',
                    gender: body.gender || '',
                    dob: body.dob || '',
                    address: { current: { line1: body.addr1||'', line2: body.addr2||'', city: body.city||'', state: body.state||'', pincode: body.pincode||'', country: body.country||'India', phone: '', mobile: body.mobile||'' } }
                };
                empData.employees.push(newEmp);
            } else {
                const emp = empData.employees[idx];
                if (body.designation !== undefined) emp.designation = body.designation;
                if (body.department !== undefined)  emp.department  = body.department;
                if (body.dateOfJoining !== undefined) emp.dateOfJoining = body.dateOfJoining;
                if (body.gender !== undefined)      emp.gender      = body.gender;
                if (body.dob !== undefined)         emp.dob         = body.dob;
                if (!emp.address) emp.address = { current: {} };
                if (!emp.address.current) emp.address.current = {};
                if (body.mobile !== undefined)  emp.address.current.mobile  = body.mobile;
                if (body.addr1 !== undefined)   emp.address.current.line1   = body.addr1;
                if (body.addr2 !== undefined)   emp.address.current.line2   = body.addr2;
                if (body.city !== undefined)    emp.address.current.city    = body.city;
                if (body.state !== undefined)   emp.address.current.state   = body.state;
                if (body.pincode !== undefined) emp.address.current.pincode = body.pincode;
                if (body.country !== undefined) emp.address.current.country = body.country;
            }
            await saveEmployees(empData);
            sendJSON(res, req, { success: true });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Register New Employee ─────────────────────────────────────────────
    if (pathname === '/api/register' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!isStr(body.firstName, 50))    { sendJSON(res, req, { error: 'First name is required' }, 400); return; }
            if (!isStr(body.lastName, 50))     { sendJSON(res, req, { error: 'Last name is required' }, 400); return; }
            if (!isStr(body.gender, 10))       { sendJSON(res, req, { error: 'Gender is required' }, 400); return; }
            if (!isDate(body.dob))             { sendJSON(res, req, { error: 'Date of birth is required' }, 400); return; }
            if (!isStr(body.pan, 20))          { sendJSON(res, req, { error: 'PAN is required' }, 400); return; }
            if (!isDate(body.dateOfJoining))   { sendJSON(res, req, { error: 'Date of joining is required' }, 400); return; }
            if (!isStr(body.designation, 100)) { sendJSON(res, req, { error: 'Designation is required' }, 400); return; }
            if (!isStr(body.role, 50))         { sendJSON(res, req, { error: 'Role is required' }, 400); return; }
            if (!isStr(body.currAddr1, 200))   { sendJSON(res, req, { error: 'Current address line 1 is required' }, 400); return; }
            if (!isStr(body.currCity, 100))    { sendJSON(res, req, { error: 'Current city is required' }, 400); return; }
            if (!isStr(body.currState, 50))    { sendJSON(res, req, { error: 'Current state is required' }, 400); return; }
            if (!isStr(body.currPincode, 10))  { sendJSON(res, req, { error: 'Current pincode is required' }, 400); return; }
            if (!isStr(body.currMobile, 15))   { sendJSON(res, req, { error: 'Mobile number is required' }, 400); return; }

            const usersData = await loadUsers();
            const empData   = await loadEmployees();

            const userId      = 'EMP' + String(usersData.nextId).padStart(3, '0');
            const fn          = body.firstName.trim().toLowerCase().replace(/\s+/g, '');
            const ln          = body.lastName.trim().toLowerCase().replace(/\s+/g, '');
            const officeEmail = `${fn}.${ln}@dcstudio.com`;
            const fullName    = [body.firstName.trim(), body.middleName?.trim(), body.lastName.trim()].filter(Boolean).join(' ');

            if (usersData.users.find(u => u.email.toLowerCase() === officeEmail.toLowerCase())) {
                sendJSON(res, req, { error: `Email ${officeEmail} already exists. Try a different name variation.` }, 409);
                return;
            }

            const tempPassword  = 'Welcome@123';
            const salt          = generateSalt();
            const password_hash = hashPassword(tempPassword, salt);

            // Check for duplicate pending approval
            const apprDataReg = await loadApprovals();
            if (apprDataReg.approvals.find(a => a.type === 'employee' && a.status === 'pending' && a.details && a.details.officeEmail && a.details.officeEmail.toLowerCase() === officeEmail.toLowerCase())) {
                sendJSON(res, req, { error: `A pending registration for ${officeEmail} already exists.` }, 409);
                return;
            }

            const regApproval = {
                id: apprDataReg.nextId++,
                type: 'employee',
                ref_id: null,
                title: 'New Employee: ' + fullName,
                details: {
                    userId, fullName,
                    firstName: body.firstName.trim(), middleName: body.middleName?.trim() || '', lastName: body.lastName.trim(),
                    gender: body.gender, dob: body.dob, pan: body.pan.trim().toUpperCase(), aadhaar: body.aadhaar?.trim() || '',
                    dateOfJoining: body.dateOfJoining, designation: body.designation.trim(), role: body.role, salary: parseFloat(body.salary) || 0,
                    reportingManager: body.reportingManager?.trim() || '', isReportingManager: body.isReportingManager === 'Yes',
                    officeEmail, department: body.department?.trim() || 'Design',
                    address: {
                        current: { line1: body.currAddr1.trim(), line2: body.currAddr2?.trim() || '', city: body.currCity.trim(), state: body.currState, pincode: body.currPincode.trim(), country: body.currCountry?.trim() || 'India', phone: body.currPhone?.trim() || '', mobile: body.currMobile.trim() },
                        permanent: body.sameAddress ? null : { line1: body.permAddr1?.trim() || '', line2: body.permAddr2?.trim() || '', city: body.permCity?.trim() || '', state: body.permState || '', pincode: body.permPincode?.trim() || '', country: body.permCountry?.trim() || 'India', phone: body.permPhone?.trim() || '', mobile: body.permMobile?.trim() || '' }
                    },
                    nextOfKin: { name: body.kinName?.trim() || '', relation: body.kinRelation?.trim() || '', contact: body.kinContact?.trim() || '' },
                    password_hash, salt, tempPassword
                },
                submitted_by_id: null,
                submitted_by_name: 'Registration Form',
                submitted_at: new Date().toISOString(),
                month_key: new Date().toISOString().slice(0, 7),
                status: 'pending',
                reviewed_by_id: null,
                reviewed_by_name: null,
                reviewed_at: null,
                comment: null
            };
            apprDataReg.approvals.push(regApproval);
            await saveApprovals(apprDataReg);

            sendJSON(res, req, { success: true, pending: true, name: fullName }, 201);
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── OAuth: Init ───────────────────────────────────────────────────────
    if (pathname === '/api/oauth/init' && req.method === 'GET') {
        const oAuth2Client = createOAuth2Client();
        if (!oAuth2Client) { sendJSON(res, req, { error: 'Failed to load credentials' }, 500); return; }
        const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
        sendJSON(res, req, { authUrl });
        return;
    }

    // ── OAuth: Callback ───────────────────────────────────────────────────
    if ((pathname === '/api/oauth/callback' || pathname === '/auth/google/callback') && req.method === 'GET') {
        if (!query.code) { res.writeHead(400, { 'Content-Type': 'text/html' }); res.end('<h1>Error: No code</h1>'); return; }
        const oAuth2Client = createOAuth2Client();
        try {
            const { tokens } = await oAuth2Client.getToken(query.code);
            saveToken(tokens);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><head><style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;}.box{text-align:center;background:white;padding:40px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.1);}</style></head><body><div class="box"><h1 style="color:#10b981">&#10003; Google Connected!</h1><p>You can close this window.</p><script>setTimeout(()=>{if(window.opener){window.opener.postMessage({type:'GOOGLE_AUTH_SUCCESS'},'*');window.close();}},2000);</script></div></body></html>`);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h1>Auth failed: ${escHtml(error.message)}</h1>`);
        }
        return;
    }

    // ── OAuth: Status ─────────────────────────────────────────────────────
    if (pathname === '/api/oauth/status' && req.method === 'GET') {
        sendJSON(res, req, { authenticated: !!getAuthenticatedClient() });
        return;
    }

    // ── OAuth: Logout ─────────────────────────────────────────────────────
    if (pathname === '/api/oauth/logout' && req.method === 'POST') {
        try {
            if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
            sendJSON(res, req, { success: true });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Employees: Search ─────────────────────────────────────────────────
    if (pathname === '/api/employees/search' && req.method === 'GET') {
        try {
            const q = (query.q || '').toLowerCase().slice(0, 100);
            const { employees } = await loadEmployees();
            const filtered = employees
                .filter(e => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
                .map(({ id, name, email, department, designation }) => ({ id, name, email, department, designation }));
            sendJSON(res, req, { employees: filtered });
        } catch (error) { sendJSON(res, req, { error: 'Failed to search employees' }, 500); }
        return;
    }

    // ── Employees: List ───────────────────────────────────────────────────
    if (pathname === '/api/employees' && req.method === 'GET') {
        try {
            const { employees } = await loadEmployees();
            const safe = employees.map(({ id, name, email, department, designation }) => ({ id, name, email, department, designation }));
            const page = paginate(safe, query);
            sendJSON(res, req, { employees: page.data, total: page.total });
        } catch (error) { sendJSON(res, req, { error: 'Failed to load employees' }, 500); }
        return;
    }

    // ── Meetings: List ────────────────────────────────────────────────────
    if (pathname === '/api/meetings' && req.method === 'GET') {
        try {
            const { meetings } = await loadMeetings();
            const filter = query.filter || 'all';
            const today  = new Date().toISOString().split('T')[0];
            let filtered = meetings;
            if (filter === 'upcoming') filtered = meetings.filter(m => m.meeting_date >= today && m.status !== 'cancelled');
            else if (filter === 'past') filtered = meetings.filter(m => m.meeting_date < today || m.status === 'completed');
            const page = paginate(filtered.slice().reverse(), query);
            sendJSON(res, req, { meetings: page.data, total: page.total });
        } catch (error) { sendJSON(res, req, { error: 'Failed to load meetings' }, 500); }
        return;
    }

    // ── Meetings: Get single ──────────────────────────────────────────────
    if (pathname.match(/^\/api\/meetings\/\d+$/) && req.method === 'GET') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const { meetings } = await loadMeetings();
            const meeting = meetings.find(m => m.id === id);
            meeting ? sendJSON(res, req, { meeting }) : sendJSON(res, req, { error: 'Meeting not found' }, 404);
        } catch (error) { sendJSON(res, req, { error: 'Failed to load meeting' }, 500); }
        return;
    }

    // ── Meetings: Create ──────────────────────────────────────────────────
    if (pathname === '/api/meetings' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!isStr(body.title, 200))                   { sendJSON(res, req, { error: 'Title is required (max 200 chars)' }, 400); return; }
            if (!isDate(body.meeting_date))                 { sendJSON(res, req, { error: 'Invalid meeting_date (YYYY-MM-DD)' }, 400); return; }
            if (!isTime(body.start_time))                   { sendJSON(res, req, { error: 'Invalid start_time (HH:MM)' }, 400); return; }
            if (!isTime(body.end_time))                     { sendJSON(res, req, { error: 'Invalid end_time (HH:MM)' }, 400); return; }
            if (!Array.isArray(body.participants))          { sendJSON(res, req, { error: 'participants must be an array' }, 400); return; }

            const data = await loadMeetings();
            const newMeeting = {
                id: data.nextId++,
                title: body.title.trim(),
                description: isStr(body.description, 2000) ? body.description.trim() : '',
                meeting_date: body.meeting_date,
                start_time: body.start_time,
                end_time: body.end_time,
                timezone: 'Asia/Kolkata',
                status: 'scheduled',
                organizer_name: requireAuth(req)?.name || 'DC Studio',
                organizer_email: ADMIN_EMAIL,
                participants: body.participants.filter(p => isEmail(p.email)).slice(0, 50),
                google_meet_link: null,
                google_event_id: null,
                created_at: new Date().toISOString()
            };

            if (body.createGoogleMeet) {
                const auth = getAuthenticatedClient();
                if (!auth) { sendJSON(res, req, { error: 'Google not authenticated' }, 401); return; }
                const result = await createCalendarEvent(auth, newMeeting);
                if (result.success) { newMeeting.google_meet_link = result.meetLink; newMeeting.google_event_id = result.eventId; }
            }

            if (body.sendInvites && newMeeting.participants.length > 0) {
                const auth = getAuthenticatedClient();
                if (auth) await sendMeetingInvites(auth, newMeeting);
            }

            data.meetings.push(newMeeting);
            await saveMeetings(data);
            sendJSON(res, req, { success: true, meeting: newMeeting }, 201);
        } catch (error) {
            console.error('Create meeting error:', error);
            sendJSON(res, req, { error: error.message || 'Failed to create meeting' }, 500);
        }
        return;
    }

    // ── Meetings: Update status ───────────────────────────────────────────
    if (pathname.match(/^\/api\/meetings\/\d+\/status$/) && req.method === 'PUT') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const allowed = ['scheduled', 'in-progress', 'completed', 'cancelled'];
            if (!allowed.includes(body.status)) { sendJSON(res, req, { error: 'Invalid status' }, 400); return; }
            const data = await loadMeetings();
            const meeting = data.meetings.find(m => m.id === id);
            if (!meeting) { sendJSON(res, req, { error: 'Meeting not found' }, 404); return; }
            meeting.status = body.status;
            meeting.updated_at = new Date().toISOString();
            await saveMeetings(data);
            sendJSON(res, req, { success: true, meeting });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Meetings: Delete ──────────────────────────────────────────────────
    if (pathname.match(/^\/api\/meetings\/\d+$/) && req.method === 'DELETE') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const data = await loadMeetings();
            const idx = data.meetings.findIndex(m => m.id === id);
            if (idx === -1) { sendJSON(res, req, { error: 'Meeting not found' }, 404); return; }
            data.meetings.splice(idx, 1);
            await saveMeetings(data);
            sendJSON(res, req, { success: true });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Tasks: List ───────────────────────────────────────────────────────
    if (pathname === '/api/tasks' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            const data = await loadTasks();
            let tasks = data.tasks;
            if (!isAdmin(session)) {
                const empId = await getEmployeeId(session.email);
                tasks = empId !== null ? tasks.filter(t => t.assignee_id === empId) : [];
            }
            // Apply all filters except status first
            if (query.priority) tasks = tasks.filter(t => t.priority === query.priority);
            if (query.assignee_id) tasks = tasks.filter(t => t.assignee_id === parseInt(query.assignee_id));
            if (query.project)  tasks = tasks.filter(t => t.project === query.project);
            if (query.search) {
                const s = query.search.toLowerCase().slice(0, 100);
                tasks = tasks.filter(t => t.title.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s));
            }
            // Counts computed BEFORE status filter so stat cards always show full distribution
            const counts = {
                total: tasks.length,
                'to-do': tasks.filter(t => t.status === 'to-do').length,
                'in-progress': tasks.filter(t => t.status === 'in-progress').length,
                done: tasks.filter(t => t.status === 'done').length
            };
            // Apply status filter for display only
            if (query.status)   tasks = tasks.filter(t => t.status === query.status);
            const page = paginate(tasks, query);
            sendJSON(res, req, { tasks: page.data, total: page.total, counts });
        } catch (error) { sendJSON(res, req, { error: 'Failed to load tasks' }, 500); }
        return;
    }

    // ── Tasks: Create ─────────────────────────────────────────────────────
    if (pathname === '/api/tasks' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!isStr(body.title, 200)) { sendJSON(res, req, { error: 'Title is required (max 200 chars)' }, 400); return; }
            const priorities = ['low', 'medium', 'high'];
            const statuses   = ['to-do', 'in-progress', 'done'];
            const data = await loadTasks();
            const newTask = {
                id: data.nextId++,
                title:         body.title.trim(),
                description:   isStr(body.description, 2000) ? body.description.trim() : '',
                priority:      priorities.includes(body.priority) ? body.priority : 'medium',
                status:        statuses.includes(body.status)     ? body.status   : 'to-do',
                due_date:      isDate(body.due_date) ? body.due_date : null,
                assignee_id:   body.assignee_id ? parseInt(body.assignee_id) : null,
                assignee_name: isStr(body.assignee_name, 100) ? body.assignee_name.trim() : null,
                project:       isStr(body.project, 100) ? body.project.trim() : null,
                created_at:    new Date().toISOString(),
                updated_at:    new Date().toISOString()
            };
            data.tasks.push(newTask);
            await saveTasks(data);
            sendJSON(res, req, { success: true, task: newTask }, 201);
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Tasks: Quick status change ────────────────────────────────────────
    if (pathname.match(/^\/api\/tasks\/\d+\/status$/) && req.method === 'PATCH') {
        try {
            const session = requireAuth(req);
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const allStatuses = ['to-do', 'in-progress', 'done', 'pending-approval'];
            if (!allStatuses.includes(body.status)) { sendJSON(res, req, { error: 'Invalid status' }, 400); return; }
            const data = await loadTasks();
            const task = data.tasks.find(t => t.id === id);
            if (!task) { sendJSON(res, req, { error: 'Task not found' }, 404); return; }

            if (body.status === 'done' && !isAdmin(session)) {
                // Route through approval
                const apprData = await loadApprovals();
                const taskAppr = {
                    id: apprData.nextId++,
                    type: 'task',
                    ref_id: task.id,
                    title: 'Task Completion: ' + task.title,
                    details: { task_id: task.id, title: task.title, description: task.description, assignee_name: task.assignee_name, project: task.project, due_date: task.due_date, priority: task.priority },
                    submitted_by_id: session ? session.userId : null,
                    submitted_by_name: session ? session.name : 'Unknown',
                    submitted_at: new Date().toISOString(),
                    month_key: new Date().toISOString().slice(0, 7),
                    status: 'pending',
                    reviewed_by_id: null,
                    reviewed_by_name: null,
                    reviewed_at: null,
                    comment: null
                };
                apprData.approvals.push(taskAppr);
                await saveApprovals(apprData);
                task.status = 'pending-approval';
                task.updated_at = new Date().toISOString();
                await saveTasks(data);
                sendJSON(res, req, { success: true, task, approval_pending: true });
            } else {
                if (task.status === 'pending-approval' && !isAdmin(session)) {
                    sendJSON(res, req, { error: 'Task is pending approval. Status cannot be changed.' }, 403); return;
                }
                task.status = body.status;
                task.updated_at = new Date().toISOString();
                await saveTasks(data);
                sendJSON(res, req, { success: true, task });
            }
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Tasks: Get single ─────────────────────────────────────────────────
    if (pathname.match(/^\/api\/tasks\/\d+$/) && req.method === 'GET') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const { tasks } = await loadTasks();
            const task = tasks.find(t => t.id === id);
            task ? sendJSON(res, req, { task }) : sendJSON(res, req, { error: 'Task not found' }, 404);
        } catch (error) { sendJSON(res, req, { error: 'Failed to load task' }, 500); }
        return;
    }

    // ── Tasks: Update ─────────────────────────────────────────────────────
    if (pathname.match(/^\/api\/tasks\/\d+$/) && req.method === 'PUT') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const priorities = ['low', 'medium', 'high'];
            const statuses   = ['to-do', 'in-progress', 'done'];
            const data = await loadTasks();
            const task = data.tasks.find(t => t.id === id);
            if (!task) { sendJSON(res, req, { error: 'Task not found' }, 404); return; }
            if (body.title       !== undefined) task.title       = isStr(body.title, 200) ? body.title.trim() : task.title;
            if (body.description !== undefined) task.description = isStr(body.description, 2000) ? body.description.trim() : '';
            if (body.priority    !== undefined) task.priority    = priorities.includes(body.priority) ? body.priority : task.priority;
            if (body.status      !== undefined) task.status      = statuses.includes(body.status)     ? body.status   : task.status;
            if (body.due_date    !== undefined) task.due_date    = isDate(body.due_date) ? body.due_date : null;
            if (body.assignee_id !== undefined) {
                task.assignee_id   = body.assignee_id ? parseInt(body.assignee_id) : null;
                task.assignee_name = isStr(body.assignee_name, 100) ? body.assignee_name.trim() : null;
            }
            if (body.project !== undefined) task.project = isStr(body.project, 100) ? body.project.trim() : null;
            task.updated_at = new Date().toISOString();
            await saveTasks(data);
            sendJSON(res, req, { success: true, task });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Tasks: Delete ─────────────────────────────────────────────────────
    if (pathname.match(/^\/api\/tasks\/\d+$/) && req.method === 'DELETE') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const data = await loadTasks();
            const idx = data.tasks.findIndex(t => t.id === id);
            if (idx === -1) { sendJSON(res, req, { error: 'Task not found' }, 404); return; }
            data.tasks.splice(idx, 1);
            await saveTasks(data);
            sendJSON(res, req, { success: true });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Calendar: Google events for a month ───────────────────────────────
    if (pathname === '/api/calendar/events' && req.method === 'GET') {
        const month = parseInt(query.month) || (new Date().getMonth() + 1);
        const year  = parseInt(query.year)  || new Date().getFullYear();
        const auth  = getAuthenticatedClient();
        if (!auth) { sendJSON(res, req, { authenticated: false, events: [] }); return; }
        try {
            const calendar = google.calendar({ version: 'v3', auth });
            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: new Date(year, month - 1, 1).toISOString(),
                timeMax: new Date(year, month, 0, 23, 59, 59).toISOString(),
                singleEvents: true, orderBy: 'startTime'
            });
            const events = (response.data.items || []).map(evt => ({
                id: evt.id, title: evt.summary || '(No title)',
                start: evt.start.dateTime || evt.start.date,
                end:   evt.end.dateTime   || evt.end.date,
                meetLink: evt.hangoutLink || evt.conferenceData?.entryPoints?.[0]?.uri || null,
                location: evt.location || null, description: evt.description || '', source: 'google'
            }));
            sendJSON(res, req, { authenticated: true, events });
        } catch (error) {
            console.error('Google Calendar fetch error:', error);
            sendJSON(res, req, { authenticated: true, events: [], error: error.message });
        }
        return;
    }

    // ── Calendar: Combined (Google + meetings + tasks) ─────────────────────
    if (pathname === '/api/calendar/combined' && req.method === 'GET') {
        const session = requireAuth(req);
        const month = parseInt(query.month) || (new Date().getMonth() + 1);
        const year  = parseInt(query.year)  || new Date().getFullYear();
        const combined = [];
        let authenticated = false;
        const calEmpId = isAdmin(session) ? null : (await getEmployeeId(session.email) ?? -1);

        const auth = getAuthenticatedClient();
        if (auth) {
            authenticated = true;
            try {
                const calendar = google.calendar({ version: 'v3', auth });
                const response = await calendar.events.list({
                    calendarId: 'primary',
                    timeMin: new Date(year, month - 1, 1).toISOString(),
                    timeMax: new Date(year, month, 0, 23, 59, 59).toISOString(),
                    singleEvents: true, orderBy: 'startTime'
                });
                (response.data.items || []).forEach(evt => {
                    const start = evt.start.dateTime || evt.start.date;
                    const end   = evt.end.dateTime   || evt.end.date;
                    combined.push({
                        id: 'g-' + evt.id, title: evt.summary || '(No title)', type: 'google',
                        date: start.substring(0, 10),
                        startTime: start.length > 10 ? start.substring(11, 16) : null,
                        endTime:   end.length   > 10 ? end.substring(11, 16)   : null,
                        meetLink: evt.hangoutLink || evt.conferenceData?.entryPoints?.[0]?.uri || null,
                        description: evt.description || '', source: 'google'
                    });
                });
            } catch (error) { console.error('Google Calendar combined error:', error); }
        }

        const { meetings } = await loadMeetings();
        meetings.forEach(m => {
            if (!m.meeting_date) return;
            const [mY, mM] = m.meeting_date.split('-').map(Number);
            if (mY === year && mM === month) {
                combined.push({ id: 'm-' + m.id, title: m.title, type: 'meeting', date: m.meeting_date, startTime: m.start_time || null, endTime: m.end_time || null, meetLink: m.google_meet_link || null, description: m.description || '', status: m.status, source: 'local' });
            }
        });

        const { tasks } = await loadTasks();
        tasks.forEach(t => {
            if (!t.due_date) return;
            if (calEmpId !== null && t.assignee_id !== calEmpId) return;
            const [tY, tM] = t.due_date.split('-').map(Number);
            if (tY === year && tM === month) {
                combined.push({ id: 't-' + t.id, title: t.title, type: 'task', date: t.due_date, priority: t.priority, status: t.status, assignee: t.assignee_name, description: t.description || '', source: 'local' });
            }
        });

        // 4) Project end-date milestones
        const { projects: calProjects } = await loadProjects();
        const calEmpProjectCodes = calEmpId !== null && !isAdminOrManager(session)
            ? new Set(tasks.filter(t => t.assignee_id === calEmpId && t.project).map(t => t.project))
            : null;
        calProjects.forEach(p => {
            if (!p.end_date) return;
            if (calEmpProjectCodes !== null && !calEmpProjectCodes.has(p.code)) return;
            const [pY, pM] = p.end_date.split('-').map(Number);
            if (pY === year && pM === month) {
                combined.push({ id: 'p-' + p.id, title: p.name + ' — Deadline', type: 'project', date: p.end_date, status: p.status, phase: p.current_phase, client: p.client, description: 'Project deadline · ' + (p.client || ''), source: 'local' });
            }
        });

        sendJSON(res, req, { events: combined, authenticated });
        return;
    }

    // ── Calendar: Quick-add event ─────────────────────────────────────────
    if (pathname === '/api/calendar/events' && req.method === 'POST') {
        const auth = getAuthenticatedClient();
        if (!auth) { sendJSON(res, req, { error: 'Google not authenticated' }, 401); return; }
        try {
            const body = await parseBody(req);
            if (!isStr(body.title, 200) || !isDate(body.date) || !isTime(body.start_time) || !isTime(body.end_time)) {
                sendJSON(res, req, { error: 'title, date (YYYY-MM-DD), start_time and end_time (HH:MM) are required' }, 400);
                return;
            }
            const result = await createCalendarEvent(auth, { title: body.title.trim(), meeting_date: body.date, start_time: body.start_time, end_time: body.end_time, description: isStr(body.description, 2000) ? body.description.trim() : '', participants: [] });
            result.success
                ? sendJSON(res, req, { success: true, eventId: result.eventId, meetLink: result.meetLink, htmlLink: result.htmlLink }, 201)
                : sendJSON(res, req, { error: result.error }, 500);
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Payslips: List ────────────────────────────────────────────────────
    if (pathname === '/api/salary/payslips' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            const data = await loadPayslips();
            const list = isAdmin(session) ? data.payslips : data.payslips.filter(p => p.user_id === session.userId);
            const page = paginate(list.slice().reverse(), query);
            sendJSON(res, req, { payslips: page.data, total: page.total });
        } catch (error) { sendJSON(res, req, { error: 'Failed to load payslips' }, 500); }
        return;
    }

    // ── Payslips: Get single ──────────────────────────────────────────────
    if (pathname.match(/^\/api\/salary\/payslips\/\d+$/) && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            const id = parseInt(pathname.split('/')[4]);
            const { payslips } = await loadPayslips();
            const payslip = isAdmin(session)
                ? payslips.find(p => p.id === id)
                : payslips.find(p => p.id === id && p.user_id === session.userId);
            if (!payslip) { sendJSON(res, req, { error: 'Payslip not found' }, 404); return; }

            // Enrich with employee profile + leave stats
            const { employees } = await loadEmployees();
            const usersData = await loadUsers();
            const payUser = usersData.users.find(u => u.id === payslip.user_id);
            const emp = payUser ? employees.find(e => e.email === payUser.email) : null;

            const periodDate = new Date(payslip.period_date + 'T00:00:00');
            const year = periodDate.getFullYear();
            const month = periodDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let workingDays = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                if (new Date(year, month, d).getDay() !== 0) workingDays++;
            }

            const leavesData = await loadLeaves();
            const allocations = leavesData.allocations.filter(a => a.year === year);
            const leaveTypes = ['CL', 'PL', 'SL'];
            const periodStr = String(year) + '-' + String(month + 1).padStart(2, '0');
            const periodLeaves = leavesData.requests.filter(r =>
                r.user_id === payslip.user_id && r.status === 'approved' &&
                (r.from_date.startsWith(periodStr) || r.to_date.startsWith(periodStr))
            );
            const leavesTaken = periodLeaves.reduce((s, r) => s + (r.no_days || 0), 0);

            const usedByType = {};
            leavesData.requests
                .filter(r => r.user_id === payslip.user_id && r.status === 'approved' && r.from_date.startsWith(String(year)))
                .forEach(r => { usedByType[r.type] = (usedByType[r.type] || 0) + (r.no_days || 0); });

            let lop = 0;
            leaveTypes.forEach(t => {
                const alloc = (allocations.find(a => a.type === t) || {}).allocated || 0;
                if ((usedByType[t] || 0) > alloc) lop += (usedByType[t] || 0) - alloc;
            });

            const leaveBalByType = {};
            leaveTypes.forEach(t => {
                const alloc = (allocations.find(a => a.type === t) || {}).allocated || 0;
                leaveBalByType[t] = Math.max(0, alloc - (usedByType[t] || 0));
            });
            const leaveBalance = Object.values(leaveBalByType).reduce((s, v) => s + v, 0);

            const leave_stats = {
                days_in_month: daysInMonth,
                working_days: workingDays,
                present: Math.max(0, workingDays - leavesTaken),
                leaves_taken: leavesTaken,
                lop,
                lwp: 0,
                leave_balance: leaveBalance,
                leave_balance_by_type: leaveBalByType
            };

            const employee_profile = emp ? {
                name: emp.name || (payUser ? payUser.name : ''),
                userId: emp.userId || '',
                designation: emp.designation || '',
                department: emp.department || '',
                dateOfJoining: emp.dateOfJoining || '',
                mobile: emp.address && emp.address.current ? emp.address.current.mobile || '' : '',
                dob: emp.dob || '',
                gender: emp.gender || '',
                pan: emp.pan || ''
            } : { name: payUser ? payUser.name : '' };

            sendJSON(res, req, { payslip, leave_stats, employee_profile });
        } catch (error) { sendJSON(res, req, { error: 'Failed to load payslip' }, 500); }
        return;
    }

    // ── Reimbursements: List ──────────────────────────────────────────────
    if (pathname === '/api/reimbursements' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            const data = await loadReimbursements();
            const usersData = await loadUsers();
            const userMap = {};
            usersData.users.forEach(u => { userMap[u.id] = u.name; });
            const showAllReim = isAdminOrManager(session) && query.all === '1';
            const list = (showAllReim ? data.claims : data.claims.filter(c => c.user_id === session.userId))
                .map(c => ({ ...c, employee_name: c.employee_name || userMap[c.user_id] || ('User #' + c.user_id) }));
            const page = paginate(list.slice().reverse(), query);
            sendJSON(res, req, { claims: page.data, total: page.total });
        } catch (error) { sendJSON(res, req, { error: 'Failed to load reimbursements' }, 500); }
        return;
    }

    // ── Reimbursements: Submit ────────────────────────────────────────────
    if (pathname === '/api/reimbursements' && req.method === 'POST') {
        try {
            const session = requireAuth(req);
            const body = await parseBody(req);
            if (!isDate(body.expense_date))          { sendJSON(res, req, { error: 'Valid expense_date (YYYY-MM-DD) is required' }, 400); return; }
            if (!isNum(parseFloat(body.amount)) || parseFloat(body.amount) <= 0) { sendJSON(res, req, { error: 'Valid positive amount is required' }, 400); return; }
            if (!isStr(body.description, 1000))      { sendJSON(res, req, { error: 'Description is required (max 1000 chars)' }, 400); return; }
            const data = await loadReimbursements();
            const VALID_CATEGORIES = ['Food', 'Stay', 'Travel', 'Others'];
            // Admin can create on behalf of another employee
            let claimUserId = session.userId;
            let claimEmployeeName = session.name || '';
            if (isAdmin(session) && body.for_user_id) {
                const usersData = await loadUsers();
                const targetUser = usersData.users.find(u => u.id === parseInt(body.for_user_id));
                if (targetUser) {
                    claimUserId = targetUser.id;
                    claimEmployeeName = targetUser.name;
                } else if (isStr(body.employee_name, 100)) {
                    claimEmployeeName = body.employee_name.trim();
                }
            }
            // Handle base64 file upload
            let savedFileName = isStr(body.file_name, 255) ? body.file_name.trim() : null;
            let savedFilePath = null;
            if (savedFileName && isStr(body.file_data, 10 * 1024 * 1024)) {
                try {
                    const ext = path.extname(savedFileName).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) {
                        const uniqueName = Date.now() + '_' + crypto.randomBytes(4).toString('hex') + ext;
                        const base64Data = body.file_data.replace(/^data:[^;]+;base64,/, '');
                        await fs.promises.writeFile(path.join(UPLOADS_DIR, uniqueName), Buffer.from(base64Data, 'base64'));
                        savedFilePath = '/uploads/' + uniqueName;
                    }
                } catch (_) {}
            }

            const newClaim = {
                id: data.nextId++,
                user_id: claimUserId,
                employee_name: claimEmployeeName,
                expense_date: body.expense_date,
                amount: parseFloat(body.amount),
                category: VALID_CATEGORIES.includes(body.category) ? body.category : 'Others',
                project: isStr(body.project, 200) ? body.project.trim() : '',
                description: body.description.trim(),
                file_name: savedFileName,
                file_path: savedFilePath,
                status: 'pending',
                approver_comments: '',
                created_at: new Date().toISOString()
            };
            data.claims.push(newClaim);
            await saveReimbursements(data);
            sendJSON(res, req, { success: true, claim: newClaim }, 201);
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Reimbursements: Approve / Reject ──────────────────────────────────
    if (pathname.match(/^\/api\/reimbursements\/\d+$/) && req.method === 'PATCH') {
        try {
            const session = requireAuth(req);
            if (!isAdminOrManager(session)) { sendJSON(res, req, { error: 'Admin or Manager access required' }, 403); return; }
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const validStatuses = ['approved', 'rejected'];
            if (!validStatuses.includes(body.status)) { sendJSON(res, req, { error: 'status must be approved or rejected' }, 400); return; }
            const data = await loadReimbursements();
            const claim = data.claims.find(c => c.id === id);
            if (!claim) { sendJSON(res, req, { error: 'Claim not found' }, 404); return; }
            if (claim.status !== 'pending') { sendJSON(res, req, { error: 'Only pending claims can be approved or rejected' }, 400); return; }
            claim.status = body.status;
            claim.approver_comments = isStr(body.approver_comments, 500) ? body.approver_comments.trim() : '';
            claim.actioned_at = new Date().toISOString();
            await saveReimbursements(data);
            sendJSON(res, req, { success: true, claim });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Reimbursements: Cancel ────────────────────────────────────────────
    if (pathname.match(/^\/api\/reimbursements\/\d+$/) && req.method === 'DELETE') {
        try {
            const session = requireAuth(req);
            const id = parseInt(pathname.split('/')[3]);
            const data = await loadReimbursements();
            const idx = isAdmin(session)
                ? data.claims.findIndex(c => c.id === id)
                : data.claims.findIndex(c => c.id === id && c.user_id === session.userId);
            if (idx === -1) { sendJSON(res, req, { error: 'Claim not found' }, 404); return; }
            if (data.claims[idx].status !== 'pending') { sendJSON(res, req, { error: 'Only pending claims can be cancelled' }, 400); return; }
            data.claims[idx].status = 'cancelled';
            await saveReimbursements(data);
            sendJSON(res, req, { success: true });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Leaves: Summary ───────────────────────────────────────────────────
    if (pathname === '/api/leaves/summary' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            const year = parseInt(query.year) || new Date().getFullYear();
            const data = await loadLeaves();
            const summary = data.allocations
                .filter(a => a.year === year)
                .map(alloc => {
                    const showAllSummary = isAdminOrManager(session) && query.all === '1';
                    const reqs = showAllSummary
                        ? data.requests.filter(r => r.type === alloc.type && r.from_date?.startsWith(String(year)))
                        : data.requests.filter(r => r.type === alloc.type && r.user_id === session.userId && r.from_date?.startsWith(String(year)));
                    const pending  = reqs.filter(r => r.status === 'pending').reduce((s, r) => s + r.no_days, 0);
                    const approved = reqs.filter(r => r.status === 'approved').reduce((s, r) => s + r.no_days, 0);
                    return { type: alloc.type, label: alloc.label, allocated: alloc.allocated, pending, approved, balance: alloc.allocated - approved };
                });
            sendJSON(res, req, { summary });
        } catch (error) { sendJSON(res, req, { error: 'Failed to load leave summary' }, 500); }
        return;
    }

    // ── Leaves: List ─────────────────────────────────────────────────────
    if (pathname === '/api/leaves' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            const data = await loadLeaves();
            const usersData = await loadUsers();
            const userMap = {};
            usersData.users.forEach(u => { userMap[u.id] = u.name; });
            const showAll = isAdminOrManager(session) && query.all === '1';
            const list = (showAll ? data.requests : data.requests.filter(r => r.user_id === session.userId))
                .map(r => ({ ...r, employee_name: r.employee_name || userMap[r.user_id] || ('User #' + r.user_id) }));
            const page = paginate(list.slice().reverse(), query);
            sendJSON(res, req, { leaves: page.data, total: page.total });
        } catch (error) { sendJSON(res, req, { error: 'Failed to load leaves' }, 500); }
        return;
    }

    // ── Leaves: Apply ─────────────────────────────────────────────────────
    if (pathname === '/api/leaves' && req.method === 'POST') {
        try {
            const session = requireAuth(req);
            const body = await parseBody(req);
            const types = ['CL', 'PL', 'SL'];
            if (!types.includes(body.type))   { sendJSON(res, req, { error: 'Invalid leave type. Use CL, PL or SL' }, 400); return; }
            if (!isDate(body.from_date))      { sendJSON(res, req, { error: 'Valid from_date (YYYY-MM-DD) is required' }, 400); return; }
            if (!isDate(body.to_date))        { sendJSON(res, req, { error: 'Valid to_date (YYYY-MM-DD) is required' }, 400); return; }
            if (body.to_date < body.from_date){ sendJSON(res, req, { error: 'to_date cannot be before from_date' }, 400); return; }
            const noDays = parseFloat(body.no_days);
            if (!isNum(noDays) || noDays <= 0){ sendJSON(res, req, { error: 'no_days must be a positive number' }, 400); return; }
            const data = await loadLeaves();
            const newLeave = {
                id: data.nextId++,
                user_id: session.userId,
                employee_name: session.name || '',
                type: body.type,
                from_date: body.from_date,
                to_date: body.to_date,
                next_joining_date: isDate(body.next_joining_date) ? body.next_joining_date : null,
                no_days: noDays,
                reason: isStr(body.reason, 500) ? body.reason.trim() : '',
                status: 'pending',
                approver_comments: '',
                created_at: new Date().toISOString()
            };
            data.requests.push(newLeave);
            await saveLeaves(data);
            sendJSON(res, req, { success: true, leave: newLeave }, 201);
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Leaves: Approve / Reject ──────────────────────────────────────────
    if (pathname.match(/^\/api\/leaves\/\d+$/) && req.method === 'PATCH') {
        try {
            const session = requireAuth(req);
            if (!isAdminOrManager(session)) { sendJSON(res, req, { error: 'Admin or Manager access required' }, 403); return; }
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const validStatuses = ['approved', 'rejected'];
            if (!validStatuses.includes(body.status)) { sendJSON(res, req, { error: 'status must be approved or rejected' }, 400); return; }
            const data = await loadLeaves();
            const leave = data.requests.find(r => r.id === id);
            if (!leave) { sendJSON(res, req, { error: 'Leave request not found' }, 404); return; }
            if (leave.status !== 'pending') { sendJSON(res, req, { error: 'Only pending requests can be approved or rejected' }, 400); return; }
            leave.status = body.status;
            leave.approver_comments = isStr(body.approver_comments, 500) ? body.approver_comments.trim() : '';
            leave.actioned_at = new Date().toISOString();
            await saveLeaves(data);
            sendJSON(res, req, { success: true, leave });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Leaves: Cancel ────────────────────────────────────────────────────
    if (pathname.match(/^\/api\/leaves\/\d+$/) && req.method === 'DELETE') {
        try {
            const session = requireAuth(req);
            const id = parseInt(pathname.split('/')[3]);
            const data = await loadLeaves();
            const idx = isAdmin(session)
                ? data.requests.findIndex(r => r.id === id)
                : data.requests.findIndex(r => r.id === id && r.user_id === session.userId);
            if (idx === -1) { sendJSON(res, req, { error: 'Leave request not found' }, 404); return; }
            if (data.requests[idx].status !== 'pending') { sendJSON(res, req, { error: 'Only pending requests can be cancelled' }, 400); return; }
            data.requests[idx].status = 'cancelled';
            await saveLeaves(data);
            sendJSON(res, req, { success: true });
        } catch (error) { sendJSON(res, req, { error: error.message }, 500); }
        return;
    }

    // ── Projects: List ────────────────────────────────────────────────────
    if (pathname === '/api/projects' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            const data = await loadProjects();
            let projects = data.projects;
            if (!isAdminOrManager(session)) {
                const empId = await getEmployeeId(session.email);
                if (empId === null) {
                    projects = [];
                } else {
                    const { tasks } = await loadTasks();
                    const empProjectCodes = new Set(
                        tasks.filter(t => t.assignee_id === empId && t.project).map(t => t.project)
                    );
                    projects = projects.filter(p => empProjectCodes.has(p.code));
                }
            }
            if (query.status) projects = projects.filter(p => p.status === query.status);
            if (query.phase)  projects = projects.filter(p => p.current_phase === query.phase);
            const page = paginate(projects.slice().reverse(), query);
            sendJSON(res, req, { projects: page.data, total: page.total });
        } catch (e) { sendJSON(res, req, { error: 'Failed to load projects' }, 500); }
        return;
    }

    // ── Projects: Create ──────────────────────────────────────────────────
    if (pathname === '/api/projects' && req.method === 'POST') {
        try {
            const session = requireAuth(req);
            if (!isAdmin(session)) { sendJSON(res, req, { error: 'Admin access required' }, 403); return; }
            const body = await parseBody(req);
            if (!isStr(body.name, 200))   { sendJSON(res, req, { error: 'Project name is required' }, 400); return; }
            if (!isStr(body.client, 200)) { sendJSON(res, req, { error: 'Client name is required' }, 400); return; }
            const validPhases = ['concept','design','approval','construction','handover'];
            const data = await loadProjects();
            const nextCode = 'DC-' + String(data.nextId).padStart(3, '0');
            const newProject = {
                id: data.nextId++,
                code: nextCode,
                name: body.name.trim(),
                client: body.client.trim(),
                client_email: isStr(body.client_email, 254) ? body.client_email.trim() : '',
                client_phone: isStr(body.client_phone, 30) ? body.client_phone.trim() : '',
                location: isStr(body.location, 300) ? body.location.trim() : '',
                area_sqft: isNum(parseFloat(body.area_sqft)) ? parseFloat(body.area_sqft) : 0,
                description: isStr(body.description, 2000) ? body.description.trim() : '',
                current_phase: validPhases.includes(body.current_phase) ? body.current_phase : 'concept',
                phases_done: [],
                start_date: isDate(body.start_date) ? body.start_date : null,
                end_date: isDate(body.end_date) ? body.end_date : null,
                team_member_ids: Array.isArray(body.team_member_ids) ? body.team_member_ids.map(Number).filter(n => !isNaN(n)) : [],
                status: ['active','on-hold','completed'].includes(body.status) ? body.status : 'active',
                // Admin-only fields
                customer_gstin:          isStr(body.customer_gstin, 15)   ? body.customer_gstin.trim()   : '',
                billing_address:         isStr(body.billing_address, 500)  ? body.billing_address.trim()  : '',
                project_type:            isStr(body.project_type, 50)      ? body.project_type.trim()     : '',
                booking_office:          isStr(body.booking_office, 100) ? body.booking_office.trim()  : '',
                site_name:               isStr(body.site_name, 200)        ? body.site_name.trim()        : '',
                site_address:            isStr(body.site_address, 500)     ? body.site_address.trim()     : '',
                size:                    isNum(parseFloat(body.size))     ? parseFloat(body.size)       : 0,
                unit_of_measurement:     isStr(body.unit_of_measurement, 50) ? body.unit_of_measurement.trim() : '',
                expected_duration_days:  Number.isInteger(parseInt(body.expected_duration_days)) ? parseInt(body.expected_duration_days) : 0,
                contact_person:          isStr(body.contact_person, 100) ? body.contact_person.trim()  : '',
                contact_mobile:          isStr(body.contact_mobile, 20)  ? body.contact_mobile.trim()  : '',
                contact_phone:           isStr(body.contact_phone, 20)   ? body.contact_phone.trim()   : '',
                contact_email:           isStr(body.contact_email, 254)  ? body.contact_email.trim()   : '',
                project_notes:           isStr(body.project_notes, 3000) ? body.project_notes.trim()   : '',
                document_folder_path:    isStr(body.document_folder_path, 500) ? body.document_folder_path.trim() : '',
                project_currency:        isStr(body.project_currency, 10) ? body.project_currency.trim() : 'INR',
                overall_project_value:   isNum(parseFloat(body.overall_project_value))   ? parseFloat(body.overall_project_value)   : 0,
                consultancy_charges_pct: isNum(parseFloat(body.consultancy_charges_pct)) ? parseFloat(body.consultancy_charges_pct) : 0,
                retention_amount:        isNum(parseFloat(body.retention_amount))        ? parseFloat(body.retention_amount)        : 0,
                retention_amount_type:   ['%','fixed'].includes(body.retention_amount_type) ? body.retention_amount_type : '%',
                handover_date:           isDate(body.handover_date)     ? body.handover_date     : null,
                retention_period:        Number.isInteger(parseInt(body.retention_period)) ? parseInt(body.retention_period) : 0,
                retention_period_unit:   ['Days','Weeks','Months','Years'].includes(body.retention_period_unit) ? body.retention_period_unit : '',
                retention_due_date:      isDate(body.retention_due_date) ? body.retention_due_date : null,
                retention_description:   isStr(body.retention_description, 2000) ? body.retention_description.trim() : '',
                project_ref_code:        isStr(body.project_ref_code, 50)    ? body.project_ref_code.trim()    : '',
                payment_terms:           Array.isArray(body.payment_terms) ? body.payment_terms.map(t => ({
                    date:        isDate(t.date) ? t.date : null,
                    description: isStr(t.description, 500) ? t.description.trim() : '',
                    amount:      isNum(parseFloat(t.amount)) ? parseFloat(t.amount) : 0,
                    unit:        ['%','fixed'].includes(t.unit) ? t.unit : '%',
                    value:       isNum(parseFloat(t.value))  ? parseFloat(t.value)  : 0
                })) : [],
                client_contacts:         Array.isArray(body.client_contacts) ? body.client_contacts.map(c => ({
                    name:  isStr(c.name,  200) ? c.name.trim()  : '',
                    email: isStr(c.email, 254) ? c.email.trim() : ''
                })).filter(c => c.name || c.email) : [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            data.projects.push(newProject);
            await saveProjects(data);
            sendJSON(res, req, { success: true, project: newProject }, 201);
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Projects: Get single ──────────────────────────────────────────────
    if (pathname.match(/^\/api\/projects\/\d+$/) && req.method === 'GET') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const { projects } = await loadProjects();
            const p = projects.find(x => x.id === id);
            p ? sendJSON(res, req, { project: p }) : sendJSON(res, req, { error: 'Project not found' }, 404);
        } catch (e) { sendJSON(res, req, { error: 'Failed to load project' }, 500); }
        return;
    }

    // ── Projects: Update ─────────────────────────────────────────────────
    if (pathname.match(/^\/api\/projects\/\d+$/) && req.method === 'PUT') {
        try {
            const session = requireAuth(req);
            if (!isAdmin(session)) { sendJSON(res, req, { error: 'Admin access required' }, 403); return; }
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const validPhases = ['concept','design','approval','construction','handover'];
            const data = await loadProjects();
            const p = data.projects.find(x => x.id === id);
            if (!p) { sendJSON(res, req, { error: 'Project not found' }, 404); return; }
            if (isStr(body.name, 200))         p.name         = body.name.trim();
            if (isStr(body.client, 200))       p.client       = body.client.trim();
            if (isStr(body.client_email, 254)) p.client_email = body.client_email.trim();
            if (isStr(body.client_phone, 30))  p.client_phone = body.client_phone.trim();
            if (isStr(body.location, 300))     p.location     = body.location.trim();
            if (isNum(parseFloat(body.area_sqft))) p.area_sqft = parseFloat(body.area_sqft);
            if (isStr(body.description, 2000)) p.description  = body.description.trim();
            if (validPhases.includes(body.current_phase)) p.current_phase = body.current_phase;
            if (isDate(body.start_date)) p.start_date = body.start_date;
            if (isDate(body.end_date))   p.end_date   = body.end_date;
            if (Array.isArray(body.team_member_ids)) p.team_member_ids = body.team_member_ids.map(Number).filter(n => !isNaN(n));
            if (['active','on-hold','completed'].includes(body.status)) p.status = body.status;
            // Admin-only fields
            if (body.customer_gstin   !== undefined) p.customer_gstin   = isStr(body.customer_gstin, 15)   ? body.customer_gstin.trim()   : '';
            if (body.billing_address  !== undefined) p.billing_address  = isStr(body.billing_address, 500) ? body.billing_address.trim()  : '';
            if (body.project_type     !== undefined) p.project_type     = isStr(body.project_type, 50)     ? body.project_type.trim()     : '';
            if (body.booking_office   !== undefined) p.booking_office   = isStr(body.booking_office, 100)  ? body.booking_office.trim()   : '';
            if (body.site_name        !== undefined) p.site_name        = isStr(body.site_name, 200)        ? body.site_name.trim()        : '';
            if (body.site_address     !== undefined) p.site_address     = isStr(body.site_address, 500)     ? body.site_address.trim()     : '';
            if (body.size                    !== undefined) p.size                    = isNum(parseFloat(body.size))      ? parseFloat(body.size)       : 0;
            if (body.unit_of_measurement     !== undefined) p.unit_of_measurement     = isStr(body.unit_of_measurement, 50) ? body.unit_of_measurement.trim() : '';
            if (body.expected_duration_days  !== undefined) p.expected_duration_days  = parseInt(body.expected_duration_days) || 0;
            if (body.contact_person          !== undefined) p.contact_person          = isStr(body.contact_person, 100)  ? body.contact_person.trim()  : '';
            if (body.contact_mobile          !== undefined) p.contact_mobile          = isStr(body.contact_mobile, 20)   ? body.contact_mobile.trim()  : '';
            if (body.contact_phone           !== undefined) p.contact_phone           = isStr(body.contact_phone, 20)    ? body.contact_phone.trim()   : '';
            if (body.contact_email           !== undefined) p.contact_email           = isStr(body.contact_email, 254)   ? body.contact_email.trim()   : '';
            if (body.project_notes           !== undefined) p.project_notes           = isStr(body.project_notes, 3000)  ? body.project_notes.trim()   : '';
            if (body.document_folder_path    !== undefined) p.document_folder_path    = isStr(body.document_folder_path, 500) ? body.document_folder_path.trim() : '';
            if (body.project_currency        !== undefined) p.project_currency        = isStr(body.project_currency, 10) ? body.project_currency.trim() : 'INR';
            if (body.overall_project_value   !== undefined) p.overall_project_value   = parseFloat(body.overall_project_value)   || 0;
            if (body.consultancy_charges_pct !== undefined) p.consultancy_charges_pct = parseFloat(body.consultancy_charges_pct) || 0;
            if (body.retention_amount        !== undefined) p.retention_amount        = parseFloat(body.retention_amount)        || 0;
            if (body.retention_amount_type   !== undefined && ['%','fixed'].includes(body.retention_amount_type)) p.retention_amount_type = body.retention_amount_type;
            if (body.handover_date           !== undefined) p.handover_date           = isDate(body.handover_date) ? body.handover_date : null;
            if (body.retention_period        !== undefined) p.retention_period        = parseInt(body.retention_period) || 0;
            if (body.retention_period_unit   !== undefined && ['','Days','Weeks','Months','Years'].includes(body.retention_period_unit)) p.retention_period_unit = body.retention_period_unit;
            if (body.retention_due_date      !== undefined) p.retention_due_date      = isDate(body.retention_due_date) ? body.retention_due_date : null;
            if (body.retention_description   !== undefined) p.retention_description   = isStr(body.retention_description, 2000) ? body.retention_description.trim() : '';
            if (body.project_ref_code !== undefined) p.project_ref_code = isStr(body.project_ref_code, 50) ? body.project_ref_code.trim() : '';
            if (Array.isArray(body.payment_terms)) p.payment_terms = body.payment_terms.map(t => ({
                date:        isDate(t.date) ? t.date : null,
                description: isStr(t.description, 500) ? t.description.trim() : '',
                amount:      parseFloat(t.amount) || 0,
                unit:        ['%','fixed'].includes(t.unit) ? t.unit : '%',
                value:       parseFloat(t.value) || 0
            }));
            if (Array.isArray(body.client_contacts)) p.client_contacts = body.client_contacts.map(c => ({
                name:  isStr(c.name,  200) ? c.name.trim()  : '',
                email: isStr(c.email, 254) ? c.email.trim() : ''
            })).filter(c => c.name || c.email);
            p.updated_at = new Date().toISOString();
            await saveProjects(data);
            sendJSON(res, req, { success: true, project: p });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Projects: Advance phase ───────────────────────────────────────────
    if (pathname.match(/^\/api\/projects\/\d+\/phase$/) && req.method === 'PATCH') {
        try {
            const session = requireAuth(req);
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const validPhases = ['concept','design','approval','construction','handover'];
            if (!validPhases.includes(body.phase)) { sendJSON(res, req, { error: 'Invalid phase' }, 400); return; }
            const data = await loadProjects();
            const p = data.projects.find(x => x.id === id);
            if (!p) { sendJSON(res, req, { error: 'Project not found' }, 404); return; }

            if (isAdmin(session)) {
                // Admin advances directly
                if (!p.phases_done) p.phases_done = [];
                if (!p.phases_done.includes(p.current_phase)) p.phases_done.push(p.current_phase);
                p.current_phase = body.phase;
                delete p.pending_phase;
                p.updated_at = new Date().toISOString();
                await saveProjects(data);
                sendJSON(res, req, { success: true, project: p });
            } else {
                // Non-admin: create approval request
                const apprData = await loadApprovals();
                const existingPhaseAppr = apprData.approvals.find(a => a.type === 'project' && a.ref_id === id && a.status === 'pending');
                if (existingPhaseAppr) { sendJSON(res, req, { error: 'A phase change approval is already pending for this project.' }, 409); return; }
                const phaseAppr = {
                    id: apprData.nextId++,
                    type: 'project',
                    ref_id: id,
                    title: 'Phase Advance: ' + p.name,
                    details: { project_id: id, project_name: p.name, project_code: p.code || '', current_phase: p.current_phase, requested_phase: body.phase },
                    submitted_by_id: session ? session.userId : null,
                    submitted_by_name: session ? session.name : 'Unknown',
                    submitted_at: new Date().toISOString(),
                    month_key: new Date().toISOString().slice(0, 7),
                    status: 'pending',
                    reviewed_by_id: null,
                    reviewed_by_name: null,
                    reviewed_at: null,
                    comment: null
                };
                apprData.approvals.push(phaseAppr);
                await saveApprovals(apprData);
                p.pending_phase = body.phase;
                p.updated_at = new Date().toISOString();
                await saveProjects(data);
                sendJSON(res, req, { success: true, pending: true, project: p });
            }
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Projects: Update members ──────────────────────────────────────────
    if (pathname.match(/^\/api\/projects\/\d+\/members$/) && req.method === 'PATCH') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            if (!Array.isArray(body.team_member_ids)) { sendJSON(res, req, { error: 'team_member_ids required' }, 400); return; }
            const data = await loadProjects();
            const p = data.projects.find(x => x.id === id);
            if (!p) { sendJSON(res, req, { error: 'Project not found' }, 404); return; }
            p.team_member_ids = body.team_member_ids.map(Number).filter(n => !isNaN(n));
            p.updated_at = new Date().toISOString();
            await saveProjects(data);
            sendJSON(res, req, { success: true, project: p });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Projects: Delete ──────────────────────────────────────────────────
    if (pathname.match(/^\/api\/projects\/\d+$/) && req.method === 'DELETE') {
        try {
            const session = requireAuth(req);
            if (!isAdmin(session)) { sendJSON(res, req, { error: 'Admin access required' }, 403); return; }
            const id = parseInt(pathname.split('/')[3]);
            const data = await loadProjects();
            const idx = data.projects.findIndex(x => x.id === id);
            if (idx === -1) { sendJSON(res, req, { error: 'Project not found' }, 404); return; }
            data.projects.splice(idx, 1);
            await saveProjects(data);
            sendJSON(res, req, { success: true });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Team: List ────────────────────────────────────────────────────────
    if (pathname === '/api/team' && req.method === 'GET') {
        try {
            const data = await loadTeam();
            let members = data.members;
            if (query.department) members = members.filter(m => m.department === query.department);
            const page = paginate(members, query);
            sendJSON(res, req, { members: page.data, total: page.total });
        } catch (e) { sendJSON(res, req, { error: 'Failed to load team' }, 500); }
        return;
    }

    // ── Team: Create ──────────────────────────────────────────────────────
    if (pathname === '/api/team' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!isStr(body.name, 100))        { sendJSON(res, req, { error: 'Name is required' }, 400); return; }
            if (!isStr(body.designation, 100)) { sendJSON(res, req, { error: 'Designation is required' }, 400); return; }
            if (!isEmail(body.email))          { sendJSON(res, req, { error: 'Valid email is required' }, 400); return; }
            const data = await loadTeam();
            const newMember = {
                id: data.nextId++,
                name:        body.name.trim(),
                designation: body.designation.trim(),
                department:  isStr(body.department, 100) ? body.department.trim() : 'Design',
                email:       body.email.trim(),
                phone:       isStr(body.phone, 30) ? body.phone.trim() : '',
                skills:      Array.isArray(body.skills) ? body.skills.filter(s => isStr(s, 50)).map(s => s.trim()).slice(0, 20) : [],
                joined_date: isDate(body.joined_date) ? body.joined_date : null,
                created_at:  new Date().toISOString()
            };
            data.members.push(newMember);
            await saveTeam(data);
            sendJSON(res, req, { success: true, member: newMember }, 201);
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Team: Get single ──────────────────────────────────────────────────
    if (pathname.match(/^\/api\/team\/\d+$/) && req.method === 'GET') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const { members } = await loadTeam();
            const m = members.find(x => x.id === id);
            m ? sendJSON(res, req, { member: m }) : sendJSON(res, req, { error: 'Member not found' }, 404);
        } catch (e) { sendJSON(res, req, { error: 'Failed to load member' }, 500); }
        return;
    }

    // ── Team: Update ──────────────────────────────────────────────────────
    if (pathname.match(/^\/api\/team\/\d+$/) && req.method === 'PUT') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const data = await loadTeam();
            const m = data.members.find(x => x.id === id);
            if (!m) { sendJSON(res, req, { error: 'Member not found' }, 404); return; }
            if (isStr(body.name, 100))        m.name        = body.name.trim();
            if (isStr(body.designation, 100)) m.designation = body.designation.trim();
            if (isStr(body.department, 100))  m.department  = body.department.trim();
            if (isEmail(body.email))          m.email       = body.email.trim();
            if (isStr(body.phone, 30))        m.phone       = body.phone.trim();
            if (Array.isArray(body.skills))   m.skills      = body.skills.filter(s => isStr(s, 50)).map(s => s.trim()).slice(0, 20);
            if (isDate(body.joined_date))     m.joined_date = body.joined_date;
            await saveTeam(data);
            sendJSON(res, req, { success: true, member: m });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Team: Delete ──────────────────────────────────────────────────────
    if (pathname.match(/^\/api\/team\/\d+$/) && req.method === 'DELETE') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const data = await loadTeam();
            const idx = data.members.findIndex(x => x.id === id);
            if (idx === -1) { sendJSON(res, req, { error: 'Member not found' }, 404); return; }
            data.members.splice(idx, 1);
            await saveTeam(data);
            sendJSON(res, req, { success: true });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Approvals: Badge count ────────────────────────────────────────────
    if (pathname === '/api/approvals/badge' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            if (!isAdminOrManager(session)) { sendJSON(res, req, { error: 'Admin or Manager access required' }, 403); return; }
            const [leavesData, reimData, apprData] = await Promise.all([loadLeaves(), loadReimbursements(), loadApprovals()]);
            const pendingLeaves = leavesData.requests.filter(r => r.status === 'pending').length;
            const pendingReim   = reimData.claims.filter(c => c.status === 'pending').length;
            const pendingApprList = apprData.approvals.filter(a => a.status === 'pending');
            const pendingAppr    = pendingApprList.length;
            const byType = {};
            pendingApprList.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
            sendJSON(res, req, {
                total: pendingLeaves + pendingReim + pendingAppr,
                leaves: pendingLeaves,
                reimbursements: pendingReim,
                approvals: pendingAppr,
                approvals_by_type: { employee: byType.employee || 0, task: byType.task || 0, project: byType.project || 0 }
            });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Approvals: List ───────────────────────────────────────────────────
    if (pathname === '/api/approvals' && req.method === 'GET') {
        try {
            const session = requireAuth(req);
            if (!isAdminOrManager(session)) { sendJSON(res, req, { error: 'Admin or Manager access required' }, 403); return; }
            const data = await loadApprovals();
            let list = data.approvals.slice().reverse();
            if (query.type)   list = list.filter(a => a.type   === query.type);
            if (query.status) list = list.filter(a => a.status === query.status);
            sendJSON(res, req, { approvals: list });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── Approvals: Review ─────────────────────────────────────────────────
    if (pathname.match(/^\/api\/approvals\/\d+$/) && req.method === 'PATCH') {
        try {
            const session = requireAuth(req);
            if (!isAdminOrManager(session)) { sendJSON(res, req, { error: 'Admin or Manager access required' }, 403); return; }
            const id   = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            if (!['approved', 'rejected'].includes(body.status)) { sendJSON(res, req, { error: 'status must be approved or rejected' }, 400); return; }
            if (body.status === 'rejected' && !isStr(body.comment, 1000)) { sendJSON(res, req, { error: 'Comment is required when rejecting' }, 400); return; }

            const data = await loadApprovals();
            const appr = data.approvals.find(a => a.id === id);
            if (!appr) { sendJSON(res, req, { error: 'Approval not found' }, 404); return; }
            if (appr.status !== 'pending') { sendJSON(res, req, { error: 'Only pending approvals can be reviewed' }, 400); return; }

            appr.status           = body.status;
            appr.comment          = isStr(body.comment, 1000) ? body.comment.trim() : '';
            appr.reviewed_by_id   = session.userId;
            appr.reviewed_by_name = session.name;
            appr.reviewed_at      = new Date().toISOString();

            let extra = {};

            if (appr.type === 'employee' && body.status === 'approved') {
                const usersData = await loadUsers();
                const empData   = await loadEmployees();
                const d = appr.details;
                // Guard against duplicate user creation
                if (!usersData.users.find(u => u.email.toLowerCase() === d.officeEmail.toLowerCase())) {
                    const sysRole = (d.role === 'Admin' || d.role === 'SuperAdmin') ? 'admin' : (d.isReportingManager ? 'manager' : 'employee');
                    const newUser = { id: usersData.nextId++, email: d.officeEmail, name: d.fullName, role: sysRole, password_hash: d.password_hash, salt: d.salt };
                    usersData.users.push(newUser);
                    await saveUsers(usersData);
                    const newEmp = {
                        id: empData.employees.length + 1,
                        userId: d.userId, name: d.fullName,
                        firstName: d.firstName, middleName: d.middleName || '', lastName: d.lastName,
                        gender: d.gender, dob: d.dob, pan: d.pan, aadhaar: d.aadhaar || '',
                        dateOfJoining: d.dateOfJoining, designation: d.designation, role: d.role, salary: d.salary || 0,
                        reportingManager: d.reportingManager || '', isReportingManager: d.isReportingManager === true,
                        email: d.officeEmail, department: d.department || 'Design',
                        address: d.address,
                        nextOfKin: d.nextOfKin,
                        created_at: new Date().toISOString()
                    };
                    empData.employees.push(newEmp);
                    await saveEmployees(empData);
                    extra = { userId: d.userId, officeEmail: d.officeEmail, tempPassword: d.tempPassword };
                }
            } else if (appr.type === 'task') {
                const tasksData = await loadTasks();
                const task = tasksData.tasks.find(t => t.id === appr.ref_id);
                if (task && task.status === 'pending-approval') {
                    task.status = body.status === 'approved' ? 'done' : 'in-progress';
                    task.updated_at = new Date().toISOString();
                    await saveTasks(tasksData);
                }
            } else if (appr.type === 'project') {
                const projData = await loadProjects();
                const proj = projData.projects.find(p => p.id === appr.ref_id);
                if (proj) {
                    if (body.status === 'approved') {
                        if (!proj.phases_done) proj.phases_done = [];
                        if (!proj.phases_done.includes(proj.current_phase)) proj.phases_done.push(proj.current_phase);
                        proj.current_phase = appr.details.requested_phase;
                    }
                    delete proj.pending_phase;
                    proj.updated_at = new Date().toISOString();
                    await saveProjects(projData);
                }
            }

            await saveApprovals(data);
            sendJSON(res, req, { success: true, approval: appr, ...extra });
        } catch (e) { sendJSON(res, req, { error: e.message }, 500); }
        return;
    }

    // ── 404 ────────────────────────────────────────────────────────────────
    sendJSON(res, req, { error: 'API endpoint not found' }, 404);
}

// ── HTTP Server ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const parsed   = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsed.pathname);
    const query    = parsed.query;

    if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
        await handleAPI(req, res, pathname, query);
        return;
    }

    // Serve static files
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    const ext    = path.extname(filePath).toLowerCase();
    const mime   = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            const code = err.code === 'ENOENT' ? 404 : 500;
            log(req, code);
            res.writeHead(code, { 'Content-Type': 'text/html' });
            res.end(code === 404 ? '<h1>404 – Not Found</h1>' : `<h1>Server Error: ${err.code}</h1>`);
        } else {
            log(req, 200);
            res.writeHead(200, { 'Content-Type': mime });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n  DC Studio — running on http://localhost:${PORT}`);
    console.log(`  Press Ctrl+C to stop\n`);
});
