const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { google } = require('googleapis');

const PORT = 8000;
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.send'
];

// File paths
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const MEETINGS_PATH = path.join(__dirname, 'data', 'meetings.json');
const EMPLOYEES_PATH = path.join(__dirname, 'data', 'employees.json');
const TASKS_PATH = path.join(__dirname, 'data', 'tasks.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize data files if they don't exist
if (!fs.existsSync(MEETINGS_PATH)) {
    fs.writeFileSync(MEETINGS_PATH, JSON.stringify({ meetings: [], nextId: 1 }, null, 2));
}

if (!fs.existsSync(EMPLOYEES_PATH)) {
    fs.writeFileSync(EMPLOYEES_PATH, JSON.stringify({
        employees: [
            { id: 1, name: 'Admin User', email: 'ak53429651201@gmail.com', department: 'Management', designation: 'Admin' },
            { id: 2, name: 'Priya Patel', email: 'priya@dcstudio.com', department: 'Development', designation: 'Full Stack Developer' },
            { id: 3, name: 'Amit Kumar', email: 'amit@dcstudio.com', department: 'Design', designation: 'UI/UX Designer' },
            { id: 4, name: 'Sneha Reddy', email: 'sneha@dcstudio.com', department: 'Marketing', designation: 'Marketing Manager' },
            { id: 5, name: 'Vikram Singh', email: 'vikram@dcstudio.com', department: 'Development', designation: 'Backend Developer' }
        ]
    }, null, 2));
}

if (!fs.existsSync(TASKS_PATH)) {
    fs.writeFileSync(TASKS_PATH, JSON.stringify({
        tasks: [
            { id: 1, title: 'Design homepage mockup', description: 'Create wireframes and high-fidelity mockup for the new homepage layout', priority: 'high', status: 'in-progress', due_date: '2026-02-20', assignee_id: 3, assignee_name: 'Amit Kumar', created_at: '2026-02-10T09:00:00.000Z', updated_at: '2026-02-10T09:00:00.000Z' },
            { id: 2, title: 'Fix login page responsiveness', description: 'Login form breaks on mobile screens below 375px', priority: 'high', status: 'to-do', due_date: '2026-02-15', assignee_id: 2, assignee_name: 'Priya Patel', created_at: '2026-02-10T09:30:00.000Z', updated_at: '2026-02-10T09:30:00.000Z' },
            { id: 3, title: 'Set up project documentation', description: 'Create README and contributing guidelines', priority: 'medium', status: 'done', due_date: '2026-02-12', assignee_id: 5, assignee_name: 'Vikram Singh', created_at: '2026-02-08T10:00:00.000Z', updated_at: '2026-02-11T14:00:00.000Z' },
            { id: 4, title: 'Social media campaign plan', description: 'Draft Q1 marketing campaign for social media channels', priority: 'medium', status: 'to-do', due_date: '2026-02-25', assignee_id: 4, assignee_name: 'Sneha Reddy', created_at: '2026-02-10T11:00:00.000Z', updated_at: '2026-02-10T11:00:00.000Z' },
            { id: 5, title: 'API performance audit', description: 'Profile and optimize slow API endpoints', priority: 'low', status: 'to-do', due_date: null, assignee_id: 5, assignee_name: 'Vikram Singh', created_at: '2026-02-11T08:00:00.000Z', updated_at: '2026-02-11T08:00:00.000Z' }
        ],
        nextId: 6
    }, null, 2));
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Load credentials
function loadCredentials() {
    try {
        const content = fs.readFileSync(CREDENTIALS_PATH);
        return JSON.parse(content);
    } catch (err) {
        console.error('Error loading credentials:', err);
        return null;
    }
}

// Create OAuth2 client
function createOAuth2Client() {
    const credentials = loadCredentials();
    if (!credentials) return null;

    const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed;
    // Use the redirect URI from credentials file
    const redirectUri = redirect_uris ? redirect_uris[0] : 'http://localhost:8000/auth/google/callback';
    return new google.auth.OAuth2(
        client_id,
        client_secret,
        redirectUri
    );
}

// Load saved token
function loadToken() {
    try {
        if (fs.existsSync(TOKEN_PATH)) {
            const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
            return token;
        }
    } catch (err) {
        console.error('Error loading token:', err);
    }
    return null;
}

// Save token
function saveToken(token) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log('Token saved to', TOKEN_PATH);
}

// Get authenticated client
function getAuthenticatedClient() {
    const oAuth2Client = createOAuth2Client();
    if (!oAuth2Client) return null;

    const token = loadToken();
    if (token) {
        oAuth2Client.setCredentials(token);
        return oAuth2Client;
    }
    return null;
}

// Load meetings data
function loadMeetings() {
    try {
        return JSON.parse(fs.readFileSync(MEETINGS_PATH));
    } catch (err) {
        return { meetings: [], nextId: 1 };
    }
}

// Save meetings data
function saveMeetings(data) {
    fs.writeFileSync(MEETINGS_PATH, JSON.stringify(data, null, 2));
}

// Load employees
function loadEmployees() {
    try {
        return JSON.parse(fs.readFileSync(EMPLOYEES_PATH));
    } catch (err) {
        return { employees: [] };
    }
}

// Load tasks data
function loadTasks() {
    try {
        return JSON.parse(fs.readFileSync(TASKS_PATH));
    } catch (err) {
        return { tasks: [], nextId: 1 };
    }
}

// Save tasks data
function saveTasks(data) {
    fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));
}

