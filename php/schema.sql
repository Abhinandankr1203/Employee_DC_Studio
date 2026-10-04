-- DC Studio – Complete MySQL Schema + Seed Data
-- Run this once: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS dcstudio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dcstudio;

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    email                VARCHAR(255) UNIQUE NOT NULL,
    name                 VARCHAR(200) NOT NULL,
    role                 ENUM('admin','manager','employee') DEFAULT 'employee',
    is_reporting_manager TINYINT(1) DEFAULT 0,
    reporting_manager_id INT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    salt                 VARCHAR(255) NOT NULL,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL,
    name                    VARCHAR(200) NOT NULL,
    email                   VARCHAR(255) NOT NULL,
    department              VARCHAR(100),
    designation             VARCHAR(150),
    salary                  DECIMAL(12,2) DEFAULT 0,
    joining_date            DATE,
    mobile                  VARCHAR(20),
    city                    VARCHAR(100),
    state_name              VARCHAR(100),
    office                  VARCHAR(100),
    is_reporting_manager    TINYINT(1) DEFAULT 0,
    reporting_manager_id    INT NULL,
    reporting_manager_name  VARCHAR(200),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(300) NOT NULL,
    client          VARCHAR(200),
    client_email    VARCHAR(255),
    client_phone    VARCHAR(50),
    location        VARCHAR(300),
    area_sqft       INT,
    description     TEXT,
    current_phase   VARCHAR(100),
    phases_done     JSON,
    start_date      DATE,
    end_date        DATE,
    status          ENUM('active','on-hold','completed') DEFAULT 'active',
    project_type    VARCHAR(100),
    po_number       VARCHAR(100),
    po_date         DATE,
    billing_address TEXT,
    ship_to_gstin   VARCHAR(100),
    site_name       VARCHAR(200),
    site_address    TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_team_members (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    project_id  INT NOT NULL,
    employee_id INT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(project_id, employee_id)
);

CREATE TABLE IF NOT EXISTS tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    priority    ENUM('low','medium','high') DEFAULT 'medium',
    status      ENUM('to-do','in-progress','done','pending-approval') DEFAULT 'to-do',
    due_date    DATE NULL,
    project_code VARCHAR(50) NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_assignees (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    task_id       INT NOT NULL,
    employee_id   INT NOT NULL,
    employee_name VARCHAR(200),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, employee_id)
);

