// ===== DC NOTIFICATIONS MODULE =====
// Dynamically sets the orange bookmark indicator on dashboard menu items
// based on live data: pending tasks, leaves, reimbursements, upcoming deadlines, meetings
const DCNotifications = (function () {
    'use strict';

    const REFRESH_MS = 5 * 60 * 1000; // re-check every 5 minutes
    let timer = null;

    function apiFetch(path) {
        var token = localStorage.getItem('dc_token');
        return fetch(path, { headers: { 'Authorization': token ? 'Bearer ' + token : '' } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
    }

    function todayStr() {
        return new Date().toISOString().split('T')[0];
    }

    function daysAhead(n) {
        var d = new Date();
        d.setDate(d.getDate() + n);
        return d.toISOString().split('T')[0];
    }

    // Add or remove the orange bookmark + orange icon on a menu item
    function setNotif(btnId, active) {
        var btn = document.getElementById(btnId);
        if (!btn) return;
        var icon = btn.querySelector('.menu-icon');
        var bm   = btn.querySelector('.bookmark');

        if (active) {
            if (icon) icon.classList.add('orange');
            if (!bm) {
                bm = document.createElement('div');
                bm.className = 'bookmark';
                btn.insertBefore(bm, btn.firstChild);
            }
        } else {
            if (icon) icon.classList.remove('orange');
            if (bm) bm.remove();
        }
    }

    function check() {
        var today = todayStr();
        var in3   = daysAhead(3);
        var in14  = daysAhead(14);

        Promise.all([
            apiFetch('/api/tasks'),
            apiFetch('/api/leaves'),
            apiFetch('/api/reimbursements'),
            apiFetch('/api/projects'),
            apiFetch('/api/meetings')
        ]).then(function (results) {
            var tasks     = results[0];
            var leaves    = results[1];
            var reimb     = results[2];
            var projects  = results[3];
            var meetings  = results[4];

            // ── Task Tracker: any to-do, in-progress, or overdue tasks ──
            var taskList = tasks && tasks.tasks ? tasks.tasks : [];
            setNotif('taskTrackerBtn', taskList.some(function (t) {
                return t.status === 'to-do' ||
                       t.status === 'in-progress' ||
                       (t.due_date && t.due_date < today && t.status !== 'done');
            }));

            // ── Leaves: any pending leave request ──
            var leaveRequests = leaves && leaves.requests ? leaves.requests : [];
            setNotif('leavesBtn', leaveRequests.some(function (r) {
                return r.status === 'pending';
            }));

            // ── Salary: any pending reimbursement claim ──
            var claims = reimb && reimb.claims ? reimb.claims : [];
            setNotif('salaryBtn', claims.some(function (c) {
                return c.status === 'pending';
            }));

            // ── Project Tracker: active project deadline within 14 days ──
            var projectList = projects && projects.projects ? projects.projects : [];
            setNotif('projectTrackerBtn', projectList.some(function (p) {
                return p.status === 'active' &&
                       p.end_date && p.end_date >= today && p.end_date <= in14;
            }));

            // ── Calendar: scheduled meetings within next 3 days ──
            var meetingList = meetings && meetings.meetings ? meetings.meetings : [];
            var scheduledMeetings = meetingList.filter(function (m) {
                return m.status === 'scheduled';
            });
            setNotif('calendarBtn', scheduledMeetings.some(function (m) {
                return m.meeting_date && m.meeting_date >= today && m.meeting_date <= in3;
            }));

            // ── Meeting Alignment: scheduled meeting today or tomorrow ──
            setNotif('meetingAlignmentBtn', scheduledMeetings.some(function (m) {
                return m.meeting_date && m.meeting_date >= today && m.meeting_date <= daysAhead(1);
            }));
        });
    }

    function init() {
        check();
        clearInterval(timer);
        timer = setInterval(check, REFRESH_MS);
    }

    function destroy() {
        clearInterval(timer);
        timer = null;
    }

    return { init: init, check: check, destroy: destroy };
})();