// Create Google Calendar event with Meet link
async function createCalendarEvent(auth, meetingData) {
    const calendar = google.calendar({ version: 'v3', auth });

    const startDateTime = new Date(`${meetingData.meeting_date}T${meetingData.start_time}:00`);
    const endDateTime = new Date(`${meetingData.meeting_date}T${meetingData.end_time}:00`);

    const event = {
        summary: meetingData.title,
        description: meetingData.description || '',
        start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'Asia/Kolkata',
        },
        end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'Asia/Kolkata',
        },
        attendees: meetingData.participants.map(p => ({ email: p.email })),
        conferenceData: {
            createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 30 },
                { method: 'popup', minutes: 10 }
            ]
        }
    };

    try {
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            conferenceDataVersion: 1,
            sendUpdates: 'all'
        });

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

// Send email via Gmail API
async function sendEmail(auth, to, subject, htmlBody) {
    const gmail = google.gmail({ version: 'v1', auth });

    const message = [
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `To: ${to}`,
        'From: ak53429651201@gmail.com',
        `Subject: ${subject}`,
        '',
        htmlBody
    ].join('\n');

    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    try {
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage }
        });
        return { success: true };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

// Send meeting invite emails
async function sendMeetingInvites(auth, meeting) {
    const subject = `Meeting Invitation: ${meeting.title}`;
    const meetLink = meeting.google_meet_link ? `<p><strong>Join Google Meet:</strong> <a href="${meeting.google_meet_link}">${meeting.google_meet_link}</a></p>` : '';

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #eb7846 0%, #e85d2d 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">DC Studio Meeting Invitation</h1>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
                <h2 style="color: #333;">${meeting.title}</h2>
                <p><strong>Date:</strong> ${new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><strong>Time:</strong> ${meeting.start_time} - ${meeting.end_time}</p>
                <p><strong>Organizer:</strong> ${meeting.organizer_name}</p>
                ${meeting.description ? `<p><strong>Description:</strong> ${meeting.description}</p>` : ''}
                ${meetLink}
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">This invitation was sent from DC Studio Meeting System.</p>
            </div>
        </div>
    `;

    const results = [];
    for (const participant of meeting.participants) {
        if (participant.email && participant.email !== 'ak53429651201@gmail.com') {
            const result = await sendEmail(auth, participant.email, subject, htmlBody);
            results.push({ email: participant.email, ...result });
        }
    }
    return results;
}

// Parse JSON body from request
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Send JSON response
function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

// API Routes handler
async function handleAPI(req, res, pathname, query) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // OAuth: Initialize
    if (pathname === '/api/oauth/init' && req.method === 'GET') {
        const oAuth2Client = createOAuth2Client();
        if (!oAuth2Client) {
            sendJSON(res, { error: 'Failed to load credentials' }, 500);
            return;
        }

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });

        sendJSON(res, { authUrl });
        return;
    }

    // OAuth: Callback (supports both paths)
    if ((pathname === '/api/oauth/callback' || pathname === '/auth/google/callback') && req.method === 'GET') {
        const code = query.code;
        if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Error: No authorization code provided</h1>');
            return;
        }

        const oAuth2Client = createOAuth2Client();
        try {
            const { tokens } = await oAuth2Client.getToken(code);
            saveToken(tokens);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                        .success { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .success i { font-size: 60px; color: #10b981; }
                        h1 { color: #333; }
                        p { color: #666; }
                    </style>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                </head>
                <body>
                    <div class="success">
                        <i class="fas fa-check-circle"></i>
                        <h1>Google Connected Successfully!</h1>
                        <p>You can close this window and return to the application.</p>
                        <script>
                            setTimeout(() => {
                                if (window.opener) {
                                    window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                                    window.close();
                                }
                            }, 2000);
                        </script>
                    </div>
                </body>
                </html>
            `);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h1>Authentication failed: ${error.message}</h1>`);
        }
        return;
    }

    // OAuth: Check status
    if (pathname === '/api/oauth/status' && req.method === 'GET') {
        const auth = getAuthenticatedClient();
        sendJSON(res, { authenticated: !!auth });
        return;
    }

    // OAuth: Logout
    if (pathname === '/api/oauth/logout' && req.method === 'POST') {
        try {
            if (fs.existsSync(TOKEN_PATH)) {
                fs.unlinkSync(TOKEN_PATH);
            }
            sendJSON(res, { success: true });
        } catch (error) {
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Employees: Search
    if (pathname === '/api/employees/search' && req.method === 'GET') {
        const searchQuery = (query.q || '').toLowerCase();
        const { employees } = loadEmployees();

        const filtered = employees.filter(emp =>
            emp.name.toLowerCase().includes(searchQuery) ||
            emp.email.toLowerCase().includes(searchQuery)
        );

        sendJSON(res, { employees: filtered });
        return;
    }

    // Meetings: List
    if (pathname === '/api/meetings' && req.method === 'GET') {
        const { meetings } = loadMeetings();
        const filter = query.filter || 'all';
        const today = new Date().toISOString().split('T')[0];

        let filtered = meetings;
        if (filter === 'upcoming') {
            filtered = meetings.filter(m => m.meeting_date >= today && m.status !== 'cancelled');
        } else if (filter === 'past') {
            filtered = meetings.filter(m => m.meeting_date < today || m.status === 'completed');
        }

        sendJSON(res, { meetings: filtered });
        return;
    }

    // Meetings: Get single
    if (pathname.startsWith('/api/meetings/') && req.method === 'GET') {
        const id = parseInt(pathname.split('/')[3]);
        const { meetings } = loadMeetings();
        const meeting = meetings.find(m => m.id === id);

        if (meeting) {
            sendJSON(res, { meeting });
        } else {
            sendJSON(res, { error: 'Meeting not found' }, 404);
        }
        return;
    }

    // Meetings: Create
    if (pathname === '/api/meetings' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const data = loadMeetings();

            const newMeeting = {
                id: data.nextId++,
                title: body.title,
                description: body.description || '',
                meeting_date: body.meeting_date,
                start_time: body.start_time,
                end_time: body.end_time,
                timezone: 'Asia/Kolkata',
                status: 'scheduled',
                organizer_name: 'DC Studio Admin',
                organizer_email: 'ak53429651201@gmail.com',
                participants: body.participants || [],
                google_meet_link: null,
                google_event_id: null,
                created_at: new Date().toISOString()
            };

            // Create Google Calendar event with Meet if requested
            if (body.createGoogleMeet) {
                const auth = getAuthenticatedClient();
                if (auth) {
                    const calendarResult = await createCalendarEvent(auth, newMeeting);
                    if (calendarResult.success) {
                        newMeeting.google_meet_link = calendarResult.meetLink;
                        newMeeting.google_event_id = calendarResult.eventId;
                    } else {
                        console.error('Failed to create calendar event:', calendarResult.error);
                    }
                } else {
                    sendJSON(res, { error: 'Google not authenticated. Please connect Google first.' }, 401);
                    return;
                }
            }

            // Send email invites if requested
            if (body.sendInvites && newMeeting.participants.length > 0) {
                const auth = getAuthenticatedClient();
                if (auth) {
                    await sendMeetingInvites(auth, newMeeting);
                }
            }

            data.meetings.push(newMeeting);
            saveMeetings(data);

            sendJSON(res, { success: true, meeting: newMeeting });
        } catch (error) {
            console.error('Create meeting error:', error);
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Meetings: Update status
    if (pathname.startsWith('/api/meetings/') && pathname.endsWith('/status') && req.method === 'PUT') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const data = loadMeetings();

            const meeting = data.meetings.find(m => m.id === id);
            if (meeting) {
                meeting.status = body.status;
                meeting.updated_at = new Date().toISOString();
                saveMeetings(data);
                sendJSON(res, { success: true, meeting });
            } else {
                sendJSON(res, { error: 'Meeting not found' }, 404);
            }
        } catch (error) {
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Meetings: Delete
    if (pathname.startsWith('/api/meetings/') && req.method === 'DELETE') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const data = loadMeetings();

            const index = data.meetings.findIndex(m => m.id === id);
            if (index !== -1) {
                data.meetings.splice(index, 1);
                saveMeetings(data);
                sendJSON(res, { success: true });
            } else {
                sendJSON(res, { error: 'Meeting not found' }, 404);
            }
        } catch (error) {
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Employees: List all
    if (pathname === '/api/employees' && req.method === 'GET') {
        const { employees } = loadEmployees();
        sendJSON(res, { employees });
        return;
    }

    // Tasks: List with filters
    if (pathname === '/api/tasks' && req.method === 'GET') {
        const data = loadTasks();
        let tasks = data.tasks;

        if (query.status) {
            tasks = tasks.filter(t => t.status === query.status);
        }
        if (query.priority) {
            tasks = tasks.filter(t => t.priority === query.priority);
        }
        if (query.assignee_id) {
            tasks = tasks.filter(t => t.assignee_id === parseInt(query.assignee_id));
        }
        if (query.search) {
            const s = query.search.toLowerCase();
            tasks = tasks.filter(t => t.title.toLowerCase().includes(s) || (t.description && t.description.toLowerCase().includes(s)));
        }

        const allTasks = data.tasks;
        const counts = {
            total: allTasks.length,
            'to-do': allTasks.filter(t => t.status === 'to-do').length,
            'in-progress': allTasks.filter(t => t.status === 'in-progress').length,
            done: allTasks.filter(t => t.status === 'done').length
        };

        sendJSON(res, { tasks, counts });
        return;
    }

    // Tasks: Create
    if (pathname === '/api/tasks' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const data = loadTasks();

            const newTask = {
                id: data.nextId++,
                title: body.title,
                description: body.description || '',
                priority: body.priority || 'medium',
                status: body.status || 'to-do',
                due_date: body.due_date || null,
                assignee_id: body.assignee_id ? parseInt(body.assignee_id) : null,
                assignee_name: body.assignee_name || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            data.tasks.push(newTask);
            saveTasks(data);
            sendJSON(res, { success: true, task: newTask }, 201);
        } catch (error) {
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Tasks: Quick status change (PATCH must be checked before GET/PUT single)
    if (pathname.match(/^\/api\/tasks\/\d+\/status$/) && req.method === 'PATCH') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const data = loadTasks();
            const task = data.tasks.find(t => t.id === id);

            if (!task) {
                sendJSON(res, { error: 'Task not found' }, 404);
                return;
            }

            task.status = body.status;
            task.updated_at = new Date().toISOString();
            saveTasks(data);
            sendJSON(res, { success: true, task });
        } catch (error) {
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Tasks: Get single
    if (pathname.match(/^\/api\/tasks\/\d+$/) && req.method === 'GET') {
        const id = parseInt(pathname.split('/')[3]);
        const { tasks } = loadTasks();
        const task = tasks.find(t => t.id === id);

        if (task) {
            sendJSON(res, { task });
        } else {
            sendJSON(res, { error: 'Task not found' }, 404);
        }
        return;
    }

    // Tasks: Update
    if (pathname.match(/^\/api\/tasks\/\d+$/) && req.method === 'PUT') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const body = await parseBody(req);
            const data = loadTasks();
            const task = data.tasks.find(t => t.id === id);

            if (!task) {
                sendJSON(res, { error: 'Task not found' }, 404);
                return;
            }

            if (body.title !== undefined) task.title = body.title;
            if (body.description !== undefined) task.description = body.description;
            if (body.priority !== undefined) task.priority = body.priority;
            if (body.status !== undefined) task.status = body.status;
            if (body.due_date !== undefined) task.due_date = body.due_date || null;
            if (body.assignee_id !== undefined) {
                task.assignee_id = body.assignee_id ? parseInt(body.assignee_id) : null;
                task.assignee_name = body.assignee_name || null;
            }
            task.updated_at = new Date().toISOString();

            saveTasks(data);
            sendJSON(res, { success: true, task });
        } catch (error) {
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Tasks: Delete
    if (pathname.match(/^\/api\/tasks\/\d+$/) && req.method === 'DELETE') {
        try {
            const id = parseInt(pathname.split('/')[3]);
            const data = loadTasks();
            const index = data.tasks.findIndex(t => t.id === id);

            if (index === -1) {
                sendJSON(res, { error: 'Task not found' }, 404);
                return;
            }

            data.tasks.splice(index, 1);
            saveTasks(data);
            sendJSON(res, { success: true });
        } catch (error) {
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Calendar: Get Google Calendar events for a month
    if (pathname === '/api/calendar/events' && req.method === 'GET') {
        const month = parseInt(query.month) || (new Date().getMonth() + 1);
        const year = parseInt(query.year) || new Date().getFullYear();

        const auth = getAuthenticatedClient();
        if (!auth) {
            sendJSON(res, { authenticated: false, events: [] });
            return;
        }

        try {
            const calendar = google.calendar({ version: 'v3', auth });
            const timeMin = new Date(year, month - 1, 1).toISOString();
            const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString();

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin,
                timeMax,
                singleEvents: true,
                orderBy: 'startTime'
            });

            const events = (response.data.items || []).map(evt => ({
                id: evt.id,
                title: evt.summary || '(No title)',
                start: evt.start.dateTime || evt.start.date,
                end: evt.end.dateTime || evt.end.date,
                meetLink: evt.hangoutLink || (evt.conferenceData && evt.conferenceData.entryPoints && evt.conferenceData.entryPoints[0] && evt.conferenceData.entryPoints[0].uri) || null,
                location: evt.location || null,
                description: evt.description || '',
                source: 'google'
            }));

            sendJSON(res, { authenticated: true, events });
        } catch (error) {
            console.error('Error fetching Google Calendar events:', error);
            sendJSON(res, { authenticated: true, events: [], error: error.message });
        }
        return;
    }

    // Calendar: Get combined calendar data (Google events + local meetings + tasks)
    if (pathname === '/api/calendar/combined' && req.method === 'GET') {
        const month = parseInt(query.month) || (new Date().getMonth() + 1);
        const year = parseInt(query.year) || new Date().getFullYear();
        const combined = [];
        let authenticated = false;

        // 1) Google Calendar events
        const auth = getAuthenticatedClient();
        if (auth) {
            authenticated = true;
            try {
                const calendar = google.calendar({ version: 'v3', auth });
                const timeMin = new Date(year, month - 1, 1).toISOString();
                const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString();

                const response = await calendar.events.list({
                    calendarId: 'primary',
                    timeMin,
                    timeMax,
                    singleEvents: true,
                    orderBy: 'startTime'
                });

                (response.data.items || []).forEach(evt => {
                    const start = evt.start.dateTime || evt.start.date;
                    const end = evt.end.dateTime || evt.end.date;
                    combined.push({
                        id: 'g-' + evt.id,
                        title: evt.summary || '(No title)',
                        type: 'google',
                        date: start.substring(0, 10),
                        startTime: start.length > 10 ? start.substring(11, 16) : null,
                        endTime: end.length > 10 ? end.substring(11, 16) : null,
                        meetLink: evt.hangoutLink || (evt.conferenceData && evt.conferenceData.entryPoints && evt.conferenceData.entryPoints[0] && evt.conferenceData.entryPoints[0].uri) || null,
                        description: evt.description || '',
                        source: 'google'
                    });
                });
            } catch (error) {
                console.error('Error fetching Google Calendar events for combined:', error);
            }
        }

        // 2) Local meetings
        const { meetings } = loadMeetings();
        meetings.forEach(m => {
            if (m.meeting_date) {
                const mParts = m.meeting_date.split('-');
                const mYear = parseInt(mParts[0], 10);
                const mMonth = parseInt(mParts[1], 10);
                if (mYear === year && mMonth === month) {
                    combined.push({
                        id: 'm-' + m.id,
                        title: m.title,
                        type: 'meeting',
                        date: m.meeting_date,
                        startTime: m.start_time || null,
                        endTime: m.end_time || null,
                        meetLink: m.google_meet_link || null,
                        description: m.description || '',
                        status: m.status,
                        source: 'local'
                    });
                }
            }
        });

        // 3) Tasks with due dates
        const { tasks } = loadTasks();
        tasks.forEach(t => {
            if (t.due_date) {
                // Parse YYYY-MM-DD directly to avoid timezone issues
                const parts = t.due_date.split('-');
                const tYear = parseInt(parts[0], 10);
                const tMonth = parseInt(parts[1], 10);
                if (tYear === year && tMonth === month) {
                    combined.push({
                        id: 't-' + t.id,
                        title: t.title,
                        type: 'task',
                        date: t.due_date,
                        priority: t.priority,
                        status: t.status,
                        assignee: t.assignee_name,
                        description: t.description || '',
                        source: 'local'
                    });
                }
            }
        });

        sendJSON(res, { events: combined, authenticated });
        return;
    }

    // Calendar: Quick-add event to Google Calendar
    if (pathname === '/api/calendar/events' && req.method === 'POST') {
        const auth = getAuthenticatedClient();
        if (!auth) {
            sendJSON(res, { error: 'Google not authenticated' }, 401);
            return;
        }

        try {
            const body = await parseBody(req);
            const result = await createCalendarEvent(auth, {
                title: body.title,
                meeting_date: body.date,
                start_time: body.start_time,
                end_time: body.end_time,
                description: body.description || '',
                participants: []
            });

            if (result.success) {
                sendJSON(res, { success: true, eventId: result.eventId, meetLink: result.meetLink, htmlLink: result.htmlLink });
            } else {
                sendJSON(res, { error: result.error }, 500);
            }
        } catch (error) {
            console.error('Calendar quick-add error:', error);
            sendJSON(res, { error: error.message }, 500);
        }
        return;
    }

    // Not found
    sendJSON(res, { error: 'API endpoint not found' }, 404);
}

// Create server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsedUrl.pathname);
    const query = parsedUrl.query;

    // Handle API requests (including /auth/ for OAuth callback)
    if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
        await handleAPI(req, res, pathname, query);
        return;
    }

    // Serve static files
    let filePath = '.' + pathname;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`   DC Studio Server running on port ${PORT}`);
    console.log(`========================================`);
    console.log(`\n  Local:   http://localhost:${PORT}/`);
    console.log(`\n  API Endpoints:`);
    console.log(`    GET  /api/oauth/init     - Start Google OAuth`);
    console.log(`    GET  /api/oauth/callback - OAuth callback`);
    console.log(`    GET  /api/oauth/status   - Check auth status`);
    console.log(`    POST /api/oauth/logout   - Disconnect Google`);
    console.log(`    GET  /api/employees/search?q=name`);
    console.log(`    GET  /api/meetings?filter=upcoming|past`);
    console.log(`    POST /api/meetings       - Create meeting`);
    console.log(`\n  Press Ctrl+C to stop the server\n`);
});
