<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DC Studio - Employee Portal</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="css/meeting-alignment.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <!-- Login Page -->
    <div id="loginPage" class="page active">
        <div class="login-container">
            <div class="logo-section">
                <img src="new end.jpg" alt="DC Studio Logo" class="main-logo">
            </div>
            <div class="form-section">
                <div class="login-card">
                    <div class="login-icon">
                        <i class="fas fa-sign-in-alt"></i>
                    </div>
                    <h2>Sign in with email</h2>
                    <p class="subtitle">Sign in with your corporate Email Id provided by your Firm.</p>
                    <form id="loginForm">
                        <div class="input-group">
                            <i class="fas fa-envelope"></i>
                            <input type="email" id="email" name="email" placeholder="Email" required>
                        </div>
                        <div class="input-group">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="password" name="password" placeholder="Password" required>
                        </div>
                        <button type="submit" class="login-btn">Login</button>
                        <a href="#" class="forgot-password">Forgot Password?</a>
                    </form>
                    <p id="errorMsg" class="error-message"></p>
                </div>
            </div>
        </div>
    </div>

    <!-- Greeting Page (Transition) -->
    <div id="greetingPage" class="page">
        <div class="greeting-container">
            <div class="greeting-left">
                <div class="greeting-text">
                    <h1>Greetings,</h1>
                    <h2 class="employee-name" id="employeeName">Employee Name</h2>
                    <div class="greeting-line"></div>
                </div>
                <div class="employee-illustration">
                    <svg viewBox="0 0 300 400" class="person-svg">
                        <!-- Man with glasses illustration -->
                        <defs>
                            <clipPath id="circleClip">
                                <circle cx="150" cy="80" r="45"/>
                            </clipPath>
                        </defs>
                        <!-- Hair -->
                        <path d="M105 60 Q150 20 195 60 Q200 45 180 35 Q150 25 120 35 Q100 45 105 60" fill="#1a1a1a"/>
                        <!-- Face -->
                        <ellipse cx="150" cy="85" rx="40" ry="45" fill="#e8d4c4"/>
                        <!-- Hair top spiky -->
                        <path d="M115 55 Q120 35 135 40 Q140 30 155 35 Q165 25 175 35 Q185 30 190 45 Q195 40 195 55" fill="#1a1a1a"/>
                        <!-- Beard -->
                        <path d="M115 95 Q115 140 150 150 Q185 140 185 95 Q185 115 150 125 Q115 115 115 95" fill="#1a1a1a"/>
                        <!-- Glasses -->
                        <rect x="112" y="70" width="30" height="22" rx="3" fill="none" stroke="#333" stroke-width="2"/>
                        <rect x="158" y="70" width="30" height="22" rx="3" fill="none" stroke="#333" stroke-width="2"/>
                        <line x1="142" y1="80" x2="158" y2="80" stroke="#333" stroke-width="2"/>
                        <!-- Eyes behind glasses -->
                        <circle cx="127" cy="81" r="4" fill="#333"/>
                        <circle cx="173" cy="81" r="4" fill="#333"/>
                        <circle cx="128" cy="80" r="1.5" fill="#fff"/>
                        <circle cx="174" cy="80" r="1.5" fill="#fff"/>
                        <!-- Eyebrows -->
                        <path d="M115 65 Q127 60 140 65" fill="none" stroke="#1a1a1a" stroke-width="2"/>
                        <path d="M160 65 Q173 60 185 65" fill="none" stroke="#1a1a1a" stroke-width="2"/>
                        <!-- Mouth (smiling in beard) -->
                        <path d="M140 110 Q150 118 160 110" fill="none" stroke="#fff" stroke-width="2"/>
                        <!-- Neck -->
                        <rect x="140" y="145" width="20" height="25" fill="#e8d4c4"/>
                        <!-- Suit -->
                        <path d="M80 280 L80 170 Q80 160 100 160 L120 160 L150 200 L180 160 L200 160 Q220 160 220 170 L220 280" fill="#6b6b6b"/>
                        <!-- Shirt collar -->
                        <path d="M130 160 L150 200 L170 160" fill="#fff"/>
                        <!-- Tie -->
                        <path d="M145 175 L150 200 L155 175 L152 230 L150 235 L148 230 Z" fill="#888"/>
                        <!-- Lapels -->
                        <path d="M120 160 L140 200 L130 280" fill="none" stroke="#555" stroke-width="2"/>
                        <path d="M180 160 L160 200 L170 280" fill="none" stroke="#555" stroke-width="2"/>
                        <!-- Arms -->
                        <path d="M80 175 Q60 200 70 250 Q75 280 90 300" fill="#6b6b6b" stroke="#6b6b6b" stroke-width="15" stroke-linecap="round"/>
                        <path d="M220 175 Q240 200 230 250 Q225 260 220 270" fill="#6b6b6b" stroke="#6b6b6b" stroke-width="15" stroke-linecap="round"/>
                        <!-- Hands -->
                        <circle cx="90" cy="305" r="12" fill="#e8d4c4"/>
                        <circle cx="220" cy="275" r="12" fill="#e8d4c4"/>
                        <!-- Bag -->
                        <ellipse cx="100" cy="330" rx="35" ry="20" fill="#1a1a1a"/>
                        <text x="85" y="335" fill="#fff" font-size="8" font-family="Arial">#FGEAR</text>
                        <!-- Watch -->
                        <rect x="80" y="290" width="15" height="20" rx="2" fill="#333"/>
                        <rect x="83" y="293" width="9" height="14" fill="#4a90d9"/>
                    </svg>
                </div>
            </div>
            <div class="greeting-right">
                <img src="new end.jpg" alt="DC Studio Logo" class="greeting-logo">
            </div>
        </div>
    </div>

    <!-- Dashboard Menu Page -->
    <div id="dashboardPage" class="page">
        <div class="dashboard-container">
            <header class="dashboard-header">
                <img src="new end.jpg" alt="DC Studio" class="header-logo">
                <div class="user-profile">
                    <i class="fas fa-user-circle"></i>
                </div>
            </header>
            <div class="dashboard-content">
                <div class="dashboard-left">
                    <div class="employee-illustration small">
                        <svg viewBox="0 0 300 400" class="person-svg-small">
                            <!-- Same illustration as greeting page -->
                            <defs>
                                <clipPath id="circleClip2">
                                    <circle cx="150" cy="80" r="45"/>
                                </clipPath>
                            </defs>
                            <path d="M105 60 Q150 20 195 60 Q200 45 180 35 Q150 25 120 35 Q100 45 105 60" fill="#1a1a1a"/>
                            <ellipse cx="150" cy="85" rx="40" ry="45" fill="#e8d4c4"/>
                            <path d="M115 55 Q120 35 135 40 Q140 30 155 35 Q165 25 175 35 Q185 30 190 45 Q195 40 195 55" fill="#1a1a1a"/>
                            <path d="M115 95 Q115 140 150 150 Q185 140 185 95 Q185 115 150 125 Q115 115 115 95" fill="#1a1a1a"/>
                            <rect x="112" y="70" width="30" height="22" rx="3" fill="none" stroke="#333" stroke-width="2"/>
                            <rect x="158" y="70" width="30" height="22" rx="3" fill="none" stroke="#333" stroke-width="2"/>
                            <line x1="142" y1="80" x2="158" y2="80" stroke="#333" stroke-width="2"/>
                            <circle cx="127" cy="81" r="4" fill="#333"/>
                            <circle cx="173" cy="81" r="4" fill="#333"/>
                            <circle cx="128" cy="80" r="1.5" fill="#fff"/>
                            <circle cx="174" cy="80" r="1.5" fill="#fff"/>
                            <path d="M115 65 Q127 60 140 65" fill="none" stroke="#1a1a1a" stroke-width="2"/>
                            <path d="M160 65 Q173 60 185 65" fill="none" stroke="#1a1a1a" stroke-width="2"/>
                            <path d="M140 110 Q150 118 160 110" fill="none" stroke="#fff" stroke-width="2"/>
                            <rect x="140" y="145" width="20" height="25" fill="#e8d4c4"/>
                            <path d="M80 280 L80 170 Q80 160 100 160 L120 160 L150 200 L180 160 L200 160 Q220 160 220 170 L220 280" fill="#6b6b6b"/>
                            <path d="M130 160 L150 200 L170 160" fill="#fff"/>
                            <path d="M145 175 L150 200 L155 175 L152 230 L150 235 L148 230 Z" fill="#888"/>
                            <path d="M120 160 L140 200 L130 280" fill="none" stroke="#555" stroke-width="2"/>
                            <path d="M180 160 L160 200 L170 280" fill="none" stroke="#555" stroke-width="2"/>
                            <path d="M80 175 Q60 200 70 250 Q75 280 90 300" fill="#6b6b6b" stroke="#6b6b6b" stroke-width="15" stroke-linecap="round"/>
                            <path d="M220 175 Q240 200 230 250 Q225 260 220 270" fill="#6b6b6b" stroke="#6b6b6b" stroke-width="15" stroke-linecap="round"/>
                            <circle cx="90" cy="305" r="12" fill="#e8d4c4"/>
                            <circle cx="220" cy="275" r="12" fill="#e8d4c4"/>
                            <ellipse cx="100" cy="330" rx="35" ry="20" fill="#1a1a1a"/>
                            <text x="85" y="335" fill="#fff" font-size="8" font-family="Arial">#FGEAR</text>
                            <rect x="80" y="290" width="15" height="20" rx="2" fill="#333"/>
                            <rect x="83" y="293" width="9" height="14" fill="#4a90d9"/>
                        </svg>
                    </div>
                </div>
                <div class="menu-grid">
                    <div class="menu-item" data-bookmark="true">
                        <div class="bookmark"></div>
                        <div class="menu-icon orange">
                            <i class="fas fa-tasks"></i>
                        </div>
                        <span class="menu-title">Task<br>Tracker</span>
                    </div>
                    <div class="menu-item">
                        <div class="menu-icon">
                            <i class="fas fa-layer-group"></i>
                        </div>
                        <span class="menu-title">Project<br>Tracker</span>
                    </div>
                    <div class="menu-item" id="reportsBtn">
                        <div class="menu-icon orange">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <span class="menu-title">Reports</span>
                    </div>
                    <div class="menu-item">
                        <div class="menu-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <span class="menu-title">Team</span>
                    </div>
                    <div class="menu-item" id="meetingAlignmentBtn">
                        <div class="menu-icon">
                            <i class="fas fa-comments"></i>
                        </div>
                        <span class="menu-title">Meeting<br>Alignment</span>
                    </div>
                    <div class="menu-item" data-bookmark="true">
                        <div class="bookmark"></div>
                        <div class="menu-icon">
                            <i class="fas fa-sign-out-alt"></i>
                        </div>
                        <span class="menu-title">Leaves</span>
                    </div>
                    <div class="menu-item">
                        <div class="menu-icon">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <span class="menu-title">Salary<br>Tracker</span>
                    </div>
                    <div class="menu-item">
                        <div class="menu-icon">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                        <span class="menu-title">Calender</span>
                    </div>
                </div>
            </div>
            <div class="dashboard-bg-illustration"></div>
        </div>
    </div>

    <!-- Meeting Alignment Page -->
    <div id="meetingAlignmentPage" class="page">
        <div class="meeting-container">
            <header class="meeting-header">
                <div class="header-left">
                    <button class="back-btn" id="backToDashboard">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <img src="new end.jpg" alt="DC Studio" class="header-logo">
                </div>
                <h1 class="page-title">Meeting Alignment</h1>
                <div class="header-right">
                    <div class="google-connect-status" id="googleConnectStatus">
                        <button class="google-btn" id="connectGoogleBtn">
                            <i class="fab fa-google"></i>
                            <span>Connect Google</span>
                        </button>
                    </div>
                </div>
            </header>

            <div class="meeting-content">
                <!-- Tabs -->
                <div class="meeting-tabs">
                    <button class="tab-btn active" data-tab="schedule">
                        <i class="fas fa-plus-circle"></i> Schedule Meeting
                    </button>
                    <button class="tab-btn" data-tab="upcoming">
                        <i class="fas fa-calendar-alt"></i> Upcoming
                    </button>
                    <button class="tab-btn" data-tab="past">
                        <i class="fas fa-history"></i> Past Meetings
                    </button>
                </div>

                <!-- Tab Contents -->
                <div class="tab-content">
                    <!-- Schedule Meeting Tab -->
                    <div class="tab-pane active" id="scheduleTab">
                        <form id="meetingForm" class="meeting-form">
                            <div class="form-section">
                                <h3>Meeting Details</h3>
                                <div class="form-group">
                                    <label for="meetingTitle">Meeting Title *</label>
                                    <input type="text" id="meetingTitle" name="title" placeholder="Enter meeting title" required>
                                </div>
                                <div class="form-group">
                                    <label for="meetingDescription">Description</label>
                                    <textarea id="meetingDescription" name="description" placeholder="Enter meeting description (optional)" rows="3"></textarea>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="meetingDate">Date *</label>
                                        <input type="date" id="meetingDate" name="meeting_date" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="startTime">Start Time *</label>
                                        <input type="time" id="startTime" name="start_time" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="endTime">End Time *</label>
                                        <input type="time" id="endTime" name="end_time" required>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h3>Participants</h3>
                                <div class="form-group">
                                    <label>Add Internal Employees</label>
                                    <div class="participant-search">
                                        <input type="text" id="employeeSearch" placeholder="Search employees by name or email..." autocomplete="off">
                                        <div class="search-results" id="employeeSearchResults"></div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>Add External Participants</label>
                                    <div class="external-participant-input">
                                        <input type="text" id="externalName" placeholder="Name">
                                        <input type="email" id="externalEmail" placeholder="Email">
                                        <button type="button" id="addExternalBtn" class="add-btn">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="selected-participants" id="selectedParticipants">
                                    <!-- Selected participants will appear here -->
                                </div>
                            </div>

                            <div class="form-section">
                                <h3>Options</h3>
                                <div class="form-checkbox">
                                    <input type="checkbox" id="createGoogleMeet" name="create_google_meet" checked>
                                    <label for="createGoogleMeet">
                                        <i class="fab fa-google"></i> Create Google Meet link
                                    </label>
                                </div>
                                <div class="form-checkbox">
                                    <input type="checkbox" id="sendInvites" name="send_invites" checked>
                                    <label for="sendInvites">
                                        <i class="fas fa-envelope"></i> Send email invitations
                                    </label>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="submit" class="submit-btn">
                                    <i class="fas fa-calendar-check"></i> Schedule Meeting
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Upcoming Meetings Tab -->
                    <div class="tab-pane" id="upcomingTab">
                        <div class="meetings-list" id="upcomingMeetingsList">
                            <div class="loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i> Loading meetings...
                            </div>
                        </div>
                    </div>

                    <!-- Past Meetings Tab -->
                    <div class="tab-pane" id="pastTab">
                        <div class="meetings-list" id="pastMeetingsList">
                            <div class="loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i> Loading meetings...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Live Meeting Page -->
    <div id="liveMeetingPage" class="page">
        <div class="live-meeting-container">
            <header class="live-meeting-header">
                <div class="header-left">
                    <button class="back-btn" id="backToMeetings">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <h1 class="meeting-title" id="liveMeetingTitle">Meeting Title</h1>
                </div>
                <div class="meeting-timer" id="meetingTimer">
                    <i class="fas fa-clock"></i>
                    <span id="timerDisplay">00:00:00</span>
                </div>
                <div class="header-right">
                    <a href="#" class="join-meet-btn" id="joinMeetBtn" target="_blank">
                        <i class="fas fa-video"></i> Join Meet
                    </a>
                    <button class="end-meeting-btn" id="endMeetingBtn">
                        <i class="fas fa-stop-circle"></i> End Meeting
                    </button>
                </div>
            </header>

            <div class="live-meeting-content">
                <!-- Left Panel: Transcript -->
                <div class="transcript-panel">
                    <div class="panel-header">
                        <h3><i class="fas fa-microphone"></i> Live Transcript</h3>
                        <div class="transcript-controls">
                            <button class="control-btn" id="startTranscriptBtn" title="Start Recording">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="control-btn" id="pauseTranscriptBtn" title="Pause Recording" style="display: none;">
                                <i class="fas fa-pause"></i>
                            </button>
                            <span class="recording-indicator" id="recordingIndicator" style="display: none;">
                                <span class="pulse"></span> Recording
                            </span>
                        </div>
                    </div>
                    <div class="transcript-content" id="transcriptContent">
                        <p class="transcript-placeholder">Click the play button to start recording the meeting transcript using your microphone.</p>
                    </div>
                    <div class="transcript-actions">
                        <button class="action-btn" id="saveTranscriptBtn">
                            <i class="fas fa-save"></i> Save Transcript
                        </button>
                        <button class="action-btn" id="clearTranscriptBtn">
                            <i class="fas fa-eraser"></i> Clear
                        </button>
                    </div>
                </div>

                <!-- Right Panel: Annotations -->
                <div class="annotations-panel">
                    <div class="panel-header">
                        <h3><i class="fas fa-sticky-note"></i> Annotations</h3>
                    </div>
                    <div class="annotation-filters">
                        <button class="filter-btn active" data-type="all">All</button>
                        <button class="filter-btn" data-type="note">Notes</button>
                        <button class="filter-btn" data-type="action_item">Actions</button>
                        <button class="filter-btn" data-type="decision">Decisions</button>
                        <button class="filter-btn" data-type="important">Important</button>
                    </div>
                    <div class="annotations-list" id="annotationsList">
                        <!-- Annotations will be rendered here -->
                    </div>
                    <div class="add-annotation">
                        <select id="annotationType">
                            <option value="note">Note</option>
                            <option value="action_item">Action Item</option>
                            <option value="decision">Decision</option>
                            <option value="question">Question</option>
                            <option value="important">Important</option>
                        </select>
                        <input type="text" id="annotationText" placeholder="Add a note...">
                        <button class="add-annotation-btn" id="addAnnotationBtn">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Reports Page -->
    <div id="reportsPage" class="page">
        <div class="reports-container">
            <header class="reports-header">
                <div class="header-left">
                    <button class="back-btn" id="backFromReports">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <img src="new end.jpg" alt="DC Studio" class="header-logo">
                </div>
                <h1 class="page-title">Reports</h1>
                <div class="header-right">
                    <div class="user-profile">
                        <i class="fas fa-user-circle"></i>
                    </div>
                </div>
            </header>
            <div class="reports-iframe-container">
                <iframe
                    id="reportsIframe"
                    src=""
                    title="DC Studio Reports"
                    frameborder="0"
                    allowfullscreen
                    allow="camera; microphone; geolocation"
                ></iframe>
                <div class="iframe-loading" id="iframeLoading">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading Reports...</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Meeting Details Modal -->
    <div class="modal" id="meetingDetailsModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalMeetingTitle">Meeting Details</h2>
                <button class="modal-close" id="closeModalBtn">&times;</button>
            </div>
            <div class="modal-body" id="modalMeetingBody">
                <!-- Meeting details will be loaded here -->
            </div>
            <div class="modal-footer" id="modalMeetingFooter">
                <!-- Action buttons will be added here -->
            </div>
        </div>
    </div>

    <script src="script.js"></script>
    <script src="js/meeting-alignment.js"></script>
</body>
</html>
