// ===== DC TEAM MODULE =====
const DCTeam = (function () {
    'use strict';

    const DEPT_CLASS = {
        'Design':             'tm-dept-Design',
        'Project Management': 'tm-dept-Project-Management',
        'Administration':     'tm-dept-Administration',
        'Accounts':           'tm-dept-Accounts'
    };

    let allMembers   = [];
    let allProjects  = [];
    let currentFilter = 'all';
    let currentOffice = 'all';
    let currentSearch = '';
    let editingId    = null;
    let skillsList   = [];
    let toastTimer   = null;
    let lastStatCounts = {};  // tracks previous counts for smooth animation

    // ── Auth fetch ──────────────────────────────────────────
    function apiFetch(path, opts) {
        var token = localStorage.getItem('dc_token');
        var headers = Object.assign({ 'Authorization': token ? 'Bearer ' + token : '' }, (opts && opts.headers) || {});
        return fetch(path, Object.assign({}, opts, { headers }))
            .then(function (r) {
                if (r.status === 401) { window.location.reload(); return null; }
                return r.json();
            })
            .catch(function () { return null; });
    }

    // ── Init / Destroy ──────────────────────────────────────
    function init() {
        // Always reset filter state so the page is fresh on every visit
        currentFilter   = 'all';
        currentOffice   = 'all';
        currentSearch   = '';
        lastStatCounts  = {};

        // Sync UI controls to the reset state
        document.querySelectorAll('.tm-filter-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.dept === 'all');
        });
        var searchInput = document.getElementById('tmSearch');
        if (searchInput) searchInput.value = '';
        var officeFilter = document.getElementById('tmOfficeFilter');
        if (officeFilter) officeFilter.value = 'all';

        bindEvents();
        loadAll();
    }
    function destroy() { editingId = null; }

    function bindEvents() {
        var addBtn      = document.getElementById('tmAddBtn');
        var modalClose  = document.getElementById('tmModalClose');
        var modalCancel = document.getElementById('tmModalCancel');
        var form        = document.getElementById('tmForm');
        var backBtn     = document.getElementById('tmBackBtn');
        var filterBtns  = document.querySelectorAll('.tm-filter-btn');
        var overlay     = document.getElementById('tmModalOverlay');

        if (addBtn)      addBtn.addEventListener('click', openAddModal);
        if (modalClose)  modalClose.addEventListener('click', closeModal);
        if (modalCancel) modalCancel.addEventListener('click', closeModal);
        if (form)        form.addEventListener('submit', handleSubmit);
        if (overlay)     overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
        if (backBtn) {
            backBtn.addEventListener('click', function () {
                var tp = document.getElementById('teamPage');
                var db = document.getElementById('dashboardPage');
                if (tp && db) {
                    tp.classList.remove('active');
                    db.classList.add('active');
                    if (typeof DCNotifications !== 'undefined') DCNotifications.check();
                }
            });
        }

        filterBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                filterBtns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentFilter = btn.dataset.dept;
                renderCards();
            });
        });

        // Search input
        var searchInput = document.getElementById('tmSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                currentSearch = this.value.trim().toLowerCase();
                renderCards();
            });
        }

        // Office filter
        var officeFilter = document.getElementById('tmOfficeFilter');
        if (officeFilter) {
            officeFilter.addEventListener('change', function () {
                currentOffice = this.value;
                renderCards();
            });
        }

        // Skills tag input
        var skillInput = document.getElementById('tmSkillInput');
        if (skillInput) {
            skillInput.addEventListener('keydown', function (e) {
                if ((e.key === 'Enter' || e.key === ',') && skillInput.value.trim()) {
                    e.preventDefault();
                    addSkillChip(skillInput.value.trim());
                    skillInput.value = '';
                }
            });
        }
    }

    // ── Data loading ────────────────────────────────────────
    function loadAll() {
        Promise.all([apiFetch('/api/team'), apiFetch('/api/projects')])
            .then(function (results) {
                allMembers  = (results[0] && results[0].members)  ? results[0].members  : [];
                allProjects = (results[1] && results[1].projects) ? results[1].projects : [];
                populateOfficeDropdown();
                renderCards();
            });
    }

    var OFFICE_LIST = ['Bengaluru', 'Bhopal', 'Delhi', 'Gurugram', 'Head Office', 'Hyderabad', 'Kolkata', 'Mohali', 'Mumbai'];

    function populateOfficeDropdown() {
        // Dropdown is now hardcoded in HTML — nothing to do
    }

    // ── Count animation ──────────────────────────────────────
    function animateCount(el, from, to, duration) {
        // Guarantee a valid integer destination
        var target = Number.isFinite(to) ? to : 0;
        var origin = Number.isFinite(from) ? from : 0;
        if (origin === target) { el.textContent = target; return; }
        var startTs = null;
        var range   = target - origin;
        function step(ts) {
            if (startTs === null) startTs = ts;
            var elapsed  = ts - startTs;
            var progress = Math.min(elapsed / duration, 1);
            var ease     = 1 - Math.pow(1 - progress, 3); // cubic ease-out
            el.textContent = Math.round(origin + range * ease);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = target; // guarantee exact final value
            }
        }
        requestAnimationFrame(step);
    }

    // Fixed dept list — must match the filter tab buttons exactly
    var STAT_DEPTS = [
        { key: 'Design',              label: 'Design',              color: '#3b82f6' },
        { key: 'Project Management',  label: 'Project Management',  color: '#10b981' },
        { key: 'Administration',      label: 'Administration',      color: '#6b7280' },
        { key: 'Accounts',            label: 'Accounts',            color: '#f43f5e' }
    ];

    // ── Stats bar ────────────────────────────────────────────
    function renderStats(filtered) {
        var container = document.getElementById('tmStats');
        if (!container) return;

        // 1. Visible members — filtered set or all members
        var visible = Array.isArray(filtered) ? filtered : allMembers;

        // 2. Count per dept for the visible set (only the 4 fixed depts)
        var deptCounts = {};
        STAT_DEPTS.forEach(function (d) { deptCounts[d.key] = 0; });
        visible.forEach(function (m) {
            var dept = (m.department || '').trim();
            if (deptCounts.hasOwnProperty(dept)) deptCounts[dept]++;
        });

        // 3. Build card descriptors: Total first, then the 4 fixed depts
        var cards = [
            { key: '__total__', label: 'Total Members',
              count: visible.length, color: '#eb7846', zero: false }
        ];
        STAT_DEPTS.forEach(function (d) {
            var count = deptCounts[d.key];
            cards.push({ key: d.key, label: d.label,
                         count: count, color: d.color, zero: count === 0 });
        });

        // 4. Render HTML (numbers start at 0 — animation fills them in)
        container.innerHTML = cards.map(function (c, i) {
            return '<div class="tm-stat' + (c.zero ? ' tm-stat-zero' : '') + '"'
                + ' data-stat-idx="' + i + '"'
                + ' style="--stat-color:' + c.color + '">'
                + '<div class="tm-stat-num">0</div>'
                + '<div class="tm-stat-lbl">' + escHtml(c.label) + '</div>'
                + '</div>';
        }).join('');

        // 6. Animate each number from its last known value to the new count
        cards.forEach(function (c, i) {
            var numEl = container.querySelector('[data-stat-idx="' + i + '"] .tm-stat-num');
            if (!numEl) return;
            var prev = (lastStatCounts[c.key] !== undefined) ? lastStatCounts[c.key] : 0;
            animateCount(numEl, prev, c.count, 450);
            lastStatCounts[c.key] = c.count; // persist for next render
        });
    }

    // ── Render cards ────────────────────────────────────────
    function renderCards() {
        var grid = document.getElementById('tmGrid');
        if (!grid) return;
        var filtered = allMembers.filter(function (m) {
            if (currentFilter !== 'all' && m.department !== currentFilter) return false;
            if (currentOffice !== 'all' && m.office !== currentOffice) return false;
            if (currentSearch && m.name.toLowerCase().indexOf(currentSearch) === -1) return false;
            return true;
        });

        renderStats(filtered);

        if (!filtered.length) {
            grid.innerHTML = '<div class="tm-empty"><i class="fas fa-users"></i><p>No team members found.</p></div>';
            return;
        }
        grid.innerHTML = filtered.map(function (m) { return buildCard(m); }).join('');

        grid.querySelectorAll('.tm-edit-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openEditModal(parseInt(btn.dataset.id));
            });
        });
        grid.querySelectorAll('.tm-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteMember(parseInt(btn.dataset.id));
            });
        });
    }

    function buildCard(m) {
        var deptCls   = DEPT_CLASS[m.department] || 'tm-dept-Administration';
        var initials  = getInitials(m.name);
        var skills    = (m.skills || []).map(function (s) {
            return '<span class="tm-skill-tag">' + escHtml(s) + '</span>';
        }).join('');
        var projCount = allProjects.filter(function (p) {
            return (p.team_member_ids || []).indexOf(m.id) !== -1;
        }).length;

        return '<div class="tm-card ' + deptCls + '">'
            + '<div class="tm-card-top">'
            +   '<div class="tm-initials">' + escHtml(initials) + '</div>'
            +   '<div class="tm-card-info">'
            +     '<div class="tm-card-name">' + escHtml(m.name) + '</div>'
            +     '<div class="tm-card-desig">' + escHtml(m.designation) + '</div>'
            +     '<div class="tm-card-badges">'
            +       '<span class="tm-dept-badge">' + escHtml(m.department) + '</span>'
            +       (m.office ? '<span class="tm-office-badge"><i class="fas fa-map-marker-alt"></i> ' + escHtml(m.office) + '</span>' : '')
            +     '</div>'
            +   '</div>'
            + '</div>'
            + '<div class="tm-contacts">'
            +   '<div class="tm-contact-row"><i class="fas fa-envelope"></i><a href="mailto:' + escHtml(m.email) + '">' + escHtml(m.email) + '</a></div>'
            +   (m.phone ? '<div class="tm-contact-row"><i class="fas fa-phone"></i>' + escHtml(m.phone) + '</div>' : '')
            + '</div>'
            + (skills ? '<div class="tm-skills">' + skills + '</div>' : '')
            + '<div class="tm-card-foot">'
            +   '<div class="tm-projects-count"><strong>' + projCount + '</strong> project' + (projCount !== 1 ? 's' : '') + '</div>'
            +   '<div class="tm-card-actions">'
            +     '<button class="tm-edit-btn" data-id="' + m.id + '" title="Edit"><i class="fas fa-pen"></i></button>'
            +     '<button class="tm-delete-btn" data-id="' + m.id + '" title="Remove"><i class="fas fa-trash"></i></button>'
            +   '</div>'
            + '</div>'
            + '</div>';
    }

    // ── Modal ────────────────────────────────────────────────
    function openAddModal() {
        editingId = null;
        skillsList = [];
        document.getElementById('tmModalTitle').textContent = 'Add Team Member';
        document.getElementById('tmForm').reset();
        renderSkillChips();
        document.getElementById('tmModalOverlay').classList.add('open');
    }

    function openEditModal(id) {
        var m = allMembers.find(function (x) { return x.id === id; });
        if (!m) return;
        editingId = id;
        skillsList = (m.skills || []).slice();

        document.getElementById('tmModalTitle').textContent = 'Edit Team Member';
        document.getElementById('tmName').value        = m.name;
        document.getElementById('tmDesig').value       = m.designation;
        document.getElementById('tmDept').value        = m.department;
        document.getElementById('tmEmail').value       = m.email;
        document.getElementById('tmPhone').value       = m.phone || '';
        document.getElementById('tmJoined').value      = m.joined_date || '';
        document.getElementById('tmOffice').value      = m.office || '';
        renderSkillChips();
        document.getElementById('tmModalOverlay').classList.add('open');
    }

    function closeModal() {
        document.getElementById('tmModalOverlay').classList.remove('open');
        editingId = null;
        skillsList = [];
    }

    function addSkillChip(skill) {
        if (!skill || skillsList.indexOf(skill) !== -1) return;
        skillsList.push(skill);
        renderSkillChips();
    }

    function removeSkillChip(skill) {
        skillsList = skillsList.filter(function (s) { return s !== skill; });
        renderSkillChips();
    }

    function renderSkillChips() {
        var container = document.getElementById('tmSkillChips');
        if (!container) return;
        container.innerHTML = skillsList.map(function (s) {
            return '<span class="tm-skill-chip">' + escHtml(s)
                + '<button type="button" onclick="DCTeam._removeSkill(\'' + escHtml(s) + '\')"><i class="fas fa-times"></i></button>'
                + '</span>';
        }).join('');
    }

    function handleSubmit(e) {
        e.preventDefault();
        var form = e.target;
        var payload = {
            name:        form.elements['tmName'].value.trim(),
            designation: form.elements['tmDesig'].value.trim(),
            department:  form.elements['tmDept'].value,
            email:       form.elements['tmEmail'].value.trim(),
            phone:       form.elements['tmPhone'].value.trim(),
            office:      form.elements['tmOffice'].value,
            joined_date: form.elements['tmJoined'].value,
            skills:      skillsList.slice()
        };

        var url    = editingId ? '/api/team/' + editingId : '/api/team';
        var method = editingId ? 'PUT' : 'POST';
        var btn    = form.querySelector('.tm-save-btn');
        btn.disabled = true; btn.textContent = 'Saving…';

        apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (data) {
            btn.disabled = false; btn.textContent = 'Save Member';
            if (data && (data.success || data.member)) {
                if (editingId) {
                    var idx = allMembers.findIndex(function (m) { return m.id === editingId; });
                    if (idx !== -1) allMembers[idx] = data.member;
                } else {
                    allMembers.push(data.member);
                }
                closeModal();
                renderCards();
                showToast(editingId ? 'Member updated!' : 'Member added!', 'success');
            } else {
                showToast((data && data.error) || 'Failed to save.', 'error');
            }
        });
    }

    function deleteMember(id) {
        var m = allMembers.find(function (x) { return x.id === id; });
        if (!m) return;
        if (!confirm('Remove ' + m.name + ' from the team?')) return;
        apiFetch('/api/team/' + id, { method: 'DELETE' }).then(function (data) {
            if (data && data.success) {
                allMembers = allMembers.filter(function (x) { return x.id !== id; });
                renderCards();
                showToast('Member removed.', 'success');
            } else {
                showToast((data && data.error) || 'Delete failed.', 'error');
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
    function showToast(msg, type) {
        var t = document.getElementById('tmToast');
        if (!t) return;
        t.textContent = msg;
        t.className = 'tm-toast ' + type + ' show';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3000);
    }

    return {
        init:          init,
        destroy:       destroy,
        _removeSkill:  removeSkillChip   // exposed for inline onclick
    };
})();
