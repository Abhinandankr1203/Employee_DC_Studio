// ===== DC LEAVES MODULE =====
const DCLeaves = (function () {
    'use strict';

    // ---- State ----
    let initialized = false;

    // ---- DOM refs ----
    let els = {};

    // ---- Init ----
    function init() {
        cacheElements();
        bindEvents();
        loadSummary();
        loadRequests();
        initialized = true;
    }

    function destroy() {
        initialized = false;
    }

    function cacheElements() {
        els = {
            summaryBody:  document.getElementById('lvSummaryBody'),
            summaryYear:  document.getElementById('lvSummaryYear'),
            applyForm:    document.getElementById('lvApplyForm'),
            leaveType:    document.getElementById('lvLeaveType'),
            fromDate:     document.getElementById('lvFromDate'),
            toDate:       document.getElementById('lvToDate'),
            nextJoining:  document.getElementById('lvNextJoining'),
            noDays:       document.getElementById('lvNoDays'),
            remarks:      document.getElementById('lvRemarks'),
            requestsBody: document.getElementById('lvRequestsBody'),
            emptyMsg:     document.getElementById('lvEmpty'),
            toast:        document.getElementById('lvToast'),
        };
        // Show current year
        if (els.summaryYear) els.summaryYear.textContent = new Date().getFullYear();
    }

    function bindEvents() {
        if (els.applyForm) {
            els.applyForm.addEventListener('submit', handleApply);
        }
        // Auto-calc days & next joining date
        if (els.fromDate) els.fromDate.addEventListener('change', calcDays);
        if (els.toDate)   els.toDate.addEventListener('change', calcDays);
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
        els.summaryBody.innerHTML = summary.map(row => `
            <tr>
                <td><span class="lv-type-badge">${escHtml(row.type)}</span></td>
                <td class="lv-num">${row.allocated}</td>
                <td class="lv-num-pending">${row.pending}</td>
                <td class="lv-num-approved">${row.approved}</td>
                <td class="lv-num-balance">${row.balance}</td>
            </tr>
        `).join('');
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
        els.requestsBody.innerHTML = leaves.map(lv => `
            <tr>
                <td><span class="lv-type-badge">${escHtml(lv.type)}</span></td>
                <td>${formatDate(lv.from_date)}</td>
                <td>${formatDate(lv.to_date)}</td>
                <td>${lv.no_days}</td>
                <td>${escHtml(lv.reason || '—')}</td>
                <td><span class="lv-status lv-status-${lv.status}">${capitalize(lv.status)}</span></td>
                <td>${escHtml(lv.approver_comments || '—')}</td>
                <td>
                    ${lv.status === 'pending'
                        ? `<button class="lv-cancel-btn" title="Cancel" onclick="DCLeaves.cancelLeave(${lv.id})"><i class="fas fa-times"></i></button>`
                        : '—'}
                </td>
            </tr>
        `).join('');
    }

    // ---- Apply for leave ----
    async function handleApply(e) {
        e.preventDefault();

        const type     = els.leaveType.value;
        const fromDate = els.fromDate.value;
        const toDate   = els.toDate.value;
        const nextDate = els.nextJoining.value;
        const noDays   = parseFloat(els.noDays.value) || 1;
        const reason   = els.remarks.value.trim();

        if (!type || !fromDate || !toDate) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        const applyBtn = els.applyForm.querySelector('.lv-apply-btn');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Applying...';

        const data = await apiFetch('/api/leaves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, from_date: fromDate, to_date: toDate, next_joining_date: nextDate, no_days: noDays, reason })
        });

        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';

        if (data && data.success) {
            showToast('Leave application submitted!', 'success');
            els.applyForm.reset();
            loadSummary();
            loadRequests();
        } else {
            showToast((data && data.error) || 'Failed to apply. Please try again.', 'error');
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
    return { init, destroy, cancelLeave };
})();
