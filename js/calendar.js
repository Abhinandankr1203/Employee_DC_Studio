const DCCalendar = (function () {
    'use strict';

    // State
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth(); // 0-indexed
    let events = [];
    let isGoogleConnected = false;
    let isInitialized = false;
    let pollInterval = null;

    // Cached DOM elements
    let els = {};

    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // =========== Setup ===========

    function init() {
        if (isInitialized) {
            loadCalendarData();
            return;
        }
        cacheElements();
        bindEvents();
        checkGoogleStatus();
        loadCalendarData();
        startPolling();
        isInitialized = true;
    }

    function cacheElements() {
        els.grid = document.getElementById('calGrid');
        els.monthLabel = document.getElementById('calMonthLabel');
        els.prevBtn = document.getElementById('calPrevMonth');
        els.nextBtn = document.getElementById('calNextMonth');
        els.todayBtn = document.getElementById('calTodayBtn');
        els.quickAddBtn = document.getElementById('calQuickAddBtn');
        els.connectBanner = document.getElementById('calConnectBanner');
        els.googleStatus = document.getElementById('calGoogleStatus');
        els.connectGoogleBtn = document.getElementById('calConnectGoogleBtn');
        els.bannerConnectBtn = document.getElementById('calBannerConnectBtn');

        // Quick Add modal
        els.eventModal = document.getElementById('calEventModal');
        els.eventForm = document.getElementById('calEventForm');
        els.eventModalClose = document.getElementById('calEventModalClose');
        els.eventCancel = document.getElementById('calEventCancel');
        els.eventTitle = document.getElementById('calEventTitle');
        els.eventDate = document.getElementById('calEventDate');
        els.eventStart = document.getElementById('calEventStart');
        els.eventEnd = document.getElementById('calEventEnd');
        els.eventDesc = document.getElementById('calEventDesc');

        // Detail modal
        els.detailModal = document.getElementById('calDetailModal');
        els.detailTitle = document.getElementById('calDetailTitle');
        els.detailBody = document.getElementById('calDetailBody');
        els.detailClose = document.getElementById('calDetailClose');
        els.detailModalClose = document.getElementById('calDetailModalClose');
    }

    function bindEvents() {
        els.prevBtn.addEventListener('click', prevMonth);
        els.nextBtn.addEventListener('click', nextMonth);
        els.todayBtn.addEventListener('click', goToToday);
        els.quickAddBtn.addEventListener('click', function () { openQuickAdd(); });

        // Google connect buttons
        els.connectGoogleBtn.addEventListener('click', connectGoogle);
        els.bannerConnectBtn.addEventListener('click', connectGoogle);

        // Quick Add modal
        els.eventModalClose.addEventListener('click', closeEventModal);
        els.eventCancel.addEventListener('click', closeEventModal);
        els.eventModal.addEventListener('click', function (e) {
            if (e.target === els.eventModal) closeEventModal();
        });
        els.eventForm.addEventListener('submit', handleQuickAdd);

        // Detail modal
        els.detailClose.addEventListener('click', closeDetailModal);
        els.detailModalClose.addEventListener('click', closeDetailModal);
        els.detailModal.addEventListener('click', function (e) {
            if (e.target === els.detailModal) closeDetailModal();
        });

        // Listen for Google auth success from popup
        window.addEventListener('message', function (e) {
            if (e.data && e.data.type === 'GOOGLE_AUTH_SUCCESS') {
                isGoogleConnected = true;
                updateGoogleUI();
                loadCalendarData();
            }
        });
    }

    // =========== Google Status ===========

    function checkGoogleStatus() {
        fetch('/api/oauth/status')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                isGoogleConnected = data.authenticated;
                updateGoogleUI();
            })
            .catch(function () {
                isGoogleConnected = false;
                updateGoogleUI();
            });
    }

    function updateGoogleUI() {
        if (isGoogleConnected) {
            els.connectGoogleBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Connected</span>';
            els.connectGoogleBtn.classList.add('connected');
            els.connectBanner.classList.remove('visible');
        } else {
            els.connectGoogleBtn.innerHTML = '<i class="fab fa-google"></i><span>Connect Google</span>';
            els.connectGoogleBtn.classList.remove('connected');
            els.connectBanner.classList.add('visible');
        }
    }

    function connectGoogle() {
        fetch('/api/oauth/init')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.authUrl) {
                    var w = 500, h = 600;
                    var left = (screen.width - w) / 2;
                    var top = (screen.height - h) / 2;
                    window.open(data.authUrl, 'GoogleAuth', 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
                }
            })
            .catch(function (err) {
                showNotification('Failed to start Google auth: ' + err.message, 'error');
            });
    }

    // =========== Data ===========

    function loadCalendarData() {
        var month = currentMonth + 1; // API expects 1-indexed
        fetch('/api/calendar/combined?month=' + month + '&year=' + currentYear)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                events = data.events || [];
                isGoogleConnected = data.authenticated;
                updateGoogleUI();
                renderCalendar();
            })
            .catch(function (err) {
                console.error('Failed to load calendar data:', err);
                events = [];
                renderCalendar();
            });
    }

    // =========== Navigation ===========

    function prevMonth() {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        updateMonthLabel();
        loadCalendarData();
    }

    function nextMonth() {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        updateMonthLabel();
        loadCalendarData();
    }

    function goToToday() {
        var now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth();
        updateMonthLabel();
        loadCalendarData();
    }

    function updateMonthLabel() {
        els.monthLabel.textContent = MONTH_NAMES[currentMonth] + ' ' + currentYear;
    }

    // =========== Rendering ===========

    function renderCalendar() {
        updateMonthLabel();
        var html = '';

        // Day-of-week headers
        for (var d = 0; d < 7; d++) {
            html += '<div class="cal-day-header">' + DAY_NAMES[d] + '</div>';
        }

        var daysInMonth = getDaysInMonth(currentYear, currentMonth);
        var firstDay = getFirstDayOfMonth(currentYear, currentMonth);

        // Previous month trailing days
        var prevMonthDays = getDaysInMonth(
            currentMonth === 0 ? currentYear - 1 : currentYear,
            currentMonth === 0 ? 11 : currentMonth - 1
        );
        for (var i = 0; i < firstDay; i++) {
            var day = prevMonthDays - firstDay + i + 1;
            html += '<div class="cal-day-cell cal-other-month">';
            html += '<div class="cal-day-number">' + day + '</div>';
            html += '<div class="cal-events"></div>';
            html += '</div>';
        }

        // Current month days
        var today = new Date();
        var todayStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

        for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = currentYear + '-' + pad(currentMonth + 1) + '-' + pad(day);
            var dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
            var isToday = dateStr === todayStr;
            var isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            var classes = 'cal-day-cell';
            if (isToday) classes += ' cal-today';
            if (isWeekend) classes += ' cal-weekend';

            html += '<div class="' + classes + '" data-date="' + dateStr + '" onclick="DCCalendar.onDayClick(\'' + dateStr + '\')">';
            html += '<div class="cal-day-number">' + day + '</div>';
            html += renderDayEvents(dateStr);
            html += '</div>';
        }

        // Next month leading days
        var totalCells = firstDay + daysInMonth;
        var remaining = (7 - (totalCells % 7)) % 7;
        for (var i = 1; i <= remaining; i++) {
            html += '<div class="cal-day-cell cal-other-month">';
            html += '<div class="cal-day-number">' + i + '</div>';
            html += '<div class="cal-events"></div>';
            html += '</div>';
        }

        els.grid.innerHTML = html;
    }

    function renderDayEvents(dateStr) {
        var dayEvents = events.filter(function (e) { return e.date === dateStr; });
        if (dayEvents.length === 0) return '<div class="cal-events"></div>';

        var html = '<div class="cal-events">';
        var maxShow = 3;

        for (var i = 0; i < Math.min(dayEvents.length, maxShow); i++) {
            var evt = dayEvents[i];
            var pillClass = getPillClass(evt);
            var timeStr = evt.startTime ? formatTime(evt.startTime) + ' ' : '';
            html += '<div class="cal-event-pill ' + pillClass + '" onclick="event.stopPropagation(); DCCalendar.openEventDetail(\'' + evt.id + '\')" title="' + escapeAttr(evt.title) + '">';
            html += timeStr + escapeHtml(evt.title);
            html += '</div>';
        }

        if (dayEvents.length > maxShow) {
            html += '<div class="cal-event-more" onclick="event.stopPropagation(); DCCalendar.onDayClick(\'' + dateStr + '\')">';
            html += '+' + (dayEvents.length - maxShow) + ' more';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function getPillClass(evt) {
        if (evt.type === 'google') return 'cal-pill-google';
        if (evt.type === 'meeting') return 'cal-pill-meeting';
        if (evt.type === 'task') {
            if (evt.status === 'done') return 'cal-pill-task-done';
            // Check if overdue using local date parts to avoid timezone issues
            var today = new Date();
            var todayStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
            if (evt.date < todayStr && evt.status !== 'done') return 'cal-pill-task-overdue';
            return 'cal-pill-task';
        }
        return 'cal-pill-task';
    }

    // =========== Interactions ===========

    function onDayClick(dateStr) {
        openQuickAdd(dateStr);
    }

    function openEventDetail(eventId) {
        var evt = events.find(function (e) { return e.id === eventId; });
        if (!evt) return;

        els.detailTitle.textContent = evt.title;

        var badgeClass = 'badge-' + evt.type;
        var typeLabel = evt.type === 'google' ? 'Google Calendar' : evt.type === 'meeting' ? 'Meeting' : 'Task';

        var html = '';
        html += '<div class="cal-detail-row"><span class="cal-type-badge ' + badgeClass + '">' + typeLabel + '</span></div>';

        if (evt.date) {
            var dateObj = new Date(evt.date + 'T00:00:00');
            var dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            html += '<div class="cal-detail-row"><i class="fas fa-calendar"></i><span>' + dateLabel + '</span></div>';
        }

        if (evt.startTime) {
            var timeText = formatTime(evt.startTime);
            if (evt.endTime) timeText += ' - ' + formatTime(evt.endTime);
            html += '<div class="cal-detail-row"><i class="fas fa-clock"></i><span>' + timeText + '</span></div>';
        }

        if (evt.priority) {
            html += '<div class="cal-detail-row"><i class="fas fa-flag"></i><span>Priority: <strong>' + evt.priority + '</strong></span></div>';
        }

        if (evt.status) {
            html += '<div class="cal-detail-row"><i class="fas fa-info-circle"></i><span>Status: <strong>' + evt.status + '</strong></span></div>';
        }

        if (evt.assignee) {
            html += '<div class="cal-detail-row"><i class="fas fa-user"></i><span>' + escapeHtml(evt.assignee) + '</span></div>';
        }

        if (evt.description) {
            html += '<div class="cal-detail-row"><i class="fas fa-align-left"></i><span>' + escapeHtml(evt.description) + '</span></div>';
        }

        if (evt.meetLink) {
            html += '<div class="cal-detail-row"><a href="' + escapeAttr(evt.meetLink) + '" target="_blank" class="cal-meet-link-btn"><i class="fas fa-video"></i> Join Google Meet</a></div>';
        }

        // Show "View in Task Tracker" button for tasks
        if (evt.type === 'task') {
            html += '<div class="cal-detail-row"><button class="cal-meet-link-btn" style="background:#6366f1;" onclick="DCCalendar.openTaskTracker()"><i class="fas fa-tasks"></i> View in Task Tracker</button></div>';
        }

        els.detailBody.innerHTML = html;
        els.detailModal.classList.add('active');
    }

    function closeDetailModal() {
        els.detailModal.classList.remove('active');
    }

    // =========== Quick Add ===========

    function openQuickAdd(dateStr) {
        els.eventForm.reset();
        if (dateStr) {
            els.eventDate.value = dateStr;
        } else {
            // Default to today
            var now = new Date();
            els.eventDate.value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        }
        els.eventModal.classList.add('active');
        els.eventTitle.focus();
    }

    function closeEventModal() {
        els.eventModal.classList.remove('active');
    }

    function handleQuickAdd(e) {
        e.preventDefault();

        if (!isGoogleConnected) {
            showNotification('Please connect Google Calendar first', 'error');
            return;
        }

        var payload = {
            title: els.eventTitle.value.trim(),
            date: els.eventDate.value,
            start_time: els.eventStart.value,
            end_time: els.eventEnd.value,
            description: els.eventDesc.value.trim()
        };

        if (!payload.title || !payload.date || !payload.start_time || !payload.end_time) {
            showNotification('Please fill all required fields', 'error');
            return;
        }

        var saveBtn = els.eventForm.querySelector('.cal-btn-save');
        var origText = saveBtn.textContent;
        saveBtn.textContent = 'Creating...';
        saveBtn.disabled = true;

        fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    showNotification('Event created successfully!', 'success');
                    closeEventModal();
                    loadCalendarData();
                } else {
                    showNotification('Failed: ' + (data.error || 'Unknown error'), 'error');
                }
            })
            .catch(function (err) {
                showNotification('Error: ' + err.message, 'error');
            })
            .finally(function () {
                saveBtn.textContent = origText;
                saveBtn.disabled = false;
            });
    }

    // =========== Polling ===========

    function startPolling() {
        stopPolling();
        pollInterval = setInterval(function () {
            loadCalendarData();
        }, 60000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    // =========== Utilities ===========

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    }

    function pad(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        var parts = timeStr.split(':');
        var h = parseInt(parts[0], 10);
        var m = parts[1] || '00';
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return h + ':' + m + ' ' + ampm;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function showNotification(message, type) {
        var toast = document.getElementById('reportToast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'report-toast ' + (type || 'success');
        toast.classList.add('show');
        setTimeout(function () {
            toast.classList.remove('show');
        }, 3000);
    }

    function openTaskTracker() {
        closeDetailModal();
        // Navigate to Task Tracker page
        var calPage = document.getElementById('calendarPage');
        var ttPage = document.getElementById('taskTrackerPage');
        if (calPage && ttPage) {
            stopPolling();
            calPage.classList.remove('active');
            ttPage.classList.add('active');
            if (typeof TaskTracker !== 'undefined') {
                TaskTracker.init();
            }
        }
    }

    function destroy() {
        stopPolling();
    }

    // =========== Public API ===========

    return {
        init: init,
        destroy: destroy,
        openEventDetail: openEventDetail,
        onDayClick: onDayClick,
        openTaskTracker: openTaskTracker
    };

})();
