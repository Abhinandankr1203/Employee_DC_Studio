// ===== DC LEAVES MODULE =====
const DCLeaves = (function () {
    'use strict';

    // ---- State ----
    let initialized = false;

    function isAdminUser() { return localStorage.getItem('dc_role') === 'admin'; }

    // ---- DOM refs ----
    let els = {};

    // ---- Init ----
    async function init() {
        cacheElements();
        bindEvents();
        // Always sync role from server before rendering admin UI
        await syncRole();
        applyAdminLayout();
        loadSummary();
        loadRequests();
        initialized = true;
    }

    async function syncRole() {
        try {
            const data = await apiFetch('/api/auth/me');
            if (data && data.role) {
                localStorage.setItem('dc_role', data.role);
            }
        } catch (_) {}
    }

    function applyAdminLayout() {
        // All users (including admin) see their own leave data and can apply
    }

    function destroy() {
        initialized = false;
    }

    function cacheElements() {
        els = {
            summaryBody:       document.getElementById('lvSummaryBody'),
            summaryYear:       document.getElementById('lvSummaryYear'),
            applyForm:         document.getElementById('lvApplyForm'),
            leaveType:         document.getElementById('lvLeaveType'),
            leaveTypeShr:      document.getElementById('lvLeaveTypeShr'),
            fullDayFields:     document.getElementById('lvFullDayFields'),
            shortLeaveFields:  document.getElementById('lvShortLeaveFields'),
            fromDate:          document.getElementById('lvFromDate'),
            toDate:            document.getElementById('lvToDate'),
            nextJoining:       document.getElementById('lvNextJoining'),
            noDays:            document.getElementById('lvNoDays'),
            shrDate:           document.getElementById('lvShrDate'),
            fromTime:          document.getElementById('lvFromTime'),
            toTime:            document.getElementById('lvToTime'),
            duration:          document.getElementById('lvDuration'),
            remarks:           document.getElementById('lvRemarks'),
            requestsBody:      document.getElementById('lvRequestsBody'),
            emptyMsg:          document.getElementById('lvEmpty'),
            toast:             document.getElementById('lvToast'),
        };
        if (els.summaryYear) els.summaryYear.textContent = new Date().getFullYear();
    }

    function bindEvents() {
        if (els.applyForm) {
            els.applyForm.addEventListener('submit', handleApply);
        }
        // Type toggle — full-day row select
        if (els.leaveType) els.leaveType.addEventListener('change', onLeaveTypeChange);
        // Type toggle — SHR row select (syncs back to main select)
        if (els.leaveTypeShr) els.leaveTypeShr.addEventListener('change', onShrTypeChange);
        // Auto-calc days & next joining date (full-day leaves)
        if (els.fromDate) els.fromDate.addEventListener('change', calcDays);
        if (els.toDate)   els.toDate.addEventListener('change', calcDays);
        // Auto-calc duration (short leave)
        if (els.fromTime) els.fromTime.addEventListener('change', calcShortDuration);
        if (els.toTime)   els.toTime.addEventListener('change', calcShortDuration);
    }

    // ---- Leave type toggle ----
    function onLeaveTypeChange() {
        const isSHR = els.leaveType && els.leaveType.value === 'SHR';
        // Sync sibling select
        if (els.leaveTypeShr) els.leaveTypeShr.value = els.leaveType ? els.leaveType.value : '';

        if (els.fullDayFields) {
            els.fullDayFields.style.display = isSHR ? 'none' : '';
            [els.fromDate, els.toDate].forEach(function(el) {
                if (el) { if (isSHR) el.removeAttribute('required'); else el.setAttribute('required', ''); }
            });
        }
        if (els.shortLeaveFields) {
            els.shortLeaveFields.style.display = isSHR ? '' : 'none';
            [els.shrDate, els.fromTime, els.toTime].forEach(function(el) {
                if (el) { if (isSHR) el.setAttribute('required', ''); else el.removeAttribute('required'); }
            });
        }
        if (!isSHR) {
            if (els.noDays) els.noDays.value = '';
            if (els.nextJoining) els.nextJoining.value = '';
        } else {
            if (els.duration) els.duration.value = '';
        }
    }

    // When user changes type from within the SHR row, sync master select and re-run toggle
    function onShrTypeChange() {
        if (els.leaveType && els.leaveTypeShr) {
            els.leaveType.value = els.leaveTypeShr.value;
        }
        onLeaveTypeChange();
    }

    // ---- Auto calculations ----
    function calcDays() {
        const from = els.fromDate.value;
        const to   = els.toDate.value;
        if (!from || !to) return;

        const f = new Date(from);
        const t = new Date(to);
        if (t < f) {
            els.toDate.value = from;
            t.setTime(f.getTime());
        }

        const diffMs  = t - f;
        const diffDay = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
        els.noDays.value = diffDay;

        // Next joining date = to + 1
        const next = new Date(t);
        next.setDate(next.getDate() + 1);
        els.nextJoining.value = next.toISOString().split('T')[0];
    }

    function calcShortDuration() {
        const from = els.fromTime && els.fromTime.value;
        const to   = els.toTime   && els.toTime.value;
        if (!from || !to || !els.duration) return;

        const [fh, fm] = from.split(':').map(Number);
        const [th, tm] = to.split(':').map(Number);
        const totalMins = (th * 60 + tm) - (fh * 60 + fm);

        if (totalMins <= 0) {
            els.duration.value = 'Invalid time range';
            els.duration.style.color = '#dc2626';
            return;
        }
        if (totalMins > 120) {
            els.duration.value = 'Exceeds 2 hrs limit';
            els.duration.style.color = '#dc2626';
            return;
        }
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        els.duration.value = hrs > 0
            ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`)
            : `${mins}m`;
        els.duration.style.color = '#333';
    }

    // ---- API helpers ----
    async function apiFetch(path, opts) {
        try {
            const token = localStorage.getItem('dc_token');
            const headers = Object.assign({ 'Authorization': token ? 'Bearer ' + token : '' }, (opts && opts.headers) || {});
            const res = await fetch(path, Object.assign({}, opts, { headers }));
            if (res.status === 401) { window.location.reload(); return null; }
            return await res.json();
        } catch (_) {
            return null;
        }
    }

    // ---- Load summary ----
    async function loadSummary() {
        const year = new Date().getFullYear();
        const data = await apiFetch(`/api/leaves/summary?year=${year}`);
        renderSummary(data && data.summary ? data.summary : []);
    }

    function renderSummary(summary) {
        if (!els.summaryBody) return;
        if (!summary.length) {
            els.summaryBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px;">No leave allocation found.</td></tr>`;
            return;
        }
        els.summaryBody.innerHTML = summary.map(function(row) {
            const isSHR = row.type === 'SHR';
            const allocCell = isSHR
                ? `${row.allocated} <span class="lv-per-month-badge">/ month</span>`
                : row.allocated;
            const balanceCell = isSHR
                ? `<span class="lv-num-balance">${row.balance} left this month</span>`
                : `<span class="lv-num-balance">${row.balance}</span>`;
            return `
            <tr>
                <td><span class="lv-type-badge${isSHR ? ' lv-type-shr' : ''}">${escHtml(row.type)}</span></td>
                <td class="lv-num">${allocCell}</td>
                <td class="lv-num-pending">${row.pending}</td>
                <td class="lv-num-approved">${row.approved}</td>
                <td>${balanceCell}</td>
            </tr>`;
        }).join('');
    }

    // ---- Load requests ----
    async function loadRequests() {
        const data = await apiFetch('/api/leaves');
        renderRequests(data && data.leaves ? data.leaves : []);
    }

    function renderRequests(leaves) {
        if (!els.requestsBody) return;
        if (!leaves.length) {
            els.requestsBody.innerHTML = '';
            if (els.emptyMsg) els.emptyMsg.style.display = 'block';
            return;
        }
        if (els.emptyMsg) els.emptyMsg.style.display = 'none';

        // Group by month of from_date
        const groups = {};
        const groupOrder = [];
        leaves.forEach(lv => {
            const d = lv.from_date ? new Date(lv.from_date + 'T00:00:00') : new Date();
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!groups[key]) { groups[key] = { label, items: [] }; groupOrder.push(key); }
            groups[key].items.push(lv);
        });

        const nowKey = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');

        let html = '';
        groupOrder.forEach(key => {
            const g = groups[key];
            const isExpanded = key === nowKey || groupOrder.length === 1;
            const chevId = 'lv-chev-' + key;
            const hidden = isExpanded ? '' : ' lv-row-hidden';
            html += `
            <tr class="lv-month-header-row" onclick="DCLeaves._toggleMonth('${key}','${chevId}')">
                <td colspan="8">
                    <span class="lv-month-chevron" id="${chevId}" style="transform:rotate(${isExpanded ? 90 : 0}deg)">&#9654;</span>
                    <strong>${escHtml(g.label)}</strong>
                    <span class="lv-month-count">${g.items.length} request${g.items.length !== 1 ? 's' : ''}</span>
                </td>
            </tr>`;
            g.items.forEach(function(lv) {
                const isSHR = lv.type === 'SHR';
                const actionCell = lv.status === 'pending'
                    ? `<button class="lv-cancel-btn" title="Cancel" onclick="event.stopPropagation();DCLeaves.cancelLeave(${lv.id})"><i class="fas fa-times"></i></button>`
                    : '—';
                let fromCell, toCell, daysCell;
                if (isSHR) {
                    const timeRange = (lv.from_time && lv.to_time) ? `${lv.from_time} – ${lv.to_time}` : '—';
                    const hrs = lv.duration_hours || 0;
                    const durLabel = hrs >= 1
                        ? (hrs % 1 === 0 ? `${hrs}h` : `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`)
                        : `${Math.round(hrs * 60)}m`;
                    fromCell = `${formatDate(lv.from_date)} <span class="lv-shr-time">${timeRange}</span>`;
                    toCell = '—';
                    daysCell = `<span class="lv-shr-dur">${durLabel}</span>`;
                } else {
                    fromCell = formatDate(lv.from_date);
                    toCell   = formatDate(lv.to_date);
                    daysCell = lv.no_days;
                }
                const typeBadgeClass = isSHR ? 'lv-type-badge lv-type-shr' : 'lv-type-badge';
                html += `
                <tr class="lv-month-item${hidden}" data-group="${key}">
                    <td data-label="Type"><span class="${typeBadgeClass}">${escHtml(lv.type)}</span></td>
                    <td data-label="From">${fromCell}</td>
                    <td data-label="To">${toCell}</td>
                    <td data-label="Days">${daysCell}</td>
                    <td data-label="Reason">${escHtml(lv.reason || '—')}</td>
                    <td data-label="Status"><span class="lv-status lv-status-${lv.status}">${capitalize(lv.status)}</span></td>
                    <td data-label="Comments">${escHtml(lv.approver_comments || '—')}</td>
                    <td data-label="">${actionCell}</td>
                </tr>`;
            });
        });
        els.requestsBody.innerHTML = html;
    }

    function _toggleMonth(key, chevId) {
        const chev = document.getElementById(chevId);
        const rows = els.requestsBody ? els.requestsBody.querySelectorAll('tr[data-group="' + key + '"]') : [];
        const isHidden = rows.length > 0 && rows[0].classList.contains('lv-row-hidden');
        rows.forEach(function(r) { r.classList.toggle('lv-row-hidden', !isHidden); });
        if (chev) chev.style.transform = 'rotate(' + (isHidden ? 90 : 0) + 'deg)';
    }

    // ---- Apply for leave ----
    async function handleApply(e) {
        e.preventDefault();

        const type   = els.leaveType && els.leaveType.value;
        const reason = els.remarks && els.remarks.value.trim();

        if (!type) {
            showToast('Please select a leave type.', 'error');
            return;
        }

        let payload;

        if (type === 'SHR') {
            const shrDate  = els.shrDate  && els.shrDate.value;
            const fromTime = els.fromTime && els.fromTime.value;
            const toTime   = els.toTime   && els.toTime.value;

            if (!shrDate || !fromTime || !toTime) {
                showToast('Please fill in date and time fields.', 'error');
                return;
            }
            // Validate duration
            const [fh, fm] = fromTime.split(':').map(Number);
            const [th, tm] = toTime.split(':').map(Number);
            const totalMins = (th * 60 + tm) - (fh * 60 + fm);
            if (totalMins <= 0) {
                showToast('To Time must be after From Time.', 'error');
                return;
            }
            if (totalMins > 120) {
                showToast('Short Leave cannot exceed 2 hours.', 'error');
                return;
            }
            payload = {
                type,
                from_date: shrDate,
                to_date:   shrDate,
                from_time: fromTime,
                to_time:   toTime,
                duration_hours: parseFloat((totalMins / 60).toFixed(2)),
                no_days: 0,
                reason
            };
        } else {
            const fromDate = els.fromDate && els.fromDate.value;
            const toDate   = els.toDate   && els.toDate.value;
            const nextDate = els.nextJoining && els.nextJoining.value;
            const noDays   = parseFloat(els.noDays && els.noDays.value) || 1;

            if (!fromDate || !toDate) {
                showToast('Please fill in all required fields.', 'error');
                return;
            }
            payload = { type, from_date: fromDate, to_date: toDate, next_joining_date: nextDate, no_days: noDays, reason };
        }

        const applyBtn = els.applyForm.querySelector('.lv-apply-btn');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Applying...';

        const data = await apiFetch('/api/leaves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';

        if (data && data.success) {
            showToast('Leave application submitted!', 'success');
            els.applyForm.reset();
            // After reset, SHR row select reverts to its default "SHR selected" state — re-sync master
            if (els.leaveTypeShr) els.leaveTypeShr.value = 'SHR';
            if (els.leaveType) els.leaveType.value = '';
            onLeaveTypeChange(); // restore to full-day row (no type selected)
            loadSummary();
            loadRequests();
        } else {
            showToast((data && data.error) || 'Failed to apply. Please try again.', 'error');
        }
    }

    // ---- Admin: Approve / Reject leave ----
    function approveLeave(id) {
        openApprovalModal({
            title: 'Approve Leave Request',
            msg: 'Approve this leave request? The employee will be notified.',
            action: 'approve',
            commentLabel: 'Approval Comments (optional)',
            onConfirm: function (comments) {
                closeApprovalModal();
                doLeaveAction(id, 'approved', comments);
            }
        });
    }

    function rejectLeave(id) {
        openApprovalModal({
            title: 'Reject Leave Request',
            msg: 'Reject this leave request? Please provide a reason for the employee.',
            action: 'reject',
            commentLabel: 'Rejection Reason (optional)',
            onConfirm: function (comments) {
                closeApprovalModal();
                doLeaveAction(id, 'rejected', comments);
            }
        });
    }

    async function doLeaveAction(id, status, comments) {
        const data = await apiFetch(`/api/leaves/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, approver_comments: comments })
        });
        if (data && data.success) {
            showToast(status === 'approved' ? 'Leave approved!' : 'Leave rejected.', 'success');
            loadSummary();
            loadRequests();
        } else {
            showToast((data && data.error) || 'Action failed. Please try again.', 'error');
        }
    }

    // ---- Cancel leave ----
    async function cancelLeave(id) {
        if (!confirm('Cancel this leave request?')) return;

        const data = await apiFetch(`/api/leaves/${id}`, { method: 'DELETE' });
        if (data && data.success) {
            showToast('Leave request cancelled.', 'success');
            loadSummary();
            loadRequests();
        } else {
            showToast('Failed to cancel. Please try again.', 'error');
        }
    }

    // ---- Utilities ----
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    let toastTimer = null;
    function showToast(msg, type) {
        if (!els.toast) return;
        els.toast.textContent = msg;
        els.toast.className = `lv-toast ${type} show`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            els.toast.classList.remove('show');
        }, 3000);
    }

    // ---- Public API ----
    return { init, destroy, cancelLeave, approveLeave, rejectLeave, _toggleMonth };
})();
