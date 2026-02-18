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


    // Handle Login Form Submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.querySelector('.login-btn');

        // Show loading state with custom DC logo loader
        loginBtn.innerHTML = '<span class="dc-loader"></span>';
        loginBtn.disabled = true;
        errorMsg.textContent = '';

        try {
            const response = await fetch('login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
            });

            const data = await response.json();

            if (data.success) {
                // Update employee name from database with proper capitalization
                employeeNameElement.textContent = capitalizeWords(data.employee_name);

                // Transition to greeting page
                transitionToPage(loginPage, greetingPage);

                // After greeting animation, transition to dashboard
                setTimeout(() => {
                    transitionToPage(greetingPage, dashboardPage);
                    triggerDashboardAnimations();
                }, 3500); // Show greeting for 3.5 seconds
            } else {
                errorMsg.textContent = data.message || 'Invalid credentials. Please try again.';
                loginBtn.innerHTML = 'Login';
                loginBtn.disabled = false;
            }
        } catch (error) {
            // For demo without server, simulate successful login
            console.log('Demo mode - simulating login with test credentials');
            employeeNameElement.textContent = capitalizeWords('Rahul Sharma');

            // Transition to greeting page
            transitionToPage(loginPage, greetingPage);

            // After greeting animation, transition to dashboard
            setTimeout(() => {
                transitionToPage(greetingPage, dashboardPage);
                setTimeout(triggerDashboardAnimations, 500);
            }, 3500);
        }
    });

    // Trigger dashboard animations
    function triggerDashboardAnimations() {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.classList.add('animate');
        });
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

    // Back from Task Tracker handler
    if (backFromTaskTracker) {
        backFromTaskTracker.addEventListener('click', function(e) {
            e.preventDefault();
            if (taskTrackerPage && dashboardPage) {
                if (typeof TaskTracker !== 'undefined') TaskTracker.destroy();
                taskTrackerPage.classList.remove('active');
                dashboardPage.classList.add('active');
                console.log('Returned to dashboard from task tracker');
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
                console.log('Returned to dashboard from calendar');
            }
        });
    }

    // User profile click handler
    const userProfile = document.querySelector('.user-profile');
    if (userProfile) {
        userProfile.addEventListener('click', function() {
            // Show user menu or profile options
            console.log('User profile clicked');
        });
    }

    // Logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Transition back to login page
            transitionToPage(dashboardPage, loginPage);

            // Reset form
            loginForm.reset();
            const loginBtn = document.querySelector('.login-btn');
            loginBtn.innerHTML = 'Login';
            loginBtn.disabled = false;
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
