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
    let paymentTerms = [];

    // ── Admin helper ────────────────────────────────────────
    function isAdminUser() {
        return localStorage.getItem('dc_role') === 'admin';
    }

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
        // Hide admin-only UI elements from employees
        var newBtn = document.getElementById('prNewBtn');
        if (!isAdminUser()) {
            if (newBtn) newBtn.style.display = 'none';
        } else {
            if (newBtn) newBtn.style.display = '';
        }
        // pdDeleteBtn visibility is handled via CSS .admin class on prDetailView
    }
    function destroy() { detailProjectId = null; }

    function bindEvents() {
        var newBtn       = document.getElementById('prNewBtn');
        var detailClose  = document.getElementById('pdDetailBackBtn');
        var formClose    = document.getElementById('prFormClose');
        var formCancel   = document.getElementById('prFormCancel');
        var projectForm  = document.getElementById('prForm');
        var advanceBtn   = document.getElementById('pdAdvanceBtn');
        var deleteBtn    = document.getElementById('pdDeleteBtn');
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
                if (pt && db) {
                    pt.classList.remove('active');
                    db.classList.add('active');
                    if (typeof DCNotifications !== 'undefined') DCNotifications.check();
                }
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
        var formOverlay      = document.getElementById('prFormOverlay');
        var addMemberOverlay = document.getElementById('prAddMemberOverlay');
        var assignTaskOverlay = document.getElementById('prAssignTaskOverlay');
        if (formOverlay)      formOverlay.addEventListener('click', function (e)      { if (e.target === formOverlay)      closeForm(); });
        if (addMemberOverlay) addMemberOverlay.addEventListener('click', function (e) { if (e.target === addMemberOverlay) closeAddMemberModal(); });
        if (assignTaskOverlay) assignTaskOverlay.addEventListener('click', function (e) { if (e.target === assignTaskOverlay) closeAssignTaskModal(); });

        // Add member modal
        document.getElementById('prAddMemberBtn').addEventListener('click', openAddMemberModal);
        document.getElementById('prAddMemberClose').addEventListener('click', closeAddMemberModal);

        // Assign task modal
        document.getElementById('prAssignTaskBtn').addEventListener('click', openAssignTaskModal);
        document.getElementById('prAssignTaskClose').addEventListener('click', closeAssignTaskModal);
        document.getElementById('prAssignTaskCancel').addEventListener('click', closeAssignTaskModal);
        document.getElementById('prAssignTaskForm').addEventListener('submit', submitAssignTask);

        // Admin auto-calc: expected duration from start/end dates
        var startDateEl = document.getElementById('prStartDate');
        var endDateEl   = document.getElementById('prEndDate');
        if (startDateEl) startDateEl.addEventListener('change', calcExpectedDuration);
        if (endDateEl)   endDateEl.addEventListener('change', calcExpectedDuration);

        // Admin auto-calc: retention due date
        var handoverEl  = document.getElementById('prHandoverDate');
        var retPeriodEl = document.getElementById('prRetentionPeriod');
        var retUnitEl   = document.getElementById('prRetentionPeriodUnit');
        if (handoverEl)  handoverEl.addEventListener('change', calcRetentionDueDate);
        if (retPeriodEl) retPeriodEl.addEventListener('change', calcRetentionDueDate);
        if (retUnitEl)   retUnitEl.addEventListener('change', calcRetentionDueDate);

        // Admin: project value change → update payment totals
        var projValEl = document.getElementById('prProjectValue');
        if (projValEl) projValEl.addEventListener('input', updatePaymentTotals);

        // Admin: add payment term row
        var ptAddBtn = document.getElementById('prPtAddBtn');
        if (ptAddBtn) ptAddBtn.addEventListener('click', addPaymentTermRow);

        // Accordion step heads
        document.querySelectorAll('.pr-step-head[data-step]').forEach(function (head) {
            head.addEventListener('click', function () {
                var section = head.closest('.pr-step-section');
                if (section) section.classList.toggle('open');
            });
        });

        // GSTIN search button
        var searchBtn = document.getElementById('prSearchCustomerBtn');
        if (searchBtn) searchBtn.addEventListener('click', handleCustomerSearch);

        // Search-by radio toggle
        document.querySelectorAll('input[name="prSearchBy"]').forEach(function (r) {
            r.addEventListener('change', function () {
                var gstinLabel = document.querySelector('label[for="prGSTINInput"], .pr-customer-search-box .pr-form-label');
                var hint = document.getElementById('prGSTINHint');
                if (r.value === 'name') {
                    document.getElementById('prGSTINInput').placeholder = 'Enter customer name to search';
                    if (hint) hint.textContent = 'Enter customer name to search existing records';
                } else {
                    document.getElementById('prGSTINInput').placeholder = 'Customer Name';
                    if (hint) hint.textContent = 'Enter GSTIN to search or add new customer';
                }
            });
        });

        // Add client contact button (Step 5)
        var addClientBtn = document.getElementById('prAddClientContactBtn');
        if (addClientBtn) addClientBtn.addEventListener('click', function () { addClientContactRow(); });
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

        var adminActions = isAdminUser()
            ? '<div class="pr-card-actions">'
            +   '<button class="pr-action-btn pr-view-btn" title="View" onclick="event.stopPropagation();DCProjects.openDetail(' + p.id + ')"><i class="fas fa-eye"></i></button>'
            +   '<button class="pr-action-btn pr-edit-btn" title="Edit" onclick="event.stopPropagation();DCProjects.openEditForm(' + p.id + ')"><i class="fas fa-pen"></i></button>'
            +   '<button class="pr-action-btn pr-delete-btn" title="Delete" onclick="event.stopPropagation();DCProjects.deleteProjectById(' + p.id + ')"><i class="fas fa-trash"></i></button>'
            + '</div>'
            : '';

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
            + adminActions
            + '</div>';
    }

    // ── Detail view ──────────────────────────────────────────
    function openDetail(id) {
        var p = allProjects.find(function (pr) { return pr.id === id; });
        if (!p) return;
        detailProjectId = id;

        var admin = isAdminUser();
        var dv = document.getElementById('prDetailView');
        if (!dv) return;

        // Toggle admin class for showing/hiding admin rows and cards
        if (admin) { dv.classList.add('admin'); } else { dv.classList.remove('admin'); }

        // Header
        var codeEl = document.getElementById('pdCode');
        var nameEl = document.getElementById('pdProjectName');
        if (codeEl) codeEl.textContent = p.code || '';
        if (nameEl) nameEl.textContent = p.name || '';

        // Edit button wires to openEditForm
        var editBtn = document.getElementById('pdEditBtn');
        if (editBtn) {
            editBtn.onclick = function () { openEditForm(id); };
        }
        // Delete button (admin only, visibility handled by CSS .admin class)
        var delBtn = document.getElementById('pdDeleteBtn');
        if (delBtn) {
            delBtn.onclick = function () { handleDelete(); };
        }

        // Customer info
        setText('pdClientName',    p.client);
        setText('pdGSTN',          p.customer_gstin);
        setText('pdBillingAddress',p.billing_address);
        setText('pdLocation',      p.location);
        setText('pdArea',          p.area_sqft ? Number(p.area_sqft).toLocaleString('en-IN') + ' sq ft' : '—');
        setText('pdClientEmail',   p.client_email);
        setText('pdClientPhone',   p.client_phone);
        setText('pdContactPerson', p.contact_person);
        setText('pdContactMobile', p.contact_mobile);
        setText('pdContactPhone',  p.contact_phone);
        setText('pdContactEmail',  p.contact_email);

        // Client contacts panel (multiple)
        var ccList     = document.getElementById('pdClientContactsList');
        var ccBody     = document.getElementById('pdClientContactsBody');
        var ccArr      = Array.isArray(p.client_contacts) ? p.client_contacts.filter(function (c) { return c.name || c.email; }) : [];
        if (ccList) ccList.style.display = ccArr.length ? '' : 'none';
        if (ccBody) {
            ccBody.innerHTML = ccArr.map(function (c) {
                return '<div style="display:flex;gap:16px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">'
                    + '<span style="font-weight:600;min-width:130px;">' + escHtml(c.name || '—') + '</span>'
                    + '<span style="color:#6b7280;">' + escHtml(c.email || '—') + '</span>'
                    + '</div>';
            }).join('');
        }

        // Project info
        setText('pdStatus',      capitalize(p.status || 'active'));
        setText('pdPhase',       capitalize(p.current_phase || 'concept'));
        setText('pdProjectType', p.project_type);
        setText('pdBookingOffice', p.booking_office);
        setText('pdSize',        p.size ? p.size + ' ' + (p.unit_of_measurement || '') : '—');
        setText('pdSiteName',    p.site_name);
        setText('pdSiteAddress', p.site_address);
        setText('pdSiteContactPerson',  p.contact_person);
        setText('pdSiteContactDetails', [p.contact_mobile, p.contact_phone].filter(Boolean).join(' / ') || '—');
        setText('pdSiteContactEmail',   p.contact_email);
        setText('pdStartDate',  p.start_date  ? formatDateLong(p.start_date)  : '—');
        setText('pdEndDate',    p.end_date    ? formatDateLong(p.end_date)    : '—');
        setText('pdDuration',   p.expected_duration_days ? p.expected_duration_days + ' days' : '—');
        setText('pdHandoverDate', p.handover_date ? formatDateLong(p.handover_date) : '—');
        setText('pdCurrency',   p.project_currency || 'INR');
        setText('pdProjectValue', p.overall_project_value ? formatCurrency(p.overall_project_value) : '—');
        setText('pdConsultancyPct', p.consultancy_charges_pct != null ? p.consultancy_charges_pct + '%' : '—');
        setText('pdDocFolder',  p.document_folder_path);

        // Description + notes
        setText('pdDesc',  p.description);
        setText('pdNotes', p.project_notes);
        var notesRow = document.getElementById('pdNotesRow');
        if (notesRow) notesRow.style.display = (admin && p.project_notes) ? '' : 'none';

        // Retention (admin)
        setText('pdRetentionAmount', p.retention_amount ? formatCurrency(p.retention_amount) + (p.retention_amount_type ? ' (' + p.retention_amount_type + ')' : '') : '—');
        setText('pdRetentionPeriod', p.retention_period ? p.retention_period + ' ' + (p.retention_period_unit || '') : '—');
        setText('pdRetentionDueDate', p.retention_due_date ? formatDateLong(p.retention_due_date) : '—');
        setText('pdRetentionDesc', p.retention_description);

        // Payment terms (admin)
        var ptBody = document.getElementById('pdPaymentTerms');
        var terms = Array.isArray(p.payment_terms) ? p.payment_terms : [];
        if (ptBody) {
            if (!terms.length) {
                ptBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:20px;">No payment terms defined.</td></tr>';
            } else {
                ptBody.innerHTML = terms.map(function (t, i) {
                    return '<tr>'
                        + '<td>' + (i + 1) + '</td>'
                        + '<td>' + escHtml(t.date || '—') + '</td>'
                        + '<td>' + escHtml(t.description || '—') + '</td>'
                        + '<td>' + escHtml(String(t.amount || 0)) + '</td>'
                        + '<td>' + escHtml(t.unit || '') + '</td>'
                        + '<td style="font-weight:600;">' + formatCurrency(t.value || 0) + '</td>'
                        + '</tr>';
                }).join('');
            }
        }
        var ptTotal = terms.reduce(function (s, t) { return s + (parseFloat(t.value) || 0); }, 0);
        setText('pdPtTotal', formatCurrency(ptTotal));
        setText('pdPoValue', p.overall_project_value ? formatCurrency(p.overall_project_value) : '—');

        // Phase stepper
        renderDetailPhases(p);

        // Team + Tasks
        renderDetailTeam(p);
        loadProjectTasks(p.name, p.code);

        // Show detail view, hide grid
        var container = document.querySelector('#projectTrackerPage .pr-container');
        if (container) container.classList.add('pr-detail-open');
        dv.classList.add('open');
    }

    function closeDetail() {
        var dv = document.getElementById('prDetailView');
        if (dv) dv.classList.remove('open');
        var container = document.querySelector('#projectTrackerPage .pr-container');
        if (container) container.classList.remove('pr-detail-open');
        detailProjectId = null;
    }

    function renderDetailPhases(p) {
        var container = document.getElementById('pdPhaseSteps');
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

        var advBtn = document.getElementById('pdAdvanceBtn');
        var phaseIdx = PHASES.findIndex(function (ph) { return ph.key === p.current_phase; });
        if (advBtn) {
            var isLast = phaseIdx === PHASES.length - 1;
            if (p.pending_phase) {
                advBtn.disabled = true;
                advBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> Awaiting Approval → ' + capitalize(p.pending_phase);
            } else {
                advBtn.disabled = isLast;
                advBtn.innerHTML = isLast
                    ? '<i class="fas fa-check-circle"></i> All phases complete'
                    : '<i class="fas fa-arrow-right"></i> Advance to ' + PHASES[phaseIdx + 1].label;
            }
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
                if (data.pending) {
                    // Approval required — mark pending_phase locally
                    p.pending_phase = nextPhase;
                    renderDetailPhases(p);
                    renderCards();
                    showToast('Phase advance submitted for approval.', 'success');
                } else {
                    // Admin directly advanced
                    if (!p.phases_done) p.phases_done = [];
                    p.phases_done.push(p.current_phase);
                    p.current_phase = nextPhase;
                    delete p.pending_phase;
                    renderDetailPhases(p);
                    renderCards();
                    showToast('Phase advanced to ' + capitalize(nextPhase) + '!', 'success');
                }
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

    // ── Render team list with remove buttons ─────────────────────────────
    function renderDetailTeam(p) {
        var teamList = document.getElementById('prDetailTeam');
        if (!teamList) return;
        teamList.innerHTML = (p.team_member_ids || []).map(function (mid) {
            var m = allMembers.find(function (x) { return x.id === mid; });
            if (!m) return '';
            return '<div class="pr-team-item">'
                + '<div class="pr-team-avatar">' + escHtml(getInitials(m.name)) + '</div>'
                + '<div><div class="pr-team-name">' + escHtml(m.name) + '</div>'
                +      '<div class="pr-team-role">' + escHtml(m.designation) + '</div></div>'
                + '<button class="pr-member-remove" title="Remove" onclick="DCProjects.removeMember(' + m.id + ')">'
                +   '<i class="fas fa-times"></i>'
                + '</button>'
                + '</div>';
        }).join('') || '<span style="color:#9ca3af;font-size:13px;">No members assigned.</span>';
    }

    // ── Add Member modal ─────────────────────────────────────────────────
    function openAddMemberModal() {
        if (!detailProjectId) return;
        var p = allProjects.find(function (pr) { return pr.id === detailProjectId; });
        if (!p) return;
        var assigned = p.team_member_ids || [];
        var available = allMembers.filter(function (m) { return assigned.indexOf(m.id) === -1; });

        var list  = document.getElementById('prAddMemberList');
        var empty = document.getElementById('prAddMemberEmpty');

        if (!available.length) {
            list.innerHTML = '';
            empty.style.display = '';
        } else {
            empty.style.display = 'none';
            list.innerHTML = available.map(function (m) {
                return '<div class="pr-add-member-row" onclick="DCProjects.addMember(' + m.id + ')">'
                    + '<div class="pr-add-member-avatar">' + escHtml(getInitials(m.name)) + '</div>'
                    + '<div class="pr-add-member-info">'
                    +   '<div class="pr-add-member-name">' + escHtml(m.name) + '</div>'
                    +   '<div class="pr-add-member-role">' + escHtml(m.designation) + '</div>'
                    + '</div>'
                    + '<i class="fas fa-plus pr-add-member-plus"></i>'
                    + '</div>';
            }).join('');
        }
        document.getElementById('prAddMemberOverlay').classList.add('open');
    }

    function closeAddMemberModal() {
        document.getElementById('prAddMemberOverlay').classList.remove('open');
    }

    function addMember(memberId) {
        if (!detailProjectId) return;
        var p = allProjects.find(function (pr) { return pr.id === detailProjectId; });
        if (!p) return;
        var ids = (p.team_member_ids || []).slice();
        if (ids.indexOf(memberId) !== -1) return;
        ids.push(memberId);

        apiFetch('/api/projects/' + detailProjectId + '/members', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team_member_ids: ids })
        }).then(function (data) {
            if (data && data.success) {
                p.team_member_ids = data.project.team_member_ids;
                renderDetailTeam(p);
                renderCards();
                closeAddMemberModal();
                showToast('Member added!', 'success');
            } else {
                showToast((data && data.error) || 'Failed to add member.', 'error');
            }
        });
    }

    function removeMember(memberId) {
        if (!detailProjectId) return;
        var p = allProjects.find(function (pr) { return pr.id === detailProjectId; });
        if (!p) return;
        var ids = (p.team_member_ids || []).filter(function (id) { return id !== memberId; });

        apiFetch('/api/projects/' + detailProjectId + '/members', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team_member_ids: ids })
        }).then(function (data) {
            if (data && data.success) {
                p.team_member_ids = data.project.team_member_ids;
                renderDetailTeam(p);
                renderCards();
                showToast('Member removed.', 'success');
            } else {
                showToast((data && data.error) || 'Failed to remove member.', 'error');
            }
        });
    }

    // ── Assign Task modal ────────────────────────────────────────────────
    function openAssignTaskModal() {
        if (!detailProjectId) return;
        var p = allProjects.find(function (pr) { return pr.id === detailProjectId; });
        if (!p) return;

        // Reset form
        document.getElementById('prTaskTitle').value = '';
        document.getElementById('prTaskDueDate').value = '';
        document.getElementById('prTaskPriority').value = 'medium';

        // Populate assignee dropdown with project members
        var sel = document.getElementById('prTaskAssignee');
        sel.innerHTML = '<option value="">— Unassigned —</option>';
        (p.team_member_ids || []).forEach(function (mid) {
            var m = allMembers.find(function (x) { return x.id === mid; });
            if (m) sel.innerHTML += '<option value="' + m.id + '">' + escHtml(m.name) + '</option>';
        });

        document.getElementById('prAssignTaskOverlay').classList.add('open');
    }

    function closeAssignTaskModal() {
        document.getElementById('prAssignTaskOverlay').classList.remove('open');
    }

    function submitAssignTask(e) {
        e.preventDefault();
        if (!detailProjectId) return;
        var p = allProjects.find(function (pr) { return pr.id === detailProjectId; });
        if (!p) return;

        var title    = document.getElementById('prTaskTitle').value.trim();
        var priority = document.getElementById('prTaskPriority').value;
        var dueDate  = document.getElementById('prTaskDueDate').value;
        var assigneeSel = document.getElementById('prTaskAssignee');
        var assigneeId  = assigneeSel.value ? parseInt(assigneeSel.value) : null;
        var assigneeName = assigneeId
            ? (allMembers.find(function (m) { return m.id === assigneeId; }) || {}).name || null
            : null;

        if (!title) { showToast('Task title is required.', 'error'); return; }

        var btn = document.getElementById('prAssignTaskSubmit');
        btn.disabled = true; btn.textContent = 'Saving…';

        apiFetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title:         title,
                priority:      priority,
                due_date:      dueDate || null,
                assignee_id:   assigneeId,
                assignee_name: assigneeName,
                project:       p.code || p.name
            })
        }).then(function (data) {
            btn.disabled = false; btn.textContent = 'Assign Task';
            if (data && data.task) {
                closeAssignTaskModal();
                loadProjectTasks(p.name, p.code);
                showToast('Task assigned!', 'success');
            } else {
                showToast((data && data.error) || 'Failed to assign task.', 'error');
            }
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

    // ── Customer GSTIN Search ────────────────────────────────
    function handleCustomerSearch() {
        var searchBy  = document.querySelector('input[name="prSearchBy"]:checked');
        var searchVal = (document.getElementById('prGSTINInput').value || '').trim();
        var hint      = document.getElementById('prGSTINHint');
        if (!searchVal) {
            if (hint) hint.textContent = 'Please enter a value to search.';
            return;
        }
        var match = null;
        if (searchBy && searchBy.value === 'name') {
            match = allProjects.find(function (p) {
                return p.client && p.client.toLowerCase().includes(searchVal.toLowerCase());
            });
        } else {
            match = allProjects.find(function (p) {
                return p.customer_gstin && p.customer_gstin.toLowerCase() === searchVal.toLowerCase();
            });
        }
        if (match) {
            var form = document.getElementById('prForm');
            if (form.elements['prClient']) form.elements['prClient'].value = match.client || '';
            if (form.elements['prClientEmail']) form.elements['prClientEmail'].value = match.client_email || '';
            if (form.elements['prClientPhone']) form.elements['prClientPhone'].value = match.client_phone || '';
            if (form.elements['prBillingAddress']) form.elements['prBillingAddress'].value = match.billing_address || '';
            if (form.elements['prLocation']) form.elements['prLocation'].value = match.location || '';
            if (form.elements['prArea']) form.elements['prArea'].value = match.area_sqft || '';
            if (form.elements['prCustomerGSTIN'] && searchBy && searchBy.value !== 'gstin') {
                form.elements['prCustomerGSTIN'].value = match.customer_gstin || '';
            }
            if (hint) hint.textContent = 'Customer found — details auto-filled.';
        } else {
            if (hint) hint.textContent = 'No customer found. Please fill details manually.';
        }
    }

    // ── Client Contacts (Step 5) ─────────────────────────────
    var clientContacts = [];

    function addClientContactRow(name, email) {
        var idx = clientContacts.length;
        clientContacts.push({ name: name || '', email: email || '' });
        renderClientContacts();
    }

    function removeClientContactRow(idx) {
        clientContacts.splice(idx, 1);
        renderClientContacts();
    }

    function renderClientContacts() {
        var container = document.getElementById('prClientContactsList');
        if (!container) return;
        if (!clientContacts.length) {
            container.innerHTML = '<p style="font-size:13px;color:#9ca3af;margin:0 0 8px;">No client contacts added yet.</p>';
            return;
        }
        container.innerHTML = clientContacts.map(function (c, i) {
            return '<div class="pr-client-contact-row">'
                + '<div class="pr-form-group" style="margin:0;">'
                +   '<label class="pr-form-label">Name</label>'
                +   '<input class="pr-form-input" placeholder="Client contact name" value="' + escHtml(c.name) + '" oninput="DCProjects.updateClientContact(' + i + ',\'name\',this.value)">'
                + '</div>'
                + '<div class="pr-form-group" style="margin:0;">'
                +   '<label class="pr-form-label">Email</label>'
                +   '<input class="pr-form-input" type="email" placeholder="contact@email.com" value="' + escHtml(c.email) + '" oninput="DCProjects.updateClientContact(' + i + ',\'email\',this.value)">'
                + '</div>'
                + '<button type="button" class="pr-client-contact-remove" onclick="DCProjects.removeClientContact(' + i + ')" title="Remove"><i class="fas fa-times"></i></button>'
                + '</div>';
        }).join('');
    }

    function updateClientContact(i, field, val) {
        if (clientContacts[i]) clientContacts[i][field] = val;
    }

    // ── Open New Form ────────────────────────────────────────
    function openNewForm() {
        editingId = null;
        document.getElementById('prForm').reset();
        document.getElementById('prFormTitle').textContent = 'New Project';

        // Reset all steps — step 1 open, rest closed
        ['prStep1Section','prStep2Section','prStep3Section','prStep4Section','prStep5Section'].forEach(function (id, i) {
            var s = document.getElementById(id);
            if (s) s.classList.toggle('open', i === 0);
        });

        // Widen modal for full form
        document.getElementById('prFormOverlay').classList.add('admin-wide');

        // Reset client contacts
        clientContacts = [];
        renderClientContacts();

        // Reset payment terms
        paymentTerms = [];
        renderPaymentTerms([]);

        // Reset search radio
        var gstinRadio = document.querySelector('input[name="prSearchBy"][value="gstin"]');
        if (gstinRadio) gstinRadio.checked = true;
        var hint = document.getElementById('prGSTINHint');
        if (hint) hint.textContent = 'Enter GSTIN to search or add new customer';

        var submitBtn = document.getElementById('prForm').querySelector('.pr-form-submit');
        if (submitBtn) submitBtn.textContent = 'Create Project';
        document.getElementById('prFormOverlay').classList.add('open');
    }

    function openEditForm(id) {
        var p = allProjects.find(function (pr) { return pr.id === id; });
        if (!p) return;
        editingId = id;

        var form = document.getElementById('prForm');
        form.reset();

        // Core fields
        form.elements['prName'].value        = p.name        || '';
        form.elements['prClient'].value      = p.client      || '';
        form.elements['prClientEmail'].value = p.client_email|| '';
        form.elements['prClientPhone'].value = p.client_phone|| '';
        form.elements['prLocation'].value    = p.location    || '';
        form.elements['prArea'].value        = p.area_sqft   || '';
        form.elements['prDesc'].value        = p.description || '';
        form.elements['prStartDate'].value   = p.start_date  || '';
        form.elements['prEndDate'].value     = p.end_date    || '';
        form.elements['prPhase'].value       = p.current_phase || 'concept';
        form.elements['prStatus'].value      = p.status      || 'active';

        // Team members
        document.querySelectorAll('#prMemberChecks input').forEach(function (cb) {
            cb.checked = (p.team_member_ids || []).indexOf(parseInt(cb.value)) !== -1;
        });

        // Open all steps and widen modal
        ['prStep1Section','prStep2Section','prStep3Section','prStep4Section','prStep5Section'].forEach(function (id) {
            var s = document.getElementById(id); if (s) s.classList.add('open');
        });
        document.getElementById('prFormOverlay').classList.add('admin-wide');

        // Populate all fields
        {
            function sv(n, v) { if (form.elements[n]) form.elements[n].value = (v != null ? v : ''); }
            sv('prCustomerGSTIN',       p.customer_gstin);
            sv('prBillingAddress',      p.billing_address);
            sv('prProjectType',         p.project_type);
            sv('prBookingOffice',       p.booking_office);
            sv('prProjectRefCode',      p.project_ref_code);
            sv('prSiteName',            p.site_name);
            sv('prSiteAddress',         p.site_address);
            sv('prSize',                p.size || '');
            sv('prUnitOfMeasurement',   p.unit_of_measurement);
            sv('prExpectedDuration',    p.expected_duration_days || '');
            sv('prContactPerson',       p.contact_person);
            sv('prContactMobile',       p.contact_mobile);
            sv('prContactPhone',        p.contact_phone);
            sv('prContactEmail',        p.contact_email);
            sv('prProjectNotes',        p.project_notes);
            sv('prDocFolderPath',       p.document_folder_path);
            sv('prCurrency',            p.project_currency || 'INR');
            sv('prProjectValue',        p.overall_project_value || '');
            sv('prConsultancyPct',      p.consultancy_charges_pct || '');
            sv('prRetentionAmount',     p.retention_amount || '');
            sv('prRetentionType',       p.retention_amount_type || '%');
            sv('prHandoverDate',        p.handover_date || '');
            sv('prRetentionPeriod',     p.retention_period || '');
            sv('prRetentionPeriodUnit', p.retention_period_unit || '');
            sv('prRetentionDueDate',    p.retention_due_date || '');
            sv('prRetentionDesc',       p.retention_description);
            renderPaymentTerms(Array.isArray(p.payment_terms) ? p.payment_terms : []);

            // Client contacts
            clientContacts = Array.isArray(p.client_contacts) ? p.client_contacts.map(function (c) { return { name: c.name || '', email: c.email || '' }; }) : [];
            renderClientContacts();

            // Recalculate duration text display
            calcExpectedDuration();
        }

        document.getElementById('prFormTitle').textContent = 'Edit Project';
        var submitBtn = form.querySelector('.pr-form-submit');
        if (submitBtn) submitBtn.textContent = 'Save Changes';
        document.getElementById('prFormOverlay').classList.add('open');
    }

    function deleteProjectById(id) {
        if (!confirm('Delete this project? This cannot be undone.')) return;
        apiFetch('/api/projects/' + id, { method: 'DELETE' })
            .then(function (data) {
                if (data && data.success) {
                    allProjects = allProjects.filter(function (p) { return p.id !== id; });
                    renderCards();
                    showToast('Project deleted.', 'success');
                } else {
                    showToast((data && data.error) || 'Delete failed.', 'error');
                }
            });
    }

    function closeForm() {
        var overlay = document.getElementById('prFormOverlay');
        overlay.classList.remove('open');
        overlay.classList.remove('admin-wide');
        editingId = null;
        clientContacts = [];
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

        // Admin fields (full form — always submitted)
        {
            function fv(n) { return form.elements[n] ? form.elements[n].value : ''; }
            payload.customer_gstin          = fv('prCustomerGSTIN').trim();
            payload.billing_address         = fv('prBillingAddress').trim();
            payload.project_type            = fv('prProjectType').trim();
            payload.project_ref_code        = fv('prProjectRefCode').trim();
            payload.site_name               = fv('prSiteName').trim();
            payload.site_address            = fv('prSiteAddress').trim();
            payload.booking_office          = fv('prBookingOffice').trim();
            payload.size                    = parseFloat(fv('prSize')) || 0;
            payload.unit_of_measurement     = fv('prUnitOfMeasurement').trim();
            payload.expected_duration_days  = parseInt(fv('prExpectedDuration')) || 0;
            payload.contact_person          = fv('prContactPerson').trim();
            payload.contact_mobile          = fv('prContactMobile').trim();
            payload.contact_phone           = fv('prContactPhone').trim();
            payload.contact_email           = fv('prContactEmail').trim();
            payload.project_notes           = fv('prProjectNotes').trim();
            payload.document_folder_path    = fv('prDocFolderPath').trim();
            payload.project_currency        = fv('prCurrency').trim() || 'INR';
            payload.overall_project_value   = parseFloat(fv('prProjectValue')) || 0;
            payload.consultancy_charges_pct = parseFloat(fv('prConsultancyPct')) || 0;
            payload.retention_amount        = parseFloat(fv('prRetentionAmount')) || 0;
            payload.retention_amount_type   = fv('prRetentionType') || '%';
            payload.handover_date           = fv('prHandoverDate') || null;
            payload.retention_period        = parseInt(fv('prRetentionPeriod')) || 0;
            payload.retention_period_unit   = fv('prRetentionPeriodUnit');
            payload.retention_due_date      = fv('prRetentionDueDate') || null;
            payload.retention_description   = fv('prRetentionDesc').trim();
            payload.payment_terms = paymentTerms.map(function (t) {
                return {
                    date:        t.date        || null,
                    description: t.description || '',
                    amount:      parseFloat(t.amount) || 0,
                    unit:        t.unit        || '%',
                    value:       calcTermValue(t)
                };
            });
            payload.client_contacts = clientContacts.filter(function (c) { return c.email || c.name; });
        }

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

    // ── Admin auto-calc helpers ──────────────────────────────
    function calcExpectedDuration() {
        var start = document.getElementById('prStartDate') ? document.getElementById('prStartDate').value : '';
        var end   = document.getElementById('prEndDate')   ? document.getElementById('prEndDate').value   : '';
        var dur     = document.getElementById('prExpectedDuration');
        var durText = document.getElementById('prExpectedDurationText');
        if (!dur) return;
        if (start && end) {
            var ms = new Date(end) - new Date(start);
            if (ms > 0) {
                var totalDays = Math.round(ms / 86400000);
                dur.value = totalDays;
                var years  = Math.floor(totalDays / 365);
                var rem    = totalDays % 365;
                var months = Math.floor(rem / 30);
                var days   = rem % 30;
                var parts  = [];
                if (years)  parts.push(years  + ' year'  + (years  !== 1 ? 's' : ''));
                if (months) parts.push(months + ' month' + (months !== 1 ? 's' : ''));
                if (days)   parts.push(days   + ' day'   + (days   !== 1 ? 's' : ''));
                if (durText) durText.value = parts.length ? parts.join(' ') : '0 days';
            } else {
                dur.value = '';
                if (durText) durText.value = '';
            }
        } else {
            dur.value = '';
            if (durText) durText.value = '';
        }
    }

    function calcRetentionDueDate() {
        var handover = document.getElementById('prHandoverDate')      ? document.getElementById('prHandoverDate').value      : '';
        var period   = parseInt(document.getElementById('prRetentionPeriod')     ? document.getElementById('prRetentionPeriod').value     : 0) || 0;
        var unit     = document.getElementById('prRetentionPeriodUnit') ? document.getElementById('prRetentionPeriodUnit').value : '';
        var due      = document.getElementById('prRetentionDueDate');
        if (!due) return;
        if (handover && period > 0 && unit) {
            var d = new Date(handover);
            if      (unit === 'Days')   d.setDate(d.getDate() + period);
            else if (unit === 'Weeks')  d.setDate(d.getDate() + period * 7);
            else if (unit === 'Months') d.setMonth(d.getMonth() + period);
            else if (unit === 'Years')  d.setFullYear(d.getFullYear() + period);
            due.value = d.toISOString().split('T')[0];
        } else {
            due.value = '';
        }
    }

    // ── Payment terms management ─────────────────────────────
    function calcTermValue(t) {
        var amount = parseFloat(t.amount) || 0;
        if (t.unit === '%') {
            var projValEl = document.getElementById('prProjectValue');
            var projectVal = projValEl ? (parseFloat(projValEl.value) || 0) : 0;
            return (amount / 100) * projectVal;
        }
        return amount;
    }

    function formatCurrency(v) {
        var n = parseFloat(v) || 0;
        return '₹' + n.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
    }

    function renderPaymentTerms(terms) {
        paymentTerms = terms || [];
        var tbody = document.getElementById('prPtBody');
        if (!tbody) return;
        if (!paymentTerms.length) {
            tbody.innerHTML = '<tr class="pr-pt-empty-row"><td colspan="7">No payment terms added yet. Click "+ Add Payment Term" to begin.</td></tr>';
            updatePaymentTotals();
            return;
        }
        tbody.innerHTML = paymentTerms.map(function (t, i) {
            return '<tr>'
                + '<td style="text-align:center;font-weight:600;color:#6b7280;">' + (i + 1) + '</td>'
                + '<td><input type="date" value="' + escHtml(t.date || '') + '" style="min-width:120px;" onchange="DCProjects.updatePaymentTerm(' + i + ',\'date\',this.value)"></td>'
                + '<td><input type="text" value="' + escHtml(t.description || '') + '" placeholder="Milestone…" style="min-width:150px;" onchange="DCProjects.updatePaymentTerm(' + i + ',\'description\',this.value)"></td>'
                + '<td><input type="number" value="' + escHtml(String(t.amount || 0)) + '" min="0" step="0.01" style="min-width:80px;" onchange="DCProjects.updatePaymentTerm(' + i + ',\'amount\',this.value)"></td>'
                + '<td><select onchange="DCProjects.updatePaymentTerm(' + i + ',\'unit\',this.value)">'
                +   '<option value="%"'     + (t.unit === '%'     ? ' selected' : '') + '>% of Value</option>'
                +   '<option value="fixed"' + (t.unit === 'fixed' ? ' selected' : '') + '>Fixed Amt</option>'
                + '</select></td>'
                + '<td class="pr-pt-value-cell">' + formatCurrency(calcTermValue(t)) + '</td>'
                + '<td style="text-align:center;"><button type="button" class="pr-pt-remove-btn" onclick="DCProjects.removePaymentTerm(' + i + ')"><i class="fas fa-trash"></i></button></td>'
                + '</tr>';
        }).join('');
        updatePaymentTotals();
    }

    function updatePaymentTotals() {
        var total = paymentTerms.reduce(function (sum, t) { return sum + calcTermValue(t); }, 0);
        var projValEl = document.getElementById('prProjectValue');
        var projectVal = projValEl ? (parseFloat(projValEl.value) || 0) : 0;
        var totalEl = document.getElementById('prPtTotalValue');
        var poEl    = document.getElementById('prPtPoValue');
        if (totalEl) totalEl.textContent = formatCurrency(total);
        if (poEl)    poEl.textContent    = formatCurrency(projectVal);
    }

    function addPaymentTermRow() {
        paymentTerms.push({ date: '', description: '', amount: 0, unit: '%' });
        renderPaymentTerms(paymentTerms);
        // scroll new row into view
        var tbody = document.getElementById('prPtBody');
        if (tbody) {
            var lastRow = tbody.lastElementChild;
            if (lastRow) lastRow.scrollIntoView({ block: 'nearest' });
        }
    }

    function removePaymentTerm(i) {
        paymentTerms.splice(i, 1);
        renderPaymentTerms(paymentTerms);
    }

    function updatePaymentTerm(i, field, val) {
        if (!paymentTerms[i]) return;
        paymentTerms[i][field] = val;
        // update just the value cell without full re-render (avoids focus loss)
        var tbody = document.getElementById('prPtBody');
        if (tbody) {
            var rows = tbody.querySelectorAll('tr');
            paymentTerms.forEach(function (t, idx) {
                var row = rows[idx];
                if (row) {
                    var valCell = row.querySelector('.pr-pt-value-cell');
                    if (valCell) valCell.textContent = formatCurrency(calcTermValue(t));
                }
            });
        }
        updatePaymentTotals();
    }

    // ── Utilities ────────────────────────────────────────────
    function getInitials(name) {
        return (name || '').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    }
    function escHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val || '—';
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

    return {
        init: init,
        destroy: destroy,
        openDetail: openDetail,
        openEditForm: openEditForm,
        deleteProjectById: deleteProjectById,
        addMember: addMember,
        removeMember: removeMember,
        updatePaymentTerm: updatePaymentTerm,
        removePaymentTerm: removePaymentTerm,
        removeClientContact: removeClientContactRow,
        updateClientContact: updateClientContact
    };
})();
