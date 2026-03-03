-- =============================================================
-- DC STUDIO — MySQL Database Schema
-- Generated from frontend data analysis
-- =============================================================

CREATE DATABASE IF NOT EXISTS dc_studio
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE dc_studio;

-- ──────────────────────────────────────────────────────────────
-- 1. USERS  (authentication only)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE users (
    id            INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(255)     NOT NULL UNIQUE,
    password_hash VARCHAR(64)      NOT NULL,
    salt          VARCHAR(32)      NOT NULL,
    role          ENUM('employee','manager','admin') NOT NULL DEFAULT 'employee',
    created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────
-- 2. EMPLOYEES  (staff profiles — 1:1 with users)
--    Merges current employees.json + team.json into one table
-- ──────────────────────────────────────────────────────────────
CREATE TABLE employees (
    id            INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED     NULL UNIQUE,        -- NULL = no login access
    name          VARCHAR(200)     NOT NULL,
    designation   VARCHAR(200)     NOT NULL,
    department    ENUM(
                    'Design',
                    'Civil & Structural',
                    'Interior',
                    'Project Management',
                    'Administration'
                  ) NOT NULL,
    email         VARCHAR(255)     NOT NULL UNIQUE,
    phone         VARCHAR(30)      NULL,
    joined_date   DATE             NULL,
    created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_emp_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────────
-- 3. EMPLOYEE SKILLS  (skills[] array → normalised rows)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE employee_skills (
    id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED  NOT NULL,
    skill       VARCHAR(100)  NOT NULL,

    CONSTRAINT fk_skill_emp
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_emp_skill (employee_id, skill)
);

-- ──────────────────────────────────────────────────────────────
-- 4. TASKS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE tasks (
    id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200)  NOT NULL,
    description TEXT          NULL,
    priority    ENUM('low','medium','high')              NOT NULL DEFAULT 'medium',
    status      ENUM('to-do','in-progress','done')       NOT NULL DEFAULT 'to-do',
    due_date    DATE          NULL,
    assignee_id INT UNSIGNED  NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_task_assignee
        FOREIGN KEY (assignee_id) REFERENCES employees(id)
        ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────────
-- 5. MEETINGS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE meetings (
    id               INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    title            VARCHAR(200)  NOT NULL,
    description      TEXT          NULL,
    meeting_date     DATE          NOT NULL,
    start_time       TIME          NOT NULL,
    end_time         TIME          NOT NULL,
    timezone         VARCHAR(50)   NOT NULL DEFAULT 'Asia/Kolkata',
    status           ENUM('scheduled','in_progress','completed','cancelled')
                                   NOT NULL DEFAULT 'scheduled',
    organizer_id     INT UNSIGNED  NULL,
    organizer_name   VARCHAR(200)  NOT NULL,
    organizer_email  VARCHAR(255)  NOT NULL,
    google_meet_link VARCHAR(500)  NULL,
    google_event_id  VARCHAR(255)  NULL,
    created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_meeting_organizer
        FOREIGN KEY (organizer_id) REFERENCES employees(id)
        ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────────
-- 6. MEETING PARTICIPANTS  (meetings ↔ employees  M:N)
--    Also stores external (non-employee) participants
-- ──────────────────────────────────────────────────────────────
CREATE TABLE meeting_participants (
    id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    meeting_id  INT UNSIGNED  NOT NULL,
    employee_id INT UNSIGNED  NULL,          -- NULL for external guests
    name        VARCHAR(200)  NOT NULL,
    email       VARCHAR(255)  NOT NULL,
    type        ENUM('internal','external')  NOT NULL DEFAULT 'internal',

    CONSTRAINT fk_mp_meeting
        FOREIGN KEY (meeting_id)  REFERENCES meetings(id)  ON DELETE CASCADE,
    CONSTRAINT fk_mp_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,

    UNIQUE KEY uq_meeting_email (meeting_id, email)
);

-- ──────────────────────────────────────────────────────────────
-- 7. MEETING ANNOTATIONS  (currently in-memory → persisted)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE meeting_annotations (
    id         INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT UNSIGNED  NOT NULL,
    type       ENUM('decision','action_item','note')  NOT NULL,
    text       TEXT          NOT NULL,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_annot_meeting
        FOREIGN KEY (meeting_id) REFERENCES meetings(id)
        ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- 8. PROJECTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE projects (
    id            INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
    code          VARCHAR(20)    NOT NULL UNIQUE,
    name          VARCHAR(200)   NOT NULL,
    client        VARCHAR(200)   NOT NULL,
    client_email  VARCHAR(255)   NULL,
    client_phone  VARCHAR(30)    NULL,
    location      VARCHAR(300)   NULL,
    area_sqft     DECIMAL(10,2)  NULL,
    description   TEXT           NULL,
    current_phase ENUM('concept','design','approval','construction','handover')
                                 NOT NULL DEFAULT 'concept',
    phases_done   JSON           NULL,     -- e.g. ["concept","design"]
    start_date    DATE           NULL,
    end_date      DATE           NULL,
    status        ENUM('active','completed','on-hold','cancelled')
                                 NOT NULL DEFAULT 'active',
    created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────
-- 9. PROJECT MEMBERS  (projects ↔ employees  M:N)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE project_members (
    project_id  INT UNSIGNED  NOT NULL,
    employee_id INT UNSIGNED  NOT NULL,

    PRIMARY KEY (project_id, employee_id),

    CONSTRAINT fk_pm_project
        FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_pm_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- 10. LEAVE ALLOCATIONS  (entitlement per employee per year)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE leave_allocations (
    id          INT UNSIGNED      AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED      NOT NULL,
    year        YEAR              NOT NULL,
    type        ENUM('CL','PL','SL')  NOT NULL,
    label       VARCHAR(50)       NOT NULL,
    allocated   TINYINT UNSIGNED  NOT NULL DEFAULT 0,

    CONSTRAINT fk_la_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_leave_alloc (employee_id, year, type)
);

-- ──────────────────────────────────────────────────────────────
-- 11. LEAVE REQUESTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE leave_requests (
    id                INT UNSIGNED      AUTO_INCREMENT PRIMARY KEY,
    employee_id       INT UNSIGNED      NOT NULL,
    type              ENUM('CL','PL','SL')  NOT NULL,
    from_date         DATE              NOT NULL,
    to_date           DATE              NOT NULL,
    no_days           TINYINT UNSIGNED  NOT NULL,
    next_joining_date DATE              NOT NULL,
    reason            VARCHAR(1000)     NULL,
    status            ENUM('pending','approved','rejected','cancelled')
                                        NOT NULL DEFAULT 'pending',
    approver_id       INT UNSIGNED      NULL,
    approver_comments VARCHAR(500)      NULL,
    created_at        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                 ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_lr_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_lr_approver
        FOREIGN KEY (approver_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────────
-- 12. PAYSLIPS  (generated salaries — auto-computed columns)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE payslips (
    id               INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    employee_id      INT UNSIGNED    NOT NULL,
    period           VARCHAR(30)     NOT NULL,      -- "December 2025"
    period_date      DATE            NOT NULL,      -- 2025-12-01

    -- Earnings
    basic            DECIMAL(10,2)   NOT NULL DEFAULT 0,
    hra              DECIMAL(10,2)   NOT NULL DEFAULT 0,
    travel_allowance DECIMAL(10,2)   NOT NULL DEFAULT 0,
    other_allowance  DECIMAL(10,2)   NOT NULL DEFAULT 0,
    gross_salary     DECIMAL(10,2)
                     GENERATED ALWAYS AS
                     (basic + hra + travel_allowance + other_allowance) STORED,

    -- Deductions
    pf               DECIMAL(10,2)   NOT NULL DEFAULT 0,
    tds              DECIMAL(10,2)   NOT NULL DEFAULT 0,
    professional_tax DECIMAL(10,2)   NOT NULL DEFAULT 0,
    total_deductions DECIMAL(10,2)
                     GENERATED ALWAYS AS
                     (pf + tds + professional_tax) STORED,

    -- Net
    net_pay          DECIMAL(10,2)
                     GENERATED ALWAYS AS
                     (basic + hra + travel_allowance + other_allowance
                      - pf - tds - professional_tax) STORED,

    status           ENUM('pending','paid','hold')  NOT NULL DEFAULT 'pending',
    paid_on          DATE            NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pay_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_payslip (employee_id, period_date)
);

-- ──────────────────────────────────────────────────────────────
-- 13. REIMBURSEMENTS  (expense / bill claims)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE reimbursements (
    id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    employee_id       INT UNSIGNED    NOT NULL,
    expense_date      DATE            NOT NULL,
    amount            DECIMAL(10,2)   NOT NULL CHECK (amount > 0),
    project_id        INT UNSIGNED    NULL,         -- optional link to project
    description       VARCHAR(1000)   NOT NULL,
    file_name         VARCHAR(255)    NULL,
    status            ENUM('pending','approved','rejected','cancelled')
                                      NOT NULL DEFAULT 'pending',
    approver_id       INT UNSIGNED    NULL,
    approver_comments VARCHAR(500)    NULL,
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                               ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_reimb_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_reimb_project
        FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE SET NULL,
    CONSTRAINT fk_reimb_approver
        FOREIGN KEY (approver_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────────
-- 14. SESSIONS  (replaces the in-memory Map in server.js)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE sessions (
    token      VARCHAR(64)   NOT NULL PRIMARY KEY,
    user_id    INT UNSIGNED  NOT NULL,
    expires_at DATETIME      NOT NULL,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sess_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_sess_expires (expires_at)
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES  (optimise frequent query patterns from the frontend)
-- ──────────────────────────────────────────────────────────────
CREATE INDEX idx_tasks_status       ON tasks(status);
CREATE INDEX idx_tasks_assignee     ON tasks(assignee_id);
CREATE INDEX idx_tasks_due          ON tasks(due_date);

CREATE INDEX idx_meetings_date      ON meetings(meeting_date);
CREATE INDEX idx_meetings_status    ON meetings(status);

CREATE INDEX idx_projects_status    ON projects(status);
CREATE INDEX idx_projects_phase     ON projects(current_phase);
CREATE INDEX idx_projects_end       ON projects(end_date);

CREATE INDEX idx_lr_employee        ON leave_requests(employee_id);
CREATE INDEX idx_lr_status          ON leave_requests(status);
CREATE INDEX idx_lr_dates           ON leave_requests(from_date, to_date);

CREATE INDEX idx_reimb_employee     ON reimbursements(employee_id);
CREATE INDEX idx_reimb_status       ON reimbursements(status);

CREATE INDEX idx_payslips_employee  ON payslips(employee_id);
CREATE INDEX idx_payslips_period    ON payslips(period_date);

CREATE INDEX idx_emp_dept           ON employees(department);
CREATE INDEX idx_emp_search         ON employees(name, email, department);
