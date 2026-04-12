// Global page transition function
function transitionToPage(fromPage, toPage) {
    // Add fade-out class to outgoing page
    fromPage.classList.add('fade-out');

    setTimeout(() => {
        fromPage.classList.remove('active', 'fade-out');
        toPage.classList.add('active');
    }, 400);
}

// Global function to navigate to a page by ID
function navigateToPage(pageId) {
    const currentPage = document.querySelector('.page.active');
    const targetPage = document.getElementById(pageId);
    if (currentPage && targetPage) {
        transitionToPage(currentPage, targetPage);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginPage = document.getElementById('loginPage');
    const greetingPage = document.getElementById('greetingPage');
    const dashboardPage = document.getElementById('dashboardPage');
    const employeeNameElement = document.getElementById('employeeName');
    const errorMsg = document.getElementById('errorMsg');


    // ── Auth token helpers ─────────────────────────────────────────────────
    function getToken()       { return localStorage.getItem('dc_token'); }
    function setToken(t, n, r){ localStorage.setItem('dc_token', t); localStorage.setItem('dc_name', n); localStorage.setItem('dc_role', r || ''); }
    function clearToken()     { localStorage.removeItem('dc_token'); localStorage.removeItem('dc_name'); localStorage.removeItem('dc_role'); }

    // ── Always refresh role from server so it's never stale ───────────────
    (function refreshRole() {
        const token = getToken();
        if (!token) return;
        fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.authenticated && data.role) {
                    localStorage.setItem('dc_role', data.role);
                }
            })
            .catch(() => {});
    })();

    // ── Handle Login Form Submission ───────────────────────────────────────
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.querySelector('.login-btn');

        loginBtn.innerHTML = '<span class="dc-loader"></span>';
        loginBtn.disabled  = true;
        errorMsg.textContent = '';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                setToken(data.token, data.name, data.role);
                if (data.email) localStorage.setItem('dc_email', data.email);
                employeeNameElement.textContent = capitalizeWords(data.name);
                transitionToPage(loginPage, greetingPage);
                setTimeout(() => {
                    transitionToPage(greetingPage, dashboardPage);
                    triggerDashboardAnimations();
                    if (typeof DCNotifications !== 'undefined') DCNotifications.init();
                    if (refreshProfileAvatars) refreshProfileAvatars();
                    // Show approval button only for admin/manager — always explicitly set to avoid stale state
                    var _role = localStorage.getItem('dc_role');
                    var _apprBtn = document.getElementById('approvalBtn');
                    if (_apprBtn) {
                        var _menuGrid = document.getElementById('menuGrid');
                        if (_role === 'admin' || _role === 'manager') {
                            _apprBtn.style.display = '';
                            if (_menuGrid) _menuGrid.classList.add('admin-mode');
                            if (typeof DCApprovals !== 'undefined') DCApprovals.fetchBadge();
                        } else {
                            _apprBtn.style.display = 'none';
                            if (_menuGrid) _menuGrid.classList.remove('admin-mode');
                        }
                    }
                }, 3500);
            } else {
                errorMsg.textContent = data.error || 'Invalid credentials. Please try again.';
                loginBtn.innerHTML = 'Login';
                loginBtn.disabled  = false;
            }
        } catch (error) {
            errorMsg.textContent = 'Cannot connect to server. Please try again.';
            loginBtn.innerHTML = 'Login';
            loginBtn.disabled  = false;
        }
    });

    // ── Register New Employee ───────────────────────────────────────────────
    (function initRegister() {
        const overlay      = document.getElementById('regOverlay');
        const openBtn      = document.getElementById('openRegBtn');
        const closeBtn     = document.getElementById('regCloseBtn');
        const cancelBtn    = document.getElementById('regCancelBtn');
        const form         = document.getElementById('regForm');
        const saveBtn      = document.getElementById('regSaveBtn');
        const errorEl      = document.getElementById('regErrorMsg');
        const successOl    = document.getElementById('regSuccessOverlay');
        const successOkBtn = document.getElementById('regSuccessOkBtn');
        const sameAddrChk  = document.getElementById('regSameAddr');
        const permGrid     = document.getElementById('regPermAddrGrid');
        const today        = new Date().toISOString().split('T')[0];

        document.getElementById('regDateOfJoining').value = today;

        function openOverlay() {
            overlay.classList.add('active');
            overlay.scrollTop = 0;
            loadReportingManagers();
        }
        function closeOverlay() {
            overlay.classList.remove('active');
            form.reset();
            errorEl.textContent = '';
            permGrid.classList.remove('reg-hidden');
            document.getElementById('regDateOfJoining').value = today;
            clearAutoFields();
        }

        openBtn.addEventListener('click', openOverlay);
        closeBtn.addEventListener('click', closeOverlay);
        cancelBtn.addEventListener('click', closeOverlay);

        // Auto-generate User ID and Email preview as name is typed
        function clearAutoFields() {
            document.getElementById('regUserId').value = '';
            document.getElementById('regOfficeEmail').value = '';
        }
        function updateAutoFields() {
            const fn = document.getElementById('regFirstName').value.trim().toLowerCase().replace(/\s+/g, '');
            const ln = document.getElementById('regLastName').value.trim().toLowerCase().replace(/\s+/g, '');
            if (fn && ln) {
                document.getElementById('regOfficeEmail').value = `${fn}.${ln}@dcstudio.com`;
                document.getElementById('regUserId').value = 'EMP(auto)';
            } else {
                clearAutoFields();
            }
        }
        document.getElementById('regFirstName').addEventListener('input', updateAutoFields);
        document.getElementById('regLastName').addEventListener('input',  updateAutoFields);

        // Same address checkbox
        sameAddrChk.addEventListener('change', function() {
            permGrid.classList.toggle('reg-hidden', this.checked);
        });

        // Load reporting managers from team API
        async function loadReportingManagers() {
            const sel = document.getElementById('regReportingManager');
            if (sel.options.length > 1) return; // already loaded
            try {
                const res = await fetch('/api/team');
                const data = await res.json();
                (data.members || []).forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.name;
                    opt.textContent = m.name;
                    sel.appendChild(opt);
                });
            } catch (_) {}
        }

        // Form submit
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            errorEl.textContent = '';

            const payload = {
                firstName:        document.getElementById('regFirstName').value.trim(),
                middleName:       document.getElementById('regMiddleName').value.trim(),
                lastName:         document.getElementById('regLastName').value.trim(),
                gender:           document.getElementById('regGender').value,
                dob:              document.getElementById('regDob').value,
                pan:              document.getElementById('regPan').value.trim(),
                aadhaar:          document.getElementById('regAadhaar').value.trim(),
                dateOfJoining:    document.getElementById('regDateOfJoining').value,
                designation:      document.getElementById('regDesignation').value.trim(),
                role:             document.getElementById('regRole').value,
                salary:           parseFloat(document.getElementById('regSalary').value) || 0,
                reportingManager: document.getElementById('regReportingManager').value,
                isReportingManager: document.getElementById('regIsRM').value,
                currAddr1:        document.getElementById('regCurrAddr1').value.trim(),
                currAddr2:        document.getElementById('regCurrAddr2').value.trim(),
                currCity:         document.getElementById('regCurrCity').value.trim(),
                currState:        document.getElementById('regCurrState').value,
                currPincode:      document.getElementById('regCurrPincode').value.trim(),
                currCountry:      document.getElementById('regCurrCountry').value.trim(),
                currPhone:        document.getElementById('regCurrPhone').value.trim(),
                currMobile:       document.getElementById('regCurrMobile').value.trim(),
                sameAddress:      sameAddrChk.checked,
                permAddr1:        document.getElementById('regPermAddr1').value.trim(),
                permAddr2:        document.getElementById('regPermAddr2').value.trim(),
                permCity:         document.getElementById('regPermCity').value.trim(),
                permState:        document.getElementById('regPermState').value,
                permPincode:      document.getElementById('regPermPincode').value.trim(),
                permCountry:      document.getElementById('regPermCountry').value.trim(),
                permPhone:        document.getElementById('regPermPhone').value.trim(),
                permMobile:       document.getElementById('regPermMobile').value.trim(),
                kinName:          document.getElementById('regKinName').value.trim(),
                kinRelation:      document.getElementById('regKinRelation').value.trim(),
                kinContact:       document.getElementById('regKinContact').value.trim()
            };

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="dc-loader"></span> Saving…';

            try {
                const res  = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await res.json();
                if (data.success) {
                    overlay.classList.remove('active');
                    if (data.pending) {
                        document.getElementById('regSuccessHeading').textContent = 'Registration Submitted!';
                        document.getElementById('regSuccessIcon').className      = 'fas fa-hourglass-half';
                        document.getElementById('regSuccessName').textContent    = data.name + ' has been submitted for admin approval.';
                        document.getElementById('regSuccessCredsBox').style.display = 'none';
                        document.getElementById('regSuccessNote').textContent    = 'Login credentials will be created once an admin approves the registration.';
                    } else {
                        document.getElementById('regSuccessHeading').textContent = 'Employee Registered!';
                        document.getElementById('regSuccessIcon').className      = 'fas fa-check-circle';
                        document.getElementById('regSuccessName').textContent    = data.name + ' has been registered.';
                        document.getElementById('regSuccessCredsBox').style.display = '';
                        document.getElementById('regSuccessUserId').textContent  = data.userId;
                        document.getElementById('regSuccessEmail').textContent   = data.officeEmail;
                        document.getElementById('regSuccessPass').textContent    = data.tempPassword;
                        document.getElementById('regSuccessNote').textContent    = 'Please share these credentials with the employee.';
                    }
                    successOl.classList.add('active');
                } else {
                    errorEl.textContent = data.error || 'Registration failed.';
                }
            } catch (_) {
                errorEl.textContent = 'Cannot connect to server.';
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Employee';
            }
        });

        successOkBtn.addEventListener('click', function() {
            successOl.classList.remove('active');
            form.reset();
            errorEl.textContent = '';
            permGrid.classList.remove('reg-hidden');
            document.getElementById('regDateOfJoining').value = today;
            clearAutoFields();
        });
    })();

    // Trigger dashboard animations
    function triggerDashboardAnimations() {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.classList.add('animate');
        });
        loadAttendanceSummary();
    }

    // Load monthly attendance summary bar
    function loadAttendanceSummary() {
        const token = localStorage.getItem('dc_token');
        if (!token) return;
        fetch('/api/attendance/monthly-summary', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.error) return;
            var title = document.getElementById('attSummaryTitle');
            if (title && data.monthLabel) title.textContent = 'Current Month Summary (' + data.monthLabel + ')';
            var set = function(id, val) {
                var el = document.getElementById(id);
                if (el) el.textContent = val != null ? val : '—';
            };
            set('attWorkingDays', data.workingDays);
            set('attPresent',     data.present);
            set('attLeavesTaken', data.leavesTaken);
            set('attDaysLate',    data.daysLate);
        })
        .catch(function() {});
    }

    // Menu item click handlers
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const titleElement = this.querySelector('.menu-title');
            const title = titleElement.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
            console.log('Clicked:', title);
            // Add more navigation logic for other menu items here
        });
    });

    // Specific handler for Meeting Alignment button
    const meetingAlignmentBtn = document.getElementById('meetingAlignmentBtn');
    console.log('Meeting Alignment button found:', !!meetingAlignmentBtn);

    if (meetingAlignmentBtn) {
        meetingAlignmentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('=== Meeting Alignment Clicked ===');

            const meetingPage = document.getElementById('meetingAlignmentPage');
            console.log('Dashboard page:', !!dashboardPage);
            console.log('Meeting page:', !!meetingPage);

            if (meetingPage && dashboardPage) {
                // Direct DOM manipulation for visibility
                dashboardPage.classList.remove('active');
                meetingPage.classList.add('active');

                console.log('Pages switched!');

                // Initialize meeting page
                setTimeout(() => {
                    if (typeof MeetingAlignment !== 'undefined') {
                        MeetingAlignment.init();
                        console.log('MeetingAlignment initialized');
                    } else {
                        console.error('MeetingAlignment module not found');
                    }
                }, 100);
            } else {
                alert('Error: Could not find meeting page elements');
            }
        });
    } else {
        console.error('Meeting Alignment button not found in DOM');
    }

    // Reports button click handler
    const reportsBtn = document.getElementById('reportsBtn');
    const reportsPage = document.getElementById('reportsPage');
    const backFromReports = document.getElementById('backFromReports');

    if (reportsBtn) {
        reportsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('=== Reports Clicked ===');

            if (reportsPage && dashboardPage) {
                // Switch pages
                dashboardPage.classList.remove('active');
                reportsPage.classList.add('active');

                // Initialize the reports module
                if (typeof DCReports !== 'undefined') {
                    DCReports.init();
                    console.log('DCReports initialized');
                } else {
                    console.error('DCReports module not found');
                }

                console.log('Reports page opened');
            }
        });
    }

    // Back from Reports handler
    if (backFromReports) {
        backFromReports.addEventListener('click', function(e) {
            e.preventDefault();
            if (reportsPage && dashboardPage) {
                reportsPage.classList.remove('active');
                dashboardPage.classList.add('active');
                console.log('Returned to dashboard from reports');
            }
        });
    }

    // Task Tracker button click handler
    const taskTrackerBtn = document.getElementById('taskTrackerBtn');
    const taskTrackerPage = document.getElementById('taskTrackerPage');
    const backFromTaskTracker = document.getElementById('backFromTaskTracker');

    if (taskTrackerBtn) {
        taskTrackerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('=== Task Tracker Clicked ===');

            if (taskTrackerPage && dashboardPage) {
                dashboardPage.classList.remove('active');
                taskTrackerPage.classList.add('active');

                if (typeof TaskTracker !== 'undefined') {
                    TaskTracker.init();
                    console.log('TaskTracker initialized');
                } else {
                    console.error('TaskTracker module not found');
                }
            }
        });
    }

    // Refresh notifications whenever we return to the dashboard
    function onReturnToDashboard() {
        if (typeof DCNotifications !== 'undefined') DCNotifications.check();
    }

    // Back from Task Tracker handler
    if (backFromTaskTracker) {
        backFromTaskTracker.addEventListener('click', function(e) {
            e.preventDefault();
            if (taskTrackerPage && dashboardPage) {
                if (typeof TaskTracker !== 'undefined') TaskTracker.destroy();
                taskTrackerPage.classList.remove('active');
                dashboardPage.classList.add('active');
                onReturnToDashboard();
            }
        });
    }

    // Calendar button click handler
    const calendarBtn = document.getElementById('calendarBtn');
    const calendarPage = document.getElementById('calendarPage');
    const backFromCalendar = document.getElementById('backFromCalendar');

    if (calendarBtn) {
        calendarBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('=== Calendar Clicked ===');

            if (calendarPage && dashboardPage) {
                dashboardPage.classList.remove('active');
                calendarPage.classList.add('active');

                if (typeof DCCalendar !== 'undefined') {
                    DCCalendar.init();
                    console.log('DCCalendar initialized');
                } else {
                    console.error('DCCalendar module not found');
                }
            }
        });
    }

    // Back from Calendar handler
    if (backFromCalendar) {
        backFromCalendar.addEventListener('click', function(e) {
            e.preventDefault();
            if (calendarPage && dashboardPage) {
                if (typeof DCCalendar !== 'undefined') DCCalendar.destroy();
                calendarPage.classList.remove('active');
                dashboardPage.classList.add('active');
                onReturnToDashboard();
            }
        });
    }

    // Salary Tracker button click handler
    const salaryBtn = document.getElementById('salaryBtn');
    const salaryPage = document.getElementById('salaryPage');
    const backFromSalary = document.getElementById('backFromSalary');

    if (salaryBtn) {
        salaryBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('=== Salary Tracker Clicked ===');

            if (salaryPage && dashboardPage) {
                dashboardPage.classList.remove('active');
                salaryPage.classList.add('active');

                if (typeof DCSalary !== 'undefined') {
                    DCSalary.init();
                    console.log('DCSalary initialized');
                } else {
                    console.error('DCSalary module not found');
                }
            }
        });
    }

    if (backFromSalary) {
        backFromSalary.addEventListener('click', function(e) {
            e.preventDefault();
            if (salaryPage && dashboardPage) {
                if (typeof DCSalary !== 'undefined') DCSalary.destroy();
                salaryPage.classList.remove('active');
                dashboardPage.classList.add('active');
                onReturnToDashboard();
            }
        });
    }

    // Leaves button click handler
    const leavesBtn = document.getElementById('leavesBtn');
    const leavePage = document.getElementById('leavePage');
    const backFromLeaves = document.getElementById('backFromLeaves');

    if (leavesBtn) {
        leavesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('=== Leaves Clicked ===');

            if (leavePage && dashboardPage) {
                dashboardPage.classList.remove('active');
                leavePage.classList.add('active');

                if (typeof DCLeaves !== 'undefined') {
                    DCLeaves.init();
                    console.log('DCLeaves initialized');
                } else {
                    console.error('DCLeaves module not found');
                }
            }
        });
    }

    if (backFromLeaves) {
        backFromLeaves.addEventListener('click', function(e) {
            e.preventDefault();
            if (leavePage && dashboardPage) {
                if (typeof DCLeaves !== 'undefined') DCLeaves.destroy();
                leavePage.classList.remove('active');
                dashboardPage.classList.add('active');
                onReturnToDashboard();
            }
        });
    }

    // Approvals button — show only for admin, wire up navigation
    (function () {
        var approvalBtn  = document.getElementById('approvalBtn');
        var approvalPage = document.getElementById('approvalPage');
        var backBtn      = document.getElementById('backFromApprovals');
        var role = localStorage.getItem('dc_role');

        if (approvalBtn && (role === 'admin' || role === 'manager')) {
            approvalBtn.style.display = '';
            var menuGrid = document.getElementById('menuGrid');
            if (menuGrid) menuGrid.classList.add('admin-mode');
            if (typeof DCApprovals !== 'undefined') DCApprovals.fetchBadge();
        }

        if (approvalBtn) {
            approvalBtn.addEventListener('click', function (e) {
                e.preventDefault(); e.stopPropagation();
                if (approvalPage && dashboardPage) {
                    dashboardPage.classList.remove('active');
                    approvalPage.classList.add('active');
                    if (typeof DCApprovals !== 'undefined') DCApprovals.init();
                }
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if (approvalPage && dashboardPage) {
                    if (typeof DCApprovals !== 'undefined') DCApprovals.destroy();
                    approvalPage.classList.remove('active');
                    dashboardPage.classList.add('active');
                    onReturnToDashboard();
                }
            });
        }
    })();

    // Project Tracker button handler
    const projectTrackerBtn  = document.getElementById('projectTrackerBtn');
    const projectTrackerPage = document.getElementById('projectTrackerPage');
    if (projectTrackerBtn) {
        projectTrackerBtn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (projectTrackerPage && dashboardPage) {
                dashboardPage.classList.remove('active');
                projectTrackerPage.classList.add('active');
                if (typeof DCProjects !== 'undefined') DCProjects.init();
            }
        });
    }

    // Team button handler
    const teamBtn  = document.getElementById('teamBtn');
    const teamPage = document.getElementById('teamPage');
    if (teamBtn) {
        teamBtn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (teamPage && dashboardPage) {
                dashboardPage.classList.remove('active');
                teamPage.classList.add('active');
                if (typeof DCTeam !== 'undefined') DCTeam.init();
            }
        });
    }

    // ── Profile avatar & dropdown ─────────────────────────────────────────
    // Exposed so login handler can call it after token is stored
    let refreshProfileAvatars = null;

    (function initProfile() {
        const userProfile    = document.getElementById('userProfile');
        const dropdown       = document.getElementById('profileDropdown');
        const photoInput     = document.getElementById('profilePhotoInput');
        const removePhotoBtn = document.getElementById('pdRemovePhoto');

        // Get initials from name
        function getInitials(name) {
            if (!name) return '?';
            return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
        }

        // Update every avatar element with current photo / initials
        function refreshAvatars() {
            const name   = localStorage.getItem('dc_name') || '';
            const email  = localStorage.getItem('dc_email') || '';
            const role   = localStorage.getItem('dc_role')  || '';
            const photo  = localStorage.getItem('dc_avatar') || '';
            const initials = getInitials(name);

            // Small circle in header
            const uaImg      = document.getElementById('uaImg');
            const uaInitials = document.getElementById('uaInitials');
            if (photo) {
                uaImg.src = photo; uaImg.style.display = 'block';
                uaInitials.style.display = 'none';
            } else {
                uaImg.style.display = 'none';
                uaInitials.style.display = '';
                uaInitials.textContent = initials;
            }

            // Large avatar in dropdown
            const pdImg      = document.getElementById('pdImg');
            const pdInitials = document.getElementById('pdInitials');
            if (photo) {
                pdImg.src = photo; pdImg.style.display = 'block';
                pdInitials.style.display = 'none';
            } else {
                pdImg.style.display = 'none';
                pdInitials.style.display = '';
                pdInitials.textContent = initials;
            }

            // Text info in dropdown
            const pdName      = document.getElementById('pdName');
            const pdEmail     = document.getElementById('pdEmail');
            const pdRoleBadge = document.getElementById('pdRoleBadge');
            if (pdName)      pdName.textContent      = name;
            if (pdEmail)     pdEmail.textContent     = email;
            if (pdRoleBadge) pdRoleBadge.textContent = role;
        }

        // Fetch full user info from server and cache email
        async function loadUserInfo() {
            try {
                const token = getToken();
                const res = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                if (data && data.authenticated) {
                    if (data.email) localStorage.setItem('dc_email', data.email);
                    if (data.name)  localStorage.setItem('dc_name',  data.name);
                    if (data.role)  localStorage.setItem('dc_role',  data.role);
                }
            } catch (_) {}
            refreshAvatars();
            loadProfileDetails();
        }

        // Toggle dropdown
        if (userProfile) {
            userProfile.addEventListener('click', function (e) {
                e.stopPropagation();
                dropdown.classList.toggle('open');
            });
        }

        // Close on outside click
        document.addEventListener('click', function (e) {
            if (dropdown && dropdown.classList.contains('open')) {
                if (!dropdown.contains(e.target) && !userProfile.contains(e.target)) {
                    dropdown.classList.remove('open');
                }
            }
        });

        // Photo upload
        if (photoInput) {
            photoInput.addEventListener('change', function () {
                const file = photoInput.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function (ev) {
                    localStorage.setItem('dc_avatar', ev.target.result);
                    refreshAvatars();
                };
                reader.readAsDataURL(file);
                photoInput.value = '';
            });
        }

        // Remove photo
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', function () {
                localStorage.removeItem('dc_avatar');
                refreshAvatars();
            });
        }

        // ── Edit Profile modal ────────────────────────────────────────────
        const epOverlay   = document.getElementById('epOverlay');
        const epForm      = document.getElementById('epForm');
        const epCloseBtn  = document.getElementById('epCloseBtn');
        const epCancelBtn = document.getElementById('epCancelBtn');
        const epSaveBtn   = document.getElementById('epSaveBtn');
        const epErrorMsg  = document.getElementById('epErrorMsg');
        const pdEditBtn   = document.getElementById('pdEditProfileBtn');

        // Store last loaded profile for pre-filling form
        let _lastProfile = null;

        // Fetch and display extended profile fields (also caches for edit form)
        async function loadProfileDetails() {
            try {
                const token = getToken();
                if (!token) return;
                const res = await fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token } });
                if (!res.ok) return;
                const data = await res.json();
                const p = data.profile;
                if (!p) return;
                _lastProfile = p;

                function setDetail(id, val) {
                    const el = document.getElementById(id);
                    if (el) el.textContent = val || '—';
                }
                function fmtDate(d) {
                    if (!d) return '';
                    const parts = d.split('-');
                    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
                    return d;
                }
                function buildAddr(addr) {
                    if (!addr) return '';
                    return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country]
                        .filter(Boolean).join(', ');
                }

                setDetail('pdEmpId', p.userId);
                setDetail('pdDesignation', p.designation);
                setDetail('pdDepartment', p.department);
                setDetail('pdDateOfJoining', fmtDate(p.dateOfJoining));
                setDetail('pdMobile', p.address && p.address.current ? p.address.current.mobile : (p.mobile || ''));
                setDetail('pdDob', fmtDate(p.dob));
                setDetail('pdGender', p.gender);
                setDetail('pdAddress', buildAddr(p.address && p.address.current));
            } catch (_) {}
        }

        function openEditProfile() {
            if (!epOverlay) return;
            dropdown.classList.remove('open');
            const p = _lastProfile || {};
            const addr = (p.address && p.address.current) || {};

            function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
            setVal('epName',          p.name  || localStorage.getItem('dc_name') || '');
            setVal('epEmail',         p.email || localStorage.getItem('dc_email') || '');
            setVal('epUserId',        p.userId || '');
            setVal('epGender',        p.gender || '');
            setVal('epDob',           p.dob || '');
            setVal('epDesignation',   p.designation || '');
            setVal('epDepartment',    p.department || '');
            setVal('epDateOfJoining', p.dateOfJoining || '');
            setVal('epMobile',        addr.mobile || '');
            setVal('epPan',           p.pan || '');
            setVal('epAddr1',         addr.line1 || '');
            setVal('epAddr2',         addr.line2 || '');
            setVal('epCity',          addr.city || '');
            setVal('epState',         addr.state || '');
            setVal('epPincode',       addr.pincode || '');
            setVal('epCountry',       addr.country || 'India');

            if (epErrorMsg) epErrorMsg.textContent = '';
            epOverlay.classList.add('open');
        }

        function closeEditProfile() {
            if (epOverlay) epOverlay.classList.remove('open');
        }

        if (pdEditBtn)  pdEditBtn.addEventListener('click',  openEditProfile);
        if (epCloseBtn) epCloseBtn.addEventListener('click', closeEditProfile);
        if (epCancelBtn) epCancelBtn.addEventListener('click', closeEditProfile);
        if (epOverlay) {
            epOverlay.addEventListener('click', function(e) {
                if (e.target === epOverlay) closeEditProfile();
            });
        }

        if (epForm) {
            epForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                if (epSaveBtn) { epSaveBtn.disabled = true; epSaveBtn.textContent = 'Saving…'; }
                if (epErrorMsg) epErrorMsg.textContent = '';
                function getVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
                const body = {
                    designation:   getVal('epDesignation'),
                    department:    getVal('epDepartment'),
                    dateOfJoining: getVal('epDateOfJoining'),
                    gender:        getVal('epGender'),
                    dob:           getVal('epDob'),
                    mobile:        getVal('epMobile'),
                    addr1:         getVal('epAddr1'),
                    addr2:         getVal('epAddr2'),
                    city:          getVal('epCity'),
                    state:         getVal('epState'),
                    pincode:       getVal('epPincode'),
                    country:       getVal('epCountry'),
                };
                try {
                    const token = getToken();
                    const res = await fetch('/api/profile', {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json();
                    if (data.success) {
                        closeEditProfile();
                        await loadProfileDetails();
                        if (typeof showToast === 'function') showToast('Profile updated!', 'success');
                    } else {
                        if (epErrorMsg) epErrorMsg.textContent = data.error || 'Failed to save.';
                    }
                } catch (_) {
                    if (epErrorMsg) epErrorMsg.textContent = 'Network error. Please try again.';
                }
                if (epSaveBtn) { epSaveBtn.disabled = false; epSaveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
            });
        }

        // Expose so login handler can trigger a refresh (also reloads extended profile)
        refreshProfileAvatars = function() { refreshAvatars(); loadProfileDetails(); };

        // Init on load (works if already logged in; no-op if not authenticated yet)
        loadUserInfo();
    })();

    // Logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            const token = getToken();
            if (token) {
                try {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                } catch (_) {}
            }
            clearToken();
            transitionToPage(dashboardPage, loginPage);
            loginForm.reset();
            const loginBtn = document.querySelector('.login-btn');
            loginBtn.innerHTML = 'Login';
            loginBtn.disabled  = false;
            errorMsg.textContent = '';
        });
    }
});

