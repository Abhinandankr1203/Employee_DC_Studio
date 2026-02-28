// ===== DC PROJECTS MODULE =====
const DCProjects = (function () {
    'use strict';

    const PHASES = [
        { key: 'concept',      label: 'Concept',      icon: 'fa-lightbulb' },
        { key: 'design',       label: 'Design',       icon: 'fa-drafting-compass' },
        { key: 'approval',     label: 'Approval',     icon: 'fa-stamp' },
        { key: 'construction', label: 'Construction', icon: 'fa-hard-hat' },
        { key: 'handover',     label: 'Handover',     icon: 'fa-key' }
    ];

    let allProjects = [];
    let allMembers  = [];
    let currentFilter = 'all';
    let detailProjectId = null;
    let toastTimer = null;
    let editingId = null;

    // ── Auth fetch ──────────────────────────────────────────
    function apiFetch(path, opts) {
        const token = localStorage.getItem('dc_token');
        const headers = Object.assign({ 'Authorization': token ? 'Bearer ' + token : '' }, (opts && opts.headers) || {});
        return fetch(path, Object.assign({}, opts, { headers }))
            .then(function (r) {
                if (r.status === 401) { window.location.reload(); return null; }
                return r.json();
            })
            .catch(function () { return null; });
    }

    // ── Init / Destroy ──────────────────────────────────────
    function init() {
        bindEvents();
        loadAll();
    }
    function destroy() { detailProjectId = null; }

    function bindEvents() {
        var newBtn       = document.getElementById('prNewBtn');
        var detailClose  = document.getElementById('prDetailClose');
        var formClose    = document.getElementById('prFormClose');
        var formCancel   = document.getElementById('prFormCancel');
        var projectForm  = document.getElementById('prForm');
        var advanceBtn   = document.getElementById('prAdvanceBtn');
        var deleteBtn    = document.getElementById('prDeleteBtn');
        var filterBtns   = document.querySelectorAll('.pr-filter-btn');
        var backBtn      = document.getElementById('prBackBtn');

        if (newBtn)      newBtn.addEventListener('click', openNewForm);
        if (detailClose) detailClose.addEventListener('click', closeDetail);
        if (formClose)   formClose.addEventListener('click', closeForm);
        if (formCancel)  formCancel.addEventListener('click', closeForm);
        if (projectForm) projectForm.addEventListener('submit', handleSubmit);
        if (advanceBtn)  advanceBtn.addEventListener('click', handleAdvancePhase);
        if (deleteBtn)   deleteBtn.addEventListener('click', handleDelete);
        if (backBtn) {
            backBtn.addEventListener('click', function () {
                var pt = document.getElementById('projectTrackerPage');
                var db = document.getElementById('dashboardPage');
                if (pt && db) { pt.classList.remove('active'); db.classList.add('active'); }
            });
        }

        filterBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                filterBtns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderCards();
            });
        });

        // Close modals on overlay click
        var detailOverlay = document.getElementById('prDetailOverlay');
        var formOverlay   = document.getElementById('prFormOverlay');
        if (detailOverlay) detailOverlay.addEventListener('click', function (e) { if (e.target === detailOverlay) closeDetail(); });
        if (formOverlay)   formOverlay.addEventListener('click', function (e)   { if (e.target === formOverlay) closeForm(); });
    }

    // ── Data loading ────────────────────────────────────────
    function loadAll() {
        Promise.all([apiFetch('/api/projects'), apiFetch('/api/team')])
            .then(function (results) {
                allProjects = (results[0] && results[0].projects) ? results[0].projects : [];
                allMembers  = (results[1] && results[1].members)  ? results[1].members  : [];
                renderCards();
                populateMemberChecks();
            });
    }

    // ── Render cards ────────────────────────────────────────
    function renderCards() {
        var grid = document.getElementById('prGrid');
        if (!grid) return;

        var filtered = allProjects;
        if (currentFilter !== 'all') filtered = allProjects.filter(function (p) { return p.status === currentFilter; });

        if (!filtered.length) {
            grid.innerHTML = '<div class="pr-empty"><i class="fas fa-layer-group"></i><p>No projects found.</p></div>';
            return;
        }

        grid.innerHTML = filtered.map(function (p) {
            return buildCard(p);
        }).join('');

        grid.querySelectorAll('.pr-card').forEach(function (card) {
            card.addEventListener('click', function () {
                openDetail(parseInt(card.dataset.id));
            });
        });
    }

    function buildCard(p) {
        var phaseSteps = PHASES.map(function (ph) {
            var isDone    = p.phases_done && p.phases_done.indexOf(ph.key) !== -1;
            var isCurrent = p.current_phase === ph.key;
            var cls = isDone ? 'done' : isCurrent ? 'current' : '';
            var icon = isDone ? 'fa-check' : ph.icon;
            return '<div class="pr-step ' + cls + '" data-step="' + ph.key + '">'
                + '<div class="pr-step-line"></div>'
                + '<div class="pr-step-dot"><i class="fas ' + icon + '"></i></div>'
                + '<div class="pr-step-name">' + ph.label + '</div>'
                + '</div>';
        }).join('');

        var avatars = (p.team_member_ids || []).slice(0, 3).map(function (mid) {
            var m = allMembers.find(function (m) { return m.id === mid; });
            var initials = m ? getInitials(m.name) : '?';
            return '<div class="pr-avatar">' + escHtml(initials) + '</div>';
        }).join('');
        if ((p.team_member_ids || []).length > 3) {
            avatars += '<div class="pr-avatar pr-avatar-more">+' + (p.team_member_ids.length - 3) + '</div>';
        }

        var dueDate = p.end_date ? formatDateShort(p.end_date) : '—';
        var statusCls = 'pr-status-' + (p.status || 'active');
        var areaStr = p.area_sqft ? Number(p.area_sqft).toLocaleString('en-IN') + ' sq ft' : '';

        return '<div class="pr-card" data-id="' + p.id + '" data-phase="' + escHtml(p.current_phase) + '">'
            + '<div class="pr-card-head">'
            +   '<div>'
            +     '<div class="pr-card-code">' + escHtml(p.code || '') + '</div>'
            +     '<div class="pr-card-name">' + escHtml(p.name) + '</div>'
            +     '<div class="pr-card-client"><i class="fas fa-user" style="font-size:11px;margin-right:4px;"></i>' + escHtml(p.client) + '</div>'
            +   '</div>'
            +   '<span class="pr-status-badge ' + statusCls + '">' + capitalize(p.status || 'active') + '</span>'
            + '</div>'
            + '<div class="pr-card-info">'
            +   '<span><i class="fas fa-map-marker-alt"></i>' + escHtml(p.location || '—') + '</span>'
            +   (areaStr ? '<span><i class="fas fa-ruler-combined"></i>' + escHtml(areaStr) + '</span>' : '')
            + '</div>'
            + '<div class="pr-phase-strip">'
            +   '<div class="pr-phase-label">Project Phase</div>'
            +   '<div class="pr-phase-steps">' + phaseSteps + '</div>'
            + '</div>'
            + '<div class="pr-card-foot">'
            +   '<div class="pr-avatars">' + avatars + '</div>'
            +   '<div class="pr-card-due"><i class="fas fa-calendar-alt" style="margin-right:4px;color:#9ca3af;"></i>Due <span>' + dueDate + '</span></div>'
            + '</div>'
            + '</div>';
    }

    // ── Detail modal ────────────────────────────────────────
    function openDetail(id) {
        var p = allProjects.find(function (pr) { return pr.id === id; });
        if (!p) return;
        detailProjectId = id;

        // Header
        document.getElementById('prDetailCode').textContent   = p.code || '';
        document.getElementById('prDetailTitle').textContent  = p.name;
        document.getElementById('prDetailClient').textContent = p.client + (p.client_phone ? '  ·  ' + p.client_phone : '');

        // Phase stepper
        renderDetailPhases(p);

        // Info
        document.getElementById('prDetailLocation').textContent = p.location || '—';
        document.getElementById('prDetailArea').textContent     = p.area_sqft ? Number(p.area_sqft).toLocaleString('en-IN') + ' sq ft' : '—';
        document.getElementById('prDetailStart').textContent    = p.start_date ? formatDateLong(p.start_date) : '—';
        document.getElementById('prDetailEnd').textContent      = p.end_date   ? formatDateLong(p.end_date)   : '—';
        document.getElementById('prDetailDesc').textContent     = p.description || '—';
        document.getElementById('prDetailEmail').textContent    = p.client_email || '—';

        // Team
        var teamList = document.getElementById('prDetailTeam');
        teamList.innerHTML = (p.team_member_ids || []).map(function (mid) {
            var m = allMembers.find(function (x) { return x.id === mid; });
            if (!m) return '';
            return '<div class="pr-team-item">'
                + '<div class="pr-team-avatar">' + escHtml(getInitials(m.name)) + '</div>'
                + '<div><div class="pr-team-name">' + escHtml(m.name) + '</div>'
                +      '<div class="pr-team-role">' + escHtml(m.designation) + '</div></div>'
                + '</div>';
        }).join('') || '<span style="color:#9ca3af;font-size:13px;">No members assigned.</span>';

        // Tasks linked to this project
        loadProjectTasks(p.name, p.code);

        document.getElementById('prDetailOverlay').classList.add('open');
    }

    function closeDetail() {
        document.getElementById('prDetailOverlay').classList.remove('open');
        detailProjectId = null;
    }

    function renderDetailPhases(p) {
        var container = document.getElementById('prModalSteps');
        if (!container) return;
        container.innerHTML = PHASES.map(function (ph) {
            var isDone    = p.phases_done && p.phases_done.indexOf(ph.key) !== -1;
            var isCurrent = p.current_phase === ph.key;
            var cls = isDone ? 'done' : isCurrent ? 'current' : '';
            var icon = isDone ? 'fa-check' : ph.icon;
            var checkText = isDone ? 'Done' : isCurrent ? 'In Progress' : '';
            return '<div class="pr-modal-step ' + cls + '" data-step="' + ph.key + '">'
                + '<div class="pr-modal-step-line"></div>'
                + '<div class="pr-modal-step-icon"><i class="fas ' + icon + '"></i></div>'
                + '<div class="pr-modal-step-name">' + ph.label + '</div>'
                + '<div class="pr-modal-step-check">' + checkText + '</div>'
                + '</div>';
        }).join('');

        var advBtn = document.getElementById('prAdvanceBtn');
        var phaseIdx = PHASES.findIndex(function (ph) { return ph.key === p.current_phase; });
        if (advBtn) {
            var isLast = phaseIdx === PHASES.length - 1;
            advBtn.disabled = isLast;
            advBtn.innerHTML = isLast
                ? '<i class="fas fa-check-circle"></i> All phases complete'
                : '<i class="fas fa-arrow-right"></i> Advance to ' + PHASES[phaseIdx + 1].label;
        }
    }

    function handleAdvancePhase() {
        if (!detailProjectId) return;
        var p = allProjects.find(function (pr) { return pr.id === detailProjectId; });
        if (!p) return;
        var phaseIdx = PHASES.findIndex(function (ph) { return ph.key === p.current_phase; });
        if (phaseIdx === PHASES.length - 1) return;

        var nextPhase = PHASES[phaseIdx + 1].key;
        apiFetch('/api/projects/' + detailProjectId + '/phase', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phase: nextPhase })
        }).then(function (data) {
            if (data && data.success) {
                // Update local state
                if (!p.phases_done) p.phases_done = [];
                p.phases_done.push(p.current_phase);
                p.current_phase = nextPhase;
                renderDetailPhases(p);
                renderCards();
                showToast('Phase advanced to ' + capitalize(nextPhase) + '!', 'success');
            } else {
                showToast((data && data.error) || 'Failed to advance phase.', 'error');
            }
        });
    }

    function loadProjectTasks(projectName, projectCode) {
        var container = document.getElementById('prDetailTasks');
        if (!container) return;
        container.innerHTML = '<span style="color:#9ca3af;font-size:13px;">Loading tasks…</span>';

        apiFetch('/api/tasks?project=' + encodeURIComponent(projectCode || projectName)).then(function (data) {
            var tasks = (data && data.tasks) ? data.tasks : [];
            if (!tasks.length) {
                container.innerHTML = '<span style="color:#9ca3af;font-size:13px;">No tasks linked to this project.</span>';
                return;
            }
            container.innerHTML = tasks.map(function (t) {
                return '<div class="pr-task-item ' + escHtml(t.priority) + '">'
                    + '<div class="pr-task-title">' + escHtml(t.title) + '</div>'
                    + '<div class="pr-task-meta">'
                    +   escHtml(t.assignee_name || '—')
                    +   (t.due_date ? ' · Due ' + formatDateShort(t.due_date) : '')
                    +   ' · <span style="text-transform:capitalize;">' + escHtml(t.status) + '</span>'
                    + '</div>'
                    + '</div>';
            }).join('');
        });
    }

    function handleDelete() {
        if (!detailProjectId) return;
        if (!confirm('Delete this project? This cannot be undone.')) return;
        apiFetch('/api/projects/' + detailProjectId, { method: 'DELETE' })
            .then(function (data) {
                if (data && data.success) {
                    allProjects = allProjects.filter(function (p) { return p.id !== detailProjectId; });
                    closeDetail();
                    renderCards();
                    showToast('Project deleted.', 'success');
                } else {
                    showToast((data && data.error) || 'Delete failed.', 'error');
                }
            });
    }

    // ── New / Edit form ─────────────────────────────────────
    function populateMemberChecks() {
        var container = document.getElementById('prMemberChecks');
        if (!container) return;
        container.innerHTML = allMembers.map(function (m) {
            return '<label class="pr-member-check">'
                + '<input type="checkbox" name="member_ids" value="' + m.id + '">'
                + escHtml(m.name) + ' — ' + escHtml(m.designation)
                + '</label>';
        }).join('');
    }

    function openNewForm() {
        editingId = null;
        document.getElementById('prFormTitle').textContent = 'New Project';
        document.getElementById('prForm').reset();
        // uncheck all members
        document.querySelectorAll('#prMemberChecks input').forEach(function (cb) { cb.checked = false; });
        document.getElementById('prFormOverlay').classList.add('open');
    }

    function closeForm() {
        document.getElementById('prFormOverlay').classList.remove('open');
        editingId = null;
    }

    function handleSubmit(e) {
        e.preventDefault();
        var form = e.target;
        var memberIds = Array.from(form.querySelectorAll('input[name="member_ids"]:checked'))
            .map(function (cb) { return parseInt(cb.value); });

        var payload = {
            name:          form.elements['prName'].value.trim(),
            client:        form.elements['prClient'].value.trim(),
            client_email:  form.elements['prClientEmail'].value.trim(),
            client_phone:  form.elements['prClientPhone'].value.trim(),
            location:      form.elements['prLocation'].value.trim(),
            area_sqft:     parseFloat(form.elements['prArea'].value) || 0,
            description:   form.elements['prDesc'].value.trim(),
            start_date:    form.elements['prStartDate'].value,
            end_date:      form.elements['prEndDate'].value,
            current_phase: form.elements['prPhase'].value,
            status:        form.elements['prStatus'].value,
            team_member_ids: memberIds
        };

        var url    = editingId ? '/api/projects/' + editingId : '/api/projects';
        var method = editingId ? 'PUT' : 'POST';
        var btn    = form.querySelector('.pr-form-submit');
        btn.disabled = true; btn.textContent = 'Saving…';

        apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (data) {
            btn.disabled = false; btn.textContent = editingId ? 'Save Changes' : 'Create Project';
            if (data && (data.success || data.project)) {
                if (editingId) {
                    var idx = allProjects.findIndex(function (p) { return p.id === editingId; });
                    if (idx !== -1) allProjects[idx] = data.project;
                } else {
                    allProjects.push(data.project);
                }
                closeForm();
                renderCards();
                showToast(editingId ? 'Project updated!' : 'Project created!', 'success');
            } else {
                showToast((data && data.error) || 'Failed to save project.', 'error');
            }
        });
    }

    // ── Utilities ────────────────────────────────────────────
    function getInitials(name) {
        return (name || '').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    }
    function escHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
    function formatDateShort(d) {
        if (!d) return '—';
        var p = d.split('-');
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[parseInt(p[1]) - 1] + ' ' + p[0];
    }
    function formatDateLong(d) {
        if (!d) return '—';
        var p = d.split('-');
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return parseInt(p[2]) + ' ' + months[parseInt(p[1]) - 1] + ' ' + p[0];
    }
    function showToast(msg, type) {
        var t = document.getElementById('prToast');
        if (!t) return;
        t.textContent = msg;
        t.className = 'sal-toast ' + type + ' show';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3000);
    }

    return { init: init, destroy: destroy };
})();