CREATE TABLE IF NOT EXISTS meetings (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    meeting_date    DATE,
    start_time      VARCHAR(10),
    end_time        VARCHAR(10),
    timezone        VARCHAR(100) DEFAULT 'Asia/Kolkata',
    status          ENUM('scheduled','completed','cancelled') DEFAULT 'scheduled',
    organizer_name  VARCHAR(200),
    organizer_email VARCHAR(255),
    google_meet_link VARCHAR(500),
    google_event_id VARCHAR(255),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meeting_participants (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id  INT NOT NULL,
    employee_id INT NULL,
    name        VARCHAR(200) NOT NULL,
    email       VARCHAR(255),
    type        ENUM('internal','external','client') DEFAULT 'internal',
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_allocations (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    year      INT NOT NULL,
    type      VARCHAR(10) NOT NULL,
    label     VARCHAR(100),
    allocated INT DEFAULT 0,
    period    ENUM('year','month') DEFAULT 'year',
    UNIQUE(year, type)
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT NOT NULL,
    type             VARCHAR(10) NOT NULL,
    from_date        DATE,
    to_date          DATE,
    from_time        VARCHAR(10) NULL,
    to_time          VARCHAR(10) NULL,
    duration         DECIMAL(4,2) NULL,
    next_joining_date DATE,
    no_days          DECIMAL(5,2) DEFAULT 1,
    reason           TEXT,
    status           ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
    approver_comments TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    actioned_at      DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payslips (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    employee_id       INT NOT NULL,
    month             VARCHAR(7) NOT NULL,
    month_label       VARCHAR(30),
    basic             DECIMAL(12,2) DEFAULT 0,
    hra               DECIMAL(12,2) DEFAULT 0,
    travel            DECIMAL(12,2) DEFAULT 0,
    incentive         DECIMAL(12,2) DEFAULT 0,
    reimbursement     DECIMAL(12,2) DEFAULT 0,
    pf                DECIMAL(12,2) DEFAULT 0,
    tds               DECIMAL(12,2) DEFAULT 0,
    professional_tax  DECIMAL(12,2) DEFAULT 0,
    other_deductions  DECIMAL(12,2) DEFAULT 0,
    net_pay           DECIMAL(12,2) DEFAULT 0,
    paid_on           DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(employee_id, month)
);

CREATE TABLE IF NOT EXISTS reimbursements (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    employee_id  INT NOT NULL,
    project      VARCHAR(200),
    description  VARCHAR(500),
    amount       DECIMAL(10,2) NOT NULL,
    bill_date    DATE,
    category     VARCHAR(100),
    filename     VARCHAR(500),
    status       ENUM('pending','approved','rejected') DEFAULT 'pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS approvals (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    type               ENUM('leave','reimbursement','task','employee','project') NOT NULL,
    ref_id             INT,
    title              VARCHAR(300),
    details            JSON,
    submitted_by_id    INT,
    submitted_by_name  VARCHAR(200),
    submitted_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    month_key          VARCHAR(7),
    status             ENUM('pending','approved','rejected') DEFAULT 'pending',
    reviewed_by_id     INT NULL,
    reviewed_by_name   VARCHAR(200) NULL,
    reviewed_at        DATETIME NULL,
    comment            TEXT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    user_id  INT NOT NULL,
    date     DATE NOT NULL,
    check_in VARCHAR(10),
    late     TINYINT(1) DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS sessions (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    token      VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────

INSERT INTO users (id, email, name, role, is_reporting_manager, reporting_manager_id, password_hash, salt) VALUES
(1, 'admin@dcstudio.com',  'Admin User',    'admin',    0, NULL, 'd873295f26ecf1cfac7bde48a608c69171e6465d08a48554ae583c6834e9482a', '402d13646d76b9fd552106263e4a5a73'),
(2, 'rahul@dcstudio.com',  'Rahul Sharma',  'manager',  1, NULL, '8dee38a7d10797391d28990950479b68255466add65834729e95fcb3139313cc', '9c7007069c00b77212703a186d478f36'),
(3, 'priya@dcstudio.com',  'Priya Patel',   'employee', 0, 2,    '0123d5d07c06720f3fd833753ff15857995454b693c1f8513ff3d4f49ef4908f', '21acec99c7846df7dfd2472f0298504f'),
(4, 'amit@dcstudio.com',   'Amit Kumar',    'employee', 0, 2,    'e9836205d0bad437ba88335bd7ee1c844744262455aad2929d95cd27a7484eff', 'd96bf702b3158da57fba0438c3c33376'),
(5, 'sneha@dcstudio.com',  'Sneha Reddy',   'employee', 0, 2,    '8a265e1dd4b26822e9efd59767997dd3eae96ab04210ac47f93361a88ecddae5', '4d10d81d3f0300762b0cd8ba9aa44059'),
(6, 'vikram@dcstudio.com', 'Vikram Singh',  'employee', 0, 2,    'e535b2f1da0241d5bb80665aea81f0d7a86e3f7ab3cd2bda2880e2224d04bc04', 'a6f34c55b2a1bb153ab4b43908895428'),
(7, 'meera@dcstudio.com',  'Meera Joshi',   'employee', 0, 2,    '9063a71b22efca95a6606779dd9bfd0dc5379cd3c19b85d12b59c90608652598', 'c8044bbcefcbaf2fbb618e7db1050a11'),
(8, 'suresh@dcstudio.com', 'Suresh Nair',   'employee', 0, 2,    'd3744d2e0546b5133e2cf44e82b5d9d05837582797af6157d6bb2ab9273b1a6b', '83363191ffa34e0e5ec79234285b9bbd');

INSERT INTO employees (id, user_id, name, email, department, designation, salary, joining_date, mobile, city, state_name, is_reporting_manager, reporting_manager_id, reporting_manager_name) VALUES
(1, 1, 'Admin User',   'admin@dcstudio.com',  'Management',          'Managing Director',       150000, '2018-01-01', '9876543210', 'New Delhi',  'Delhi',         0, NULL, NULL),
(2, 2, 'Rahul Sharma', 'rahul@dcstudio.com',  'Design',              'Principal Architect',     120000, '2019-03-01', '9876543211', 'Mumbai',     'Maharashtra',   1, NULL, NULL),
(3, 3, 'Priya Patel',  'priya@dcstudio.com',  'Design',              'Senior Architect',         75000, '2020-07-15', '9876543212', 'Pune',       'Maharashtra',   0, 2,    'Rahul Sharma'),
(4, 4, 'Amit Kumar',   'amit@dcstudio.com',   'Design',              'UI/UX Designer',           65000, '2021-01-10', '9876543213', 'Bengaluru',  'Karnataka',     0, 2,    'Rahul Sharma'),
(5, 5, 'Sneha Reddy',  'sneha@dcstudio.com',  'Interior Design',     'Interior Designer',        60000, '2021-06-01', '9876543214', 'Hyderabad',  'Telangana',     0, 2,    'Rahul Sharma'),
(6, 6, 'Vikram Singh', 'vikram@dcstudio.com', 'Structural Engineering','Structural Engineer',   70000, '2020-02-20', '9876543215', 'Jaipur',     'Rajasthan',     0, 2,    'Rahul Sharma'),
(7, 7, 'Meera Joshi',  'meera@dcstudio.com',  'Interior Design',     'Senior Interior Designer', 68000, '2021-09-01', '9876543216', 'Ahmedabad',  'Gujarat',       0, 2,    'Rahul Sharma'),
(8, 8, 'Suresh Nair',  'suresh@dcstudio.com', 'Project Management',  'Project Manager',          90000, '2019-11-15', '9876543217', 'Chennai',    'Tamil Nadu',    0, 2,    'Rahul Sharma');

INSERT INTO projects (id, code, name, client, client_email, client_phone, location, area_sqft, description, current_phase, phases_done, start_date, end_date, status, created_at) VALUES
(1, 'DC-001', 'Riverside Villa',            'Mr. Arjun Mehta',      'arjun.mehta@email.com',  '+91 98765 43210', 'Koregaon Park, Pune',    4500,  'Luxury 4BHK villa with modern architecture and eco-friendly design.', 'construction', '["concept","design","approval"]',      '2025-09-01', '2026-06-30', 'active', NOW()),
(2, 'DC-002', 'Greenfield Corporate Office','Greenfield Pvt. Ltd.', 'info@greenfield.co.in',  '+91 98123 45678', 'Baner, Pune',           12000,  '5-storey commercial office building with open-plan workspaces.',       'design',        '["concept"]',                         '2026-01-15', '2027-03-31', 'active', NOW()),
(3, 'DC-003', 'Lakeside Boutique Hotel',    'Ms. Priya Singhania',  'priya.s@lakeside.com',   '+91 99887 76655', 'Lavasa, Maharashtra',   28000,  '30-room boutique hotel with lakeside views.',                         'approval',      '["concept","design"]',                '2025-11-01', '2027-06-30', 'active', NOW()),
(4, 'DC-004', 'Heritage Restoration – Fort','Archaeological Trust', 'trust@heritage.gov.in',  '+91 11 2345 6789','Old Delhi',               8200,  'Restoration and adaptive reuse of a 19th-century colonial fort.',     'concept',       '[]',                                  '2026-02-01', '2027-12-31', 'active', NOW()),
(5, 'DC-005', 'Skyline Residential Tower',  'Skyline Developers',   'dev@skyline.co.in',      '+91 90000 12345', 'Bandra, Mumbai',        65000,  '35-storey residential tower with sky gardens and clubhouse.',         'concept',       '[]',                                  '2026-03-01', '2029-03-31', 'active', NOW());

INSERT INTO project_team_members (project_id, employee_id) VALUES
(1,2),(1,3),(1,4),(1,7),(1,8),
(2,2),(2,3),(2,4),(2,6),(2,8),
(3,2),(3,5),(3,7),(3,8),
(4,2),(4,3),(4,6),
(5,2),(5,6),(5,8);

INSERT INTO tasks (id, title, description, priority, status, due_date, project_code, created_at) VALUES
(1,  'Concept design review – Riverside Villa',        'Review and finalise concept drawings with the client.',           'high',   'done',        '2026-01-20', 'DC-001', NOW()),
(2,  '3D render – Riverside Villa living room',        'Produce high-quality 3D render for the client presentation.',     'high',   'done',        '2026-04-15', 'DC-001', NOW()),
(3,  'Structural calculations – Greenfield Office',    'Complete RCC structural calculations and submit for review.',     'high',   'in-progress', '2026-04-20', 'DC-002', NOW()),
(4,  'Interior moodboard – Lakeside Boutique Hotel',   'Create material and colour moodboard for hotel interiors.',      'medium', 'in-progress', '2026-04-18', 'DC-003', NOW()),
(5,  'Material finalization – Greenfield Office',      'Confirm flooring, wall cladding and ceiling materials.',         'medium', 'to-do',       '2026-04-22', 'DC-002', NOW()),
(6,  'Foundation design – Skyline Residential Tower',  'Prepare pile foundation design.',                                'high',   'to-do',       '2026-04-30', 'DC-005', NOW()),
(7,  'Client onboarding – Skyline Tower',              'Schedule kickoff meeting. Share project charter and timeline.',  'medium', 'to-do',       '2026-04-10', 'DC-005', NOW()),
(8,  'Site visit report – Riverside Villa',            'Document construction progress and flag deviations.',            'medium', 'done',        '2026-03-28', 'DC-001', NOW()),
(9,  'Furniture layout plan – Lakeside Hotel suites',  'Prepare scaled furniture layout plans for all 20 suite types.',  'medium', 'to-do',       '2026-04-25', 'DC-003', NOW()),
(10, 'Monthly project status review – April',          'Compile status updates from all active projects.',               'high',   'to-do',       '2026-04-30', NULL,     NOW()),
(11, 'Working drawings – Greenfield Office floors 1–3','Prepare detailed working drawings for ground to third floor.',  'high',   'in-progress', '2026-04-28', 'DC-002', NOW()),
(12, 'Lighting design concept – Riverside Villa',      'Design indoor and landscape lighting scheme.',                  'low',    'to-do',       '2026-05-05', 'DC-001', NOW());

INSERT INTO task_assignees (task_id, employee_id, employee_name) VALUES
(1,3,'Priya Patel'),(2,4,'Amit Kumar'),(3,6,'Vikram Singh'),(4,5,'Sneha Reddy'),
(5,4,'Amit Kumar'),(6,6,'Vikram Singh'),(7,8,'Suresh Nair'),(8,8,'Suresh Nair'),
(9,7,'Meera Joshi'),(10,2,'Rahul Sharma'),(11,3,'Priya Patel'),(12,7,'Meera Joshi');

INSERT INTO meetings (id, title, description, meeting_date, start_time, end_time, status, organizer_name, organizer_email, created_at) VALUES
(1, 'Riverside Villa – Design Review',          'Monthly design review with client. Present updated floor plans.',           '2026-04-08', '10:00', '11:30', 'scheduled', 'Rahul Sharma', 'rahul@dcstudio.com', NOW()),
(2, 'Greenfield Office – Structural Coordination','Internal coordination between architects and structural team.',          '2026-04-10', '11:00', '12:00', 'scheduled', 'Rahul Sharma', 'rahul@dcstudio.com', NOW()),
(3, 'Lakeside Hotel – Interior Concept Presentation','Present interior concepts and moodboards to the client.',             '2026-04-12', '15:00', '16:30', 'scheduled', 'Rahul Sharma', 'rahul@dcstudio.com', NOW());

INSERT INTO meeting_participants (meeting_id, employee_id, name, email, type) VALUES
(1,2,'Rahul Sharma','rahul@dcstudio.com','internal'),
(1,3,'Priya Patel','priya@dcstudio.com','internal'),
(1,4,'Amit Kumar','amit@dcstudio.com','internal'),
(1,NULL,'Arjun Mehta','arjun.mehta@email.com','external'),
(2,2,'Rahul Sharma','rahul@dcstudio.com','internal'),
(2,3,'Priya Patel','priya@dcstudio.com','internal'),
(2,6,'Vikram Singh','vikram@dcstudio.com','internal'),
(3,2,'Rahul Sharma','rahul@dcstudio.com','internal'),
(3,5,'Sneha Reddy','sneha@dcstudio.com','internal'),
(3,7,'Meera Joshi','meera@dcstudio.com','internal'),
(3,NULL,'Priya Singhania','priya.s@lakeside.com','client');

INSERT INTO leave_allocations (year, type, label, allocated, period) VALUES
(2026, 'CL',  'Casual Leave',   12, 'year'),
(2026, 'PL',  'Privilege Leave',15, 'year'),
(2026, 'SL',  'Sick Leave',      7, 'year'),
(2026, 'SHR', 'Short Leave',     2, 'month');

INSERT INTO leave_requests (id, user_id, type, from_date, to_date, next_joining_date, no_days, reason, status, approver_comments, created_at) VALUES
(1, 3, 'CL', '2026-01-15', '2026-01-15', '2026-01-16', 1, 'Personal errand',        'approved', 'Approved.',             NOW()),
(2, 3, 'SL', '2026-02-03', '2026-02-04', '2026-02-05', 2, 'Fever and rest',         'approved', 'Get well soon.',        NOW()),
(3, 4, 'PL', '2026-03-10', '2026-03-14', '2026-03-17', 5, 'Family vacation',        'approved', 'Enjoy your vacation.',  NOW()),
(4, 5, 'CL', '2026-04-01', '2026-04-01', '2026-04-02', 1, 'Doctor appointment',     'pending',  NULL,                    NOW()),
(5, 6, 'PL', '2026-04-15', '2026-04-18', '2026-04-21', 4, 'Travel plans',           'pending',  NULL,                    NOW());

INSERT INTO payslips (id, employee_id, month, month_label, basic, hra, travel, incentive, reimbursement, pf, tds, professional_tax, net_pay, paid_on) VALUES
(1, 3, '2026-01', 'January 2026', 45000,13500,2000,0,0,5400,2500,200,52400,'2026-02-01'),
(2, 3, '2026-02', 'February 2026',45000,13500,2000,0,0,5400,2500,200,52400,'2026-03-01'),
(3, 3, '2026-03', 'March 2026',   45000,13500,2000,5000,0,5400,2500,200,57400,'2026-04-01');

INSERT INTO attendance (id, user_id, date, check_in, late) VALUES
(1,3,'2026-04-01','09:12',0),(2,3,'2026-04-02','09:47',1),(3,3,'2026-04-03','09:05',0),
(4,3,'2026-04-07','10:15',1),(5,3,'2026-04-08','08:58',0),(6,3,'2026-04-09','09:02',0),
(7,3,'2026-04-10','09:08',0),(8,3,'2026-04-11','09:55',1);