// Utility function to capitalize words (first letter of each word uppercase)
function capitalizeWords(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// ── Shared Approval Modal ─────────────────────────────────────────────────
(function () {
    var _callback = null;

    window.openApprovalModal = function (opts) {
        // opts: { title, msg, action ('approve'|'reject'), commentLabel, onConfirm }
        _callback = opts.onConfirm || null;
        document.getElementById('apvTitle').textContent        = opts.title        || 'Confirm Action';
        document.getElementById('apvMsg').textContent          = opts.msg          || '';
        document.getElementById('apvCommentLabel').textContent = opts.commentLabel || 'Comments (optional)';
        document.getElementById('apvComments').value           = '';
        var confirmBtn = document.getElementById('apvConfirm');
        confirmBtn.textContent = opts.action === 'reject' ? 'Reject' : 'Approve';
        confirmBtn.className   = 'apv-confirm-btn ' + (opts.action || 'approve');
        document.getElementById('apvOverlay').classList.add('open');
        setTimeout(function () { document.getElementById('apvComments').focus(); }, 100);
    };

    window.closeApprovalModal = function () {
        document.getElementById('apvOverlay').classList.remove('open');
        _callback = null;
    };

    document.addEventListener('DOMContentLoaded', function () {
        var overlay    = document.getElementById('apvOverlay');
        var closeBtn   = document.getElementById('apvClose');
        var cancelBtn  = document.getElementById('apvCancel');
        var confirmBtn = document.getElementById('apvConfirm');
        if (closeBtn)   closeBtn.addEventListener('click', window.closeApprovalModal);
        if (cancelBtn)  cancelBtn.addEventListener('click', window.closeApprovalModal);
        if (overlay)    overlay.addEventListener('click', function (e) { if (e.target === overlay) window.closeApprovalModal(); });
        if (confirmBtn) confirmBtn.addEventListener('click', function () {
            var comments = document.getElementById('apvComments').value.trim();
            if (_callback) _callback(comments);
        });
    });
})();
