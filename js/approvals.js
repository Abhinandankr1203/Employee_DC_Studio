// ===== DC APPROVALS MODULE =====
const DCApprovals = (function () {
    'use strict';

    const TABS = [
        { key: 'leave',         label: 'Leave',          icon: 'fa-calendar-minus' },
        { key: 'reimbursement', label: 'Reimbursement',  icon: 'fa-receipt' },
        { key: 'employee',      label: 'New Employee',   icon: 'fa-user-plus' },
        { key: 'task',          label: 'Task',           icon: 'fa-tasks' },
        { key: 'project',       label: 'Project Phase',  icon: 'fa-layer-group' }
    ];

    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    let currentTab    = 'leave';
    let currentFilter = 'pending';
    let allItems      = [];
    let expandedMonths = new Set();
    let reviewTarget  = null;   // { id, type, action, title }
    let badgeTimer    = null;
    let tabCounts     = {};     // tab key → pending count

    // ── Auth fetch ──────────────────────────────────────────────────────────
    function apiFetch(path, opts) {
        var token = localStorage.getItem('dc_token');
        var headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' }, (opts && opts.headers) || {});
        return fetch(path, Object.assign({}, opts, { headers })).then(function (r) { return r.json(); });
    }

    // ── Init / Destroy ──────────────────────────────────────────────────────
    function init() {
        bindEvents();
        switchTab(currentTab);
        fetchBadge();
        startBadgeTimer();
    }

    function destroy() {
        stopBadgeTimer();
        expandedMonths.clear();
    }

    // ── Badge polling ───────────────────────────────────────────────────────
    function startBadgeTimer() {
        stopBadgeTimer();
        badgeTimer = setInterval(fetchBadge, 60000);
    }
    function stopBadgeTimer() {
        if (badgeTimer) { clearInterval(badgeTimer); badgeTimer = null; }
    }
    function fetchBadge() {
        var role = localStorage.getItem('dc_role');
        if (role !== 'admin' && role !== 'manager') return;
        apiFetch('/api/approvals/badge').then(function (data) {
            if (!data) return;
            // Update menu badge
            var badge = document.getElementById('approvalBadge');
            if (badge) {
                var total = data.total || 0;
                badge.textContent = total > 99 ? '99+' : String(total);
                badge.style.display = total > 0 ? '' : 'none';
            }
            // Store per-tab pending counts
            tabCounts = {
                leave:         data.leaves        || 0,
                reimbursement: data.reimbursements || 0,
                employee:      0,
                task:          0,
                project:       0
            };
            // Break down approval counts by type
            if (data.approvals_by_type) {
                tabCounts.employee = data.approvals_by_type.employee || 0;
                tabCounts.task     = data.approvals_by_type.task     || 0;
                tabCounts.project  = data.approvals_by_type.project  || 0;
            }
            renderTabBar();
        }).catch(function () {});
    }

    // ── Tab rendering ───────────────────────────────────────────────────────
    function renderTabBar() {
        var bar = document.getElementById('apprTabsBar');
        if (!bar) return;
        bar.innerHTML = TABS.map(function (t) {
            var cnt = tabCounts[t.key] || 0;
            var cntHtml = cnt > 0 ? '<span class="appr-tab-count">' + cnt + '</span>' : '';
            return '<button class="appr-tab' + (currentTab === t.key ? ' active' : '') + '" data-tab="' + t.key + '">'
                + '<i class="fas ' + t.icon + '"></i> ' + t.label + cntHtml + '</button>';
        }).join('');
        bar.querySelectorAll('.appr-tab').forEach(function (btn) {
            btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
        });
    }

    function switchTab(key) {
        currentTab = key;
        expandedMonths.clear();
        renderTabBar();
        loadCurrentTab();
    }

    // ── Load data for current tab ───────────────────────────────────────────
    function loadCurrentTab() {
        setLoading(true);
        var p;
        if (currentTab === 'leave') {
            p = apiFetch('/api/leaves?limit=500&all=1').then(function (d) { return (d && d.leaves) ? d.leaves : []; });
        } else if (currentTab === 'reimbursement') {
            p = apiFetch('/api/reimbursements?limit=500&all=1').then(function (d) { return (d && d.claims) ? d.claims : []; });
        } else {
            p = apiFetch('/api/approvals?type=' + currentTab).then(function (d) { return (d && d.approvals) ? d.approvals : []; });
        }
        p.then(function (items) {
            allItems = items;
            // Auto-expand current month on first load
            var curMonth = new Date().toISOString().slice(0, 7);
            expandedMonths.add(curMonth);
            setLoading(false);
            renderItems();
        }).catch(function () {
            setLoading(false);
            renderItems();
        });
    }

    // ── Filter + month grouping ─────────────────────────────────────────────
    function filterItems() {
        if (currentFilter === 'all') return allItems;
        return allItems.filter(function (it) { return it.status === currentFilter; });
    }

    function getMonthKey(item) {
        var d = item.submitted_at || item.created_at || item.from_date || '';
        return d ? d.slice(0, 7) : 'unknown';
    }

    function groupByMonth(items) {
        var groups = {};
        items.forEach(function (it) {
            var mk = getMonthKey(it);
            if (!groups[mk]) groups[mk] = [];
            groups[mk].push(it);
        });
        // Sort months descending
        var sorted = Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); });
        return sorted.map(function (mk) { return { monthKey: mk, items: groups[mk] }; });
    }

    function formatMonthLabel(mk) {
        if (mk === 'unknown') return 'Unknown Date';
        var parts = mk.split('-');
        var y = parseInt(parts[0]), m = parseInt(parts[1]) - 1;
        return MONTH_NAMES[m] + ' ' + y;
    }

    // ── Render ──────────────────────────────────────────────────────────────
    function renderItems() {
        var body = document.getElementById('apprBody');
        if (!body) return;
        var filtered = filterItems();
        var groups   = groupByMonth(filtered);

        if (!groups.length) {
            body.innerHTML = '<div class="appr-empty"><i class="fas fa-check-double"></i><p>No items to show.</p></div>';
            return;
        }

        body.innerHTML = groups.map(function (g) {
            var pendingCnt = g.items.filter(function (it) { return it.status === 'pending'; }).length;
            var isExpanded = expandedMonths.has(g.monthKey);
            var badgeCls   = pendingCnt > 0 ? '' : ' all-done';
            var badgeTxt   = pendingCnt > 0 ? pendingCnt + ' pending' : 'All reviewed';
            return '<div class="appr-month-group' + (isExpanded ? ' expanded' : '') + '" data-month="' + g.monthKey + '">'
                + '<div class="appr-month-header">'
                +   '<i class="fas fa-chevron-right appr-month-chevron"></i>'
                +   '<span class="appr-month-label">' + formatMonthLabel(g.monthKey) + '</span>'
                +   '<span class="appr-month-badge' + badgeCls + '">' + badgeTxt + '</span>'
                + '</div>'
                + '<div class="appr-month-items">'
                +   g.items.map(renderCard).join('')
                + '</div>'
                + '</div>';
        }).join('');

        // Bind month toggle
        body.querySelectorAll('.appr-month-header').forEach(function (hdr) {
            hdr.addEventListener('click', function () {
                var grp = hdr.closest('.appr-month-group');
                var mk  = grp.dataset.month;
                if (expandedMonths.has(mk)) { expandedMonths.delete(mk); grp.classList.remove('expanded'); }
                else { expandedMonths.add(mk); grp.classList.add('expanded'); }
            });
        });

        // Bind action buttons
        body.querySelectorAll('.appr-approve-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { openReviewModal(btn.dataset.id, btn.dataset.type, btn.dataset.title, 'approve'); });
        });
        body.querySelectorAll('.appr-reject-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { openReviewModal(btn.dataset.id, btn.dataset.type, btn.dataset.title, 'reject'); });
        });
    }

    function renderCard(item) {
        var type   = currentTab;
        var id     = item.id;
        var status = item.status || 'pending';
        var title  = getTitle(item);
        var meta   = getMeta(item);
        var dets   = getDetails(item);
        var isPend = status === 'pending';

        var iconMap = { leave: 'fa-calendar-minus', reimbursement: 'fa-receipt', employee: 'fa-user-plus', task: 'fa-tasks', project: 'fa-layer-group' };

        var commentHtml = '';
        var commentKey  = item.approver_comments || item.comment || '';
        if (commentKey) {
            commentHtml = '<div class="appr-comment-box ' + status + '">'
                + '<b>' + (status === 'approved' ? 'Approval note' : 'Rejection reason') + ':</b> ' + escHtml(commentKey)
                + (item.reviewed_by_name ? ' — <em>' + escHtml(item.reviewed_by_name) + '</em>' : '')
                + '</div>';
        }

        var actionsHtml = '';
        if (isPend) {
            actionsHtml = '<div class="appr-item-actions">'
                + '<button class="appr-approve-btn" data-id="' + id + '" data-type="' + type + '" data-title="' + escAttr(title) + '"><i class="fas fa-check"></i> Approve</button>'
                + '<button class="appr-reject-btn"  data-id="' + id + '" data-type="' + type + '" data-title="' + escAttr(title) + '"><i class="fas fa-times"></i> Reject</button>'
                + '</div>';
        } else {
            actionsHtml = '<span class="appr-status ' + status + '">'
                + (status === 'approved' ? '<i class="fas fa-check-circle"></i> Approved' : '<i class="fas fa-times-circle"></i> Rejected')
                + (item.reviewed_at ? ' · ' + formatDate(item.reviewed_at) : '')
                + '</span>';
        }

        return '<div class="appr-item">'
            + '<div class="appr-item-icon ' + type + '"><i class="fas ' + iconMap[type] + '"></i></div>'
            + '<div class="appr-item-body">'
            +   '<div class="appr-item-title">' + escHtml(title) + '</div>'
            +   '<div class="appr-item-meta">' + meta + '</div>'
            +   (dets ? '<div class="appr-item-details">' + dets + '</div>' : '')
            +   commentHtml
            +   actionsHtml
            + '</div>'
            + '</div>';
    }

    // ── Per-type title/meta/details helpers ─────────────────────────────────
    function getTitle(item) {
        if (currentTab === 'leave')         return (item.employee_name || 'Employee') + ' — ' + (item.type || '') + ' Leave';
        if (currentTab === 'reimbursement') return (item.employee_name || 'Employee') + ' — ' + (item.category || 'Reimbursement');
        return item.title || 'Approval Request';
    }

    function getMeta(item) {
        var parts = [];
        if (currentTab === 'leave') {
            parts.push('<span><i class="fas fa-calendar"></i> ' + fmtDate(item.from_date) + ' – ' + fmtDate(item.to_date) + '</span>');
            parts.push('<span><i class="fas fa-sun"></i> ' + item.no_days + ' day(s)</span>');
            if (item.created_at) parts.push('<span><i class="fas fa-clock"></i> Applied ' + formatDate(item.created_at) + '</span>');
        } else if (currentTab === 'reimbursement') {
            parts.push('<span><i class="fas fa-rupee-sign"></i> ₹' + Number(item.amount || 0).toLocaleString('en-IN') + '</span>');
            parts.push('<span><i class="fas fa-calendar"></i> ' + fmtDate(item.expense_date) + '</span>');
            if (item.created_at) parts.push('<span><i class="fas fa-clock"></i> Submitted ' + formatDate(item.created_at) + '</span>');
        } else {
            if (item.submitted_by_name) parts.push('<span><i class="fas fa-user"></i> ' + escHtml(item.submitted_by_name) + '</span>');
            if (item.submitted_at) parts.push('<span><i class="fas fa-clock"></i> ' + formatDate(item.submitted_at) + '</span>');
        }
        return parts.join('');
    }

    function getDetails(item) {
        var parts = [];
        if (currentTab === 'leave') {
            if (item.reason) parts.push('<span><b>Reason:</b> ' + escHtml(item.reason) + '</span>');
            if (item.next_joining_date) parts.push('<span><b>Rejoining:</b> ' + fmtDate(item.next_joining_date) + '</span>');
        } else if (currentTab === 'reimbursement') {
            parts.push('<span><b>Description:</b> ' + escHtml(item.description || '') + '</span>');
            if (item.project) parts.push('<span><b>Project:</b> ' + escHtml(item.project) + '</span>');
            if (item.file_path) {
                parts.push('<span><a href="' + escHtml(item.file_path) + '" target="_blank" class="appr-view-bill-btn"><i class="fas fa-file-alt"></i> View Bill</a></span>');
            } else if (item.file_name) {
                parts.push('<span><i class="fas fa-paperclip"></i> ' + escHtml(item.file_name) + '</span>');
            }
        } else if (currentTab === 'employee' && item.details) {
            var d = item.details;
            parts.push('<span><b>Role:</b> ' + escHtml(d.role || '') + '</span>');
            parts.push('<span><b>Designation:</b> ' + escHtml(d.designation || '') + '</span>');
            if (d.salary) parts.push('<span><b>Salary:</b> ₹' + Number(d.salary).toLocaleString('en-IN') + '/mo</span>');
            parts.push('<span><b>Email (planned):</b> ' + escHtml(d.officeEmail || '') + '</span>');
            parts.push('<span><b>Joining:</b> ' + fmtDate(d.dateOfJoining) + '</span>');
        } else if (currentTab === 'task' && item.details) {
            var td = item.details;
            if (td.assignee_name) parts.push('<span><b>Assignee:</b> ' + escHtml(td.assignee_name) + '</span>');
            if (td.project)       parts.push('<span><b>Project:</b> '  + escHtml(td.project) + '</span>');
            if (td.due_date)      parts.push('<span><b>Due:</b> '       + fmtDate(td.due_date) + '</span>');
            if (td.priority)      parts.push('<span><b>Priority:</b> '  + escHtml(td.priority) + '</span>');
            if (td.description)   parts.push('<span><b>Notes:</b> '     + escHtml(td.description) + '</span>');
        } else if (currentTab === 'project' && item.details) {
            var pd = item.details;
            parts.push('<span><b>Project:</b> ' + escHtml(pd.project_name || '') + ' (' + escHtml(pd.project_code || '') + ')</span>');
            parts.push('<span><b>Current Phase:</b> ' + capitalize(pd.current_phase || '') + '</span>');
            parts.push('<span><b>Requested Phase:</b> ' + capitalize(pd.requested_phase || '') + '</span>');
        }
        return parts.join('');
    }

    // ── Review modal ─────────────────────────────────────────────────────────
    function openReviewModal(id, type, title, action) {
        reviewTarget = { id: parseInt(id), type: type, action: action, title: title };
        var modal  = document.getElementById('apprReviewModal');
        var mtitle = document.getElementById('apprModalTitle');
        var msub   = document.getElementById('apprModalSubtitle');
        var mconf  = document.getElementById('apprModalConfirm');
        var mnote  = document.getElementById('apprModalNote');
        var mcomm  = document.getElementById('apprModalComment');

        if (!modal) return;
        mtitle.textContent = action === 'approve' ? 'Approve Request' : 'Reject Request';
        msub.textContent   = title;
        mconf.textContent  = action === 'approve' ? 'Approve' : 'Reject';
        mconf.className    = 'appr-modal-confirm ' + action;
        mnote.textContent  = action === 'reject' ? '* Comment is required when rejecting.' : 'Comment is optional.';
        mcomm.value = '';
        modal.classList.add('active');
        mcomm.focus();
    }

    function closeReviewModal() {
        var modal = document.getElementById('apprReviewModal');
        if (modal) modal.classList.remove('active');
        reviewTarget = null;
    }

    function submitReview() {
        if (!reviewTarget) return;
        var comment = (document.getElementById('apprModalComment').value || '').trim();
        if (reviewTarget.action === 'reject' && !comment) {
            showToast('Please enter a reason for rejection.', 'error'); return;
        }

        var mconf = document.getElementById('apprModalConfirm');
        mconf.disabled = true;
        mconf.textContent = 'Processing…';

        var isLeave = reviewTarget.type === 'leave';
        var isReim  = reviewTarget.type === 'reimbursement';
        var url, body;

        if (isLeave) {
            url  = '/api/leaves/' + reviewTarget.id;
            body = JSON.stringify({ status: reviewTarget.action === 'approve' ? 'approved' : 'rejected', approver_comments: comment });
        } else if (isReim) {
            url  = '/api/reimbursements/' + reviewTarget.id;
            body = JSON.stringify({ status: reviewTarget.action === 'approve' ? 'approved' : 'rejected', approver_comments: comment });
        } else {
            url  = '/api/approvals/' + reviewTarget.id;
            body = JSON.stringify({ status: reviewTarget.action === 'approve' ? 'approved' : 'rejected', comment: comment });
        }

        apiFetch(url, { method: 'PATCH', body: body }).then(function (data) {
            mconf.disabled = false;
            if (data && data.success) {
                closeReviewModal();
                // Show employee credentials if newly approved
                if (data.userId) {
                    showCredentials(data);
                } else {
                    showToast(reviewTarget.action === 'approve' ? 'Approved successfully.' : 'Rejected.', 'success');
                }
                fetchBadge();
                loadCurrentTab();
            } else {
                mconf.textContent = reviewTarget.action === 'approve' ? 'Approve' : 'Reject';
                showToast((data && data.error) || 'Action failed.', 'error');
            }
        }).catch(function () {
            mconf.disabled = false;
            mconf.textContent = reviewTarget.action === 'approve' ? 'Approve' : 'Reject';
            showToast('Network error.', 'error');
        });
    }

    function showCredentials(data) {
        var modal   = document.getElementById('apprCredModal');
        if (!modal) return;
        document.getElementById('apprCredUserId').textContent    = data.userId || '';
        document.getElementById('apprCredEmail').textContent     = data.officeEmail || '';
        document.getElementById('apprCredPassword').textContent  = data.tempPassword || '';
        modal.classList.add('active');
    }

    // ── Bind events ──────────────────────────────────────────────────────────
    function bindEvents() {
        // Filter buttons
        document.querySelectorAll('.appr-filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                currentFilter = btn.dataset.filter;
                document.querySelectorAll('.appr-filter-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                renderItems();
            });
        });

        // Review modal cancel
        var cancelBtn = document.getElementById('apprModalCancel');
        if (cancelBtn) cancelBtn.addEventListener('click', closeReviewModal);

        // Review modal confirm
        var confirmBtn = document.getElementById('apprModalConfirm');
        if (confirmBtn) confirmBtn.addEventListener('click', submitReview);

        // Close on overlay click
        var overlay = document.getElementById('apprReviewModal');
        if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeReviewModal(); });

        // Credentials modal close
        var credClose = document.getElementById('apprCredClose');
        if (credClose) credClose.addEventListener('click', function () {
            document.getElementById('apprCredModal').classList.remove('active');
        });

        // Tab bar will be rendered by renderTabBar()
    }

    // ── Utilities ────────────────────────────────────────────────────────────
    function setLoading(on) {
        var body = document.getElementById('apprBody');
        if (body && on) body.innerHTML = '<div class="appr-empty"><i class="fas fa-spinner fa-spin"></i><p>Loading…</p></div>';
    }

    function formatDate(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function fmtDate(str) {
        if (!str) return '—';
        var parts = str.slice(0, 10).split('-');
        if (parts.length < 3) return str;
        return parts[2] + ' ' + MONTH_NAMES[parseInt(parts[1]) - 1].slice(0, 3) + ' ' + parts[0];
    }
    function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
    function escHtml(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

    var toastTimer = null;
    function showToast(msg, type) {
        var t = document.querySelector('.appr-toast');
        if (t) t.remove();
        t = document.createElement('div');
        t.className = 'tt-toast ' + (type || 'success');
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('show'); });
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2800);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return { init: init, destroy: destroy, fetchBadge: fetchBadge };
})();
