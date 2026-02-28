// ===== DC TEAM MODULE =====
const DCTeam = (function () {
    'use strict';

    const DEPT_CLASS = {
        'Design':              'tm-dept-Design',
        'Civil & Structural':  'tm-dept-Civil-Structural',
        'Interior':            'tm-dept-Interior',
        'Project Management':  'tm-dept-Project-Management',
        'Administration':      'tm-dept-Administration'
    };

    let allMembers  = [];
    let allProjects = [];
    let currentFilter = 'all';
    let editingId  = null;
    let skillsList = [];
    let toastTimer = null;

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
                if (tp && db) { tp.classList.remove('active'); db.classList.add('active'); }
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
                renderStats();
                renderCards();
            });
    }

    // ── Stats bar ────────────────────────────────────────────
    function renderStats() {
        var container = document.getElementById('tmStats');
        if (!container) return;
        var depts = {};
        allMembers.forEach(function (m) {
            depts[m.department] = (depts[m.department] || 0) + 1;
        });
        var html = '<div class="tm-stat"><div class="tm-stat-num">' + allMembers.length + '</div><div class="tm-stat-lbl">Total Members</div></div>';
        Object.keys(depts).forEach(function (d) {
            html += '<div class="tm-stat" data-dept="' + escHtml(d) + '">'
                + '<div class="tm-stat-num">' + depts[d] + '</div>'
                + '<div class="tm-stat-lbl">' + escHtml(d) + '</div>'
                + '</div>';
        });
        container.innerHTML = html;
    }

    // ── Render cards ────────────────────────────────────────
    function renderCards() {
        var grid = document.getElementById('tmGrid');
        if (!grid) return;
        var filtered = currentFilter === 'all'
            ? allMembers
            : allMembers.filter(function (m) { return m.department === currentFilter; });

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
            +     '<span class="tm-dept-badge">' + escHtml(m.department) + '</span>'
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
                renderStats();
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
                renderStats();
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
