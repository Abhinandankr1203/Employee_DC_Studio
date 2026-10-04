/**
 * Task Tracker Module
 * Project-grouped task management with stat card filters and collapse/expand.
 */

const TaskTracker = (function() {
    const API_BASE = '/api';

    function apiFetch(path, opts) {
        var token = localStorage.getItem('dc_token');
        var headers = Object.assign(token ? { 'Authorization': 'Bearer ' + token } : {}, (opts && opts.headers) || {});
        return fetch(path, Object.assign({}, opts, { headers }));
    }

    // ── State ──────────────────────────────────────────────────────────────
    var tasks        = [];
    var projects     = [];
    var employees    = [];
    var counts       = { total: 0, 'to-do': 0, 'in-progress': 0, done: 0 };
    var activeFilter = null;   // null = all, 'to-do', 'in-progress', 'done'
    var expandedGroups = new Set();  // safeId strings of expanded project groups

    var isInitialized  = false;
    var deleteTargetId = null;
    var searchTimeout  = null;
    var pollInterval   = null;
    const POLL_SECONDS = 15;

    var el = {};

    // ── Init / Destroy ─────────────────────────────────────────────────────
    function init() {
        if (!isInitialized) {
            cacheElements();
            bindEvents();
            loadEmployees();
            loadProjects();
            isInitialized = true;
        }
        loadTasks();
        startPolling();
    }

    function destroy() { stopPolling(); }
    function startPolling() { stopPolling(); pollInterval = setInterval(loadTasks, POLL_SECONDS * 1000); }
    function stopPolling()  { if (pollInterval) { clearInterval(pollInterval); pollInterval = null; } }

    // ── Element cache ──────────────────────────────────────────────────────
    function cacheElements() {
        // Stat cards
        el.statCardTotal    = document.getElementById('ttStatCardTotal');
        el.statCardTodo     = document.getElementById('ttStatCardTodo');
        el.statCardProgress = document.getElementById('ttStatCardProgress');
        el.statCardDone     = document.getElementById('ttStatCardDone');
        el.statTotal        = document.getElementById('ttStatTotal');
        el.statTodo         = document.getElementById('ttStatTodo');
        el.statProgress     = document.getElementById('ttStatProgress');
        el.statDone         = document.getElementById('ttStatDone');

        // Toolbar
        el.search         = document.getElementById('ttSearch');
        el.filterStatus   = document.getElementById('ttFilterStatus');
        el.filterPriority = document.getElementById('ttFilterPriority');
        el.filterAssignee = document.getElementById('ttFilterAssignee');
        el.sortBy         = document.getElementById('ttSortBy');

        // Table
        el.tableBody = document.getElementById('ttTableBody');
        el.empty     = document.getElementById('ttEmpty');
        el.table     = document.getElementById('ttTable');

        // Add/Edit modal
        el.taskModal    = document.getElementById('ttTaskModal');
        el.modalTitle   = document.getElementById('ttModalTitle');
        el.taskForm     = document.getElementById('ttTaskForm');
        el.taskId       = document.getElementById('ttTaskId');
        el.taskTitle    = document.getElementById('ttTaskTitle');
        el.taskDesc     = document.getElementById('ttTaskDesc');
        el.taskProject  = document.getElementById('ttTaskProject');
        el.taskPriority = document.getElementById('ttTaskPriority');
        el.taskStatus   = document.getElementById('ttTaskStatus');
        el.taskDue      = document.getElementById('ttTaskDue');

        // Multi-select assignee
        el.assigneeWrap        = document.getElementById('ttTaskAssigneeWrap');
        el.assigneeTrigger     = document.getElementById('ttTaskAssigneeTrigger');
        el.assigneePlaceholder = document.getElementById('ttAssigneePlaceholder');
        el.assigneeDropdown    = document.getElementById('ttTaskAssigneeDropdown');

        // Delete modal
        el.deleteModal = document.getElementById('ttDeleteModal');
        el.deleteName  = document.getElementById('ttDeleteName');
    }

    // ── Events ─────────────────────────────────────────────────────────────
    function bindEvents() {
        document.getElementById('ttAddTaskBtn').addEventListener('click', openAddModal);

        el.search.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadTasks, 300);
        });

        el.filterStatus.addEventListener('change', function() {
            activeFilter = el.filterStatus.value || null;
            updateStatCardState();
            loadTasks();
        });
        el.filterPriority.addEventListener('change', loadTasks);
        el.filterAssignee.addEventListener('change', loadTasks);
        el.sortBy.addEventListener('change', renderTasks);

        el.taskForm.addEventListener('submit', handleSaveTask);

        document.getElementById('ttModalClose').addEventListener('click', closeTaskModal);
        document.getElementById('ttModalCancel').addEventListener('click', closeTaskModal);
        document.getElementById('ttDeleteClose').addEventListener('click', closeDeleteModal);
        document.getElementById('ttDeleteCancel').addEventListener('click', closeDeleteModal);
        document.getElementById('ttDeleteConfirm').addEventListener('click', handleDeleteTask);

        el.taskModal.addEventListener('click', function(e) { if (e.target === el.taskModal) closeTaskModal(); });
        el.deleteModal.addEventListener('click', function(e) { if (e.target === el.deleteModal) closeDeleteModal(); });

        // Stat card clicks
        [el.statCardTotal, el.statCardTodo, el.statCardProgress, el.statCardDone].forEach(function(card) {
            if (!card) return;
            card.addEventListener('click', function() { handleStatCardClick(card.dataset.filter); });
        });

        // Assignee multi-select
        el.assigneeTrigger.addEventListener('click', toggleAssigneeDropdown);
        document.addEventListener('click', function(e) {
            if (el.assigneeWrap && !el.assigneeWrap.contains(e.target)) {
                closeAssigneeDropdown();
            }
        });
    }

    // ── Stat card filter ───────────────────────────────────────────────────
    function handleStatCardClick(filter) {
        if (filter === '' || activeFilter === filter) {
            activeFilter = null;
            el.filterStatus.value = '';
        } else {
            activeFilter = filter;
            el.filterStatus.value = filter;
        }
        updateStatCardState();
        loadTasks();
    }

    function updateStatCardState() {
        var cards = [el.statCardTotal, el.statCardTodo, el.statCardProgress, el.statCardDone];
        cards.forEach(function(c) { if (c) c.classList.remove('tt-stat-active'); });

        if (activeFilter === null) {
            if (el.statCardTotal) el.statCardTotal.classList.add('tt-stat-active');
        } else if (activeFilter === 'to-do') {
            if (el.statCardTodo) el.statCardTodo.classList.add('tt-stat-active');
        } else if (activeFilter === 'in-progress') {
            if (el.statCardProgress) el.statCardProgress.classList.add('tt-stat-active');
        } else if (activeFilter === 'done') {
            if (el.statCardDone) el.statCardDone.classList.add('tt-stat-active');
        }
    }

    // ── Data: load projects ────────────────────────────────────────────────
    function loadProjects() {
        apiFetch(API_BASE + '/projects')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                projects = (data.projects || []).filter(function(p) { return p.status === 'active'; });
                populateProjectDropdown();
            })
            .catch(function() {});
    }

    function populateProjectDropdown() {
        if (!el.taskProject) return;
        el.taskProject.innerHTML = '<option value="">— No Project / General —</option>' +
            projects.map(function(p) {
                return '<option value="' + escapeHtml(p.code) + '">' + escapeHtml(p.code) + ' – ' + escapeHtml(p.name) + '</option>';
            }).join('');
    }

    // ── Data: load employees ───────────────────────────────────────────────
    function loadEmployees() {
        apiFetch(API_BASE + '/employees')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                employees = data.employees || [];
                populateAssigneeDropdowns();
            })
            .catch(function(err) { console.error('Failed to load employees:', err); });
    }

    function populateAssigneeDropdowns() {
        // Form: checkbox list in custom dropdown
        if (el.assigneeDropdown) {
            el.assigneeDropdown.innerHTML = employees.map(function(emp) {
                return '<label class="tt-assignee-option" onclick="event.stopPropagation()">' +
                    '<input type="checkbox" class="tt-assignee-cb" value="' + emp.id + '" data-name="' + escapeHtml(emp.name) + '">' +
                    escapeHtml(emp.name) +
                    '</label>';
            }).join('');
            el.assigneeDropdown.querySelectorAll('.tt-assignee-cb').forEach(function(cb) {
                cb.addEventListener('change', updateAssigneeTrigger);
            });
        }

        // Filter dropdown (single select, unchanged)
        var filterOptions = '<option value="">All Assignees</option>';
        employees.forEach(function(emp) {
            filterOptions += '<option value="' + emp.id + '">' + emp.name + '</option>';
        });
        el.filterAssignee.innerHTML = filterOptions;
    }

    // ── Assignee multi-select helpers ──────────────────────────────────────
    function toggleAssigneeDropdown(e) {
        e.stopPropagation();
        if (el.assigneeDropdown.classList.contains('open')) {
            closeAssigneeDropdown();
        } else {
            openAssigneeDropdown();
        }
    }

    function openAssigneeDropdown() {
        var rect = el.assigneeTrigger.getBoundingClientRect();
        el.assigneeDropdown.style.top   = rect.bottom + 'px';
        el.assigneeDropdown.style.left  = rect.left   + 'px';
        el.assigneeDropdown.style.width = rect.width  + 'px';
        el.assigneeDropdown.classList.add('open');
        el.assigneeTrigger.classList.add('open');
    }

    function closeAssigneeDropdown() {
        el.assigneeDropdown.classList.remove('open');
        el.assigneeTrigger.classList.remove('open');
    }

    function updateAssigneeTrigger() {
        var cbs = el.assigneeDropdown.querySelectorAll('.tt-assignee-cb:checked');
        if (!cbs.length) {
            el.assigneePlaceholder.textContent = 'Unassigned';
            el.assigneePlaceholder.className = '';
        } else if (cbs.length === 1) {
            el.assigneePlaceholder.textContent = cbs[0].dataset.name;
            el.assigneePlaceholder.className = 'tt-sel-tag';
        } else {
            el.assigneePlaceholder.textContent = cbs.length + ' assignees selected';
            el.assigneePlaceholder.className = 'tt-sel-tag';
        }
    }

    function getSelectedAssignees() {
        var ids = [], names = [];
        if (el.assigneeDropdown) {
            el.assigneeDropdown.querySelectorAll('.tt-assignee-cb:checked').forEach(function(cb) {
                ids.push(parseInt(cb.value));
                names.push(cb.dataset.name);
            });
        }
        return { ids: ids, names: names };
    }

    function setSelectedAssignees(ids) {
        if (!el.assigneeDropdown) return;
        var idSet = new Set((ids || []).map(Number));
        el.assigneeDropdown.querySelectorAll('.tt-assignee-cb').forEach(function(cb) {
            cb.checked = idSet.has(parseInt(cb.value));
        });
        updateAssigneeTrigger();
    }

    function clearAssignees() {
        if (!el.assigneeDropdown) return;
        el.assigneeDropdown.querySelectorAll('.tt-assignee-cb').forEach(function(cb) { cb.checked = false; });
        updateAssigneeTrigger();
    }

    // ── Data: load tasks ───────────────────────────────────────────────────
    function loadTasks() {
        var params = [];
        var status   = el.filterStatus.value;
        var priority = el.filterPriority.value;
        var assignee = el.filterAssignee.value;
        var search   = el.search.value.trim();

        if (status)   params.push('status='      + encodeURIComponent(status));
        if (priority) params.push('priority='    + encodeURIComponent(priority));
        if (assignee) params.push('assignee_id=' + encodeURIComponent(assignee));
        if (search)   params.push('search='      + encodeURIComponent(search));

        var qs = params.length ? '?' + params.join('&') : '';

        apiFetch(API_BASE + '/tasks' + qs)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                tasks  = data.tasks  || [];
                counts = data.counts || { total: 0, 'to-do': 0, 'in-progress': 0, done: 0 };
                updateStats();
                renderTasks();
            })
            .catch(function(err) { console.error('Failed to load tasks:', err); });
    }

    // ── Rendering: stats ───────────────────────────────────────────────────
    function updateStats() {
        el.statTotal.textContent    = counts.total;
        el.statTodo.textContent     = counts['to-do'];
        el.statProgress.textContent = counts['in-progress'];
        el.statDone.textContent     = counts.done;
    }

    // ── Rendering: project-grouped tasks ───────────────────────────────────
    function renderTasks() {
        if (tasks.length === 0) {
            el.table.style.display = 'none';
            el.empty.style.display = 'block';
            return;
        }
        el.table.style.display = '';
        el.empty.style.display = 'none';

        // Build project code→name map
        var projectMap = {};
        projects.forEach(function(p) { projectMap[p.code] = p.name; });

        // Sort by deadline if requested
        var displayTasks = tasks;
        var sortVal = el.sortBy ? el.sortBy.value : '';
        if (sortVal) {
            displayTasks = tasks.slice();
            displayTasks.sort(function(a, b) {
                var da = a.due_date || null;
                var db = b.due_date || null;
                if (!da && !db) return 0;
                if (!da) return 1;
                if (!db) return -1;
                return sortVal === 'due_asc' ? (da < db ? -1 : da > db ? 1 : 0)
                                             : (da > db ? -1 : da < db ? 1 : 0);
            });
        }

        // Group tasks by project code
        var groups     = {};
        var groupOrder = [];
        displayTasks.forEach(function(task) {
            var code = task.project || '__general__';
            if (!groups[code]) {
                var name = task.project
                    ? (projectMap[task.project] || task.project)
                    : 'General';
                groups[code] = { code: code, displayCode: task.project || '', name: name, tasks: [] };
                groupOrder.push(code);
            }
            groups[code].tasks.push(task);
        });

        var html = '';
        groupOrder.forEach(function(code) {
            var g          = groups[code];
            var safeId     = code.replace(/[^a-zA-Z0-9]/g, '-');
            var chevId     = 'tt-pchev-' + safeId;
            var isExpanded = expandedGroups.has(safeId);

            html += '<tr class="tt-project-row" onclick="TaskTracker._toggleProject(\'' + safeId + '\',\'' + chevId + '\')">' +
                '<td colspan="6">' +
                    '<span class="tt-project-chevron" id="' + chevId + '" style="transform:rotate(' + (isExpanded ? 90 : 0) + 'deg)">&#9654;</span>' +
                    (g.displayCode ? '<span class="tt-project-badge">' + escapeHtml(g.displayCode) + '</span>' : '') +
                    '<span class="tt-project-name">' + escapeHtml(g.name) + '</span>' +
                    '<span class="tt-project-count">' + g.tasks.length + ' task' + (g.tasks.length !== 1 ? 's' : '') + '</span>' +
                '</td>' +
            '</tr>';

            g.tasks.forEach(function(task) {
                var priorityClass = 'tt-priority-' + task.priority;
                var dueHtml = '';
                if (task.due_date) {
                    var overdue = isOverdue(task.due_date) && task.status !== 'done';
                    dueHtml = '<span class="tt-due-date' + (overdue ? ' tt-due-overdue' : '') + '">' +
                        (overdue ? '<i class="fas fa-exclamation-triangle"></i> ' : '') +
                        formatDate(task.due_date) + '</span>';
                } else {
                    dueHtml = '<span class="tt-due-date">—</span>';
                }

                var statusCell = task.status === 'pending-approval'
                    ? '<span class="tt-status-pending"><i class="fas fa-hourglass-half"></i> Pending Approval</span>'
                    : '<select class="tt-status-select" onchange="TaskTracker.quickStatusChange(' + task.id + ', this.value)">' +
                        '<option value="to-do"'      + (task.status === 'to-do'       ? ' selected' : '') + '>To Do</option>' +
                        '<option value="in-progress"'+ (task.status === 'in-progress' ? ' selected' : '') + '>In Progress</option>' +
                        '<option value="done"'       + (task.status === 'done'        ? ' selected' : '') + '>Done</option>' +
                      '</select>';

                // Assignee display — support both old and new format
                var aNames = task.assignee_names || (task.assignee_name ? [task.assignee_name] : []);
                var assigneeHtml;
                if (!aNames.length) {
                    assigneeHtml = '<span style="color:#bbb">Unassigned</span>';
                } else if (aNames.length === 1) {
                    assigneeHtml = escapeHtml(aNames[0]);
                } else {
                    assigneeHtml = '<span class="tt-multi-assignee">' +
                        aNames.map(function(n) {
                            return '<span class="tt-asgn-chip">' + escapeHtml(n) + '</span>';
                        }).join('') +
                        '</span>';
                }

                html += '<tr class="tt-task-row' + (isExpanded ? '' : ' tt-row-hidden') + '" data-group="' + safeId + '">' +
                    '<td data-label="Title"><div class="tt-task-title">' + escapeHtml(task.title) + '</div>' +
                        (task.description ? '<div class="tt-task-desc">' + escapeHtml(task.description) + '</div>' : '') +
                    '</td>' +
                    '<td data-label="Priority"><span class="tt-priority ' + priorityClass + '">' + task.priority + '</span></td>' +
                    '<td data-label="Status">' + statusCell + '</td>' +
                    '<td data-label="Assignee">' + assigneeHtml + '</td>' +
                    '<td data-label="Due Date">' + dueHtml + '</td>' +
                    '<td data-label="Actions"><div class="tt-actions">' +
                        '<button class="tt-action-btn" onclick="TaskTracker.editTask(' + task.id + ')" title="Edit"><i class="fas fa-pen"></i></button>' +
                        '<button class="tt-action-btn tt-delete-btn" onclick="TaskTracker.deleteTask(' + task.id + ')" title="Delete"><i class="fas fa-trash"></i></button>' +
                    '</div></td>' +
                '</tr>';
            });
        });

        el.tableBody.innerHTML = html;
    }

    // ── Project collapse/expand ────────────────────────────────────────────
    function _toggleProject(safeId, chevId) {
        var chev = document.getElementById(chevId);
        var rows = el.tableBody.querySelectorAll('tr[data-group="' + safeId + '"]');
        if (!rows.length) return;
        var isHidden = rows[0].classList.contains('tt-row-hidden');
        rows.forEach(function(r) { r.classList.toggle('tt-row-hidden', !isHidden); });
        if (chev) chev.style.transform = 'rotate(' + (isHidden ? 90 : 0) + 'deg)';
        if (isHidden) {
            expandedGroups.add(safeId);
        } else {
            expandedGroups.delete(safeId);
        }
    }

    // ── CRUD ───────────────────────────────────────────────────────────────
    function openAddModal() {
        el.modalTitle.textContent = 'Add Task';
        el.taskId.value = '';
        el.taskForm.reset();
        el.taskPriority.value = 'medium';
        el.taskStatus.value   = 'to-do';
        if (el.taskProject) el.taskProject.value = '';
        clearAssignees();
        el.taskModal.classList.add('active');
    }

    function openEditModal(id) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;
        el.modalTitle.textContent = 'Edit Task';
        el.taskId.value       = task.id;
        el.taskTitle.value    = task.title;
        el.taskDesc.value     = task.description || '';
        el.taskPriority.value = task.priority;
        el.taskStatus.value   = task.status === 'pending-approval' ? 'in-progress' : task.status;
        el.taskDue.value      = task.due_date || '';
        if (el.taskProject) el.taskProject.value = task.project || '';
        // Support both old single and new multi-assignee format
        var ids = task.assignee_ids || (task.assignee_id ? [task.assignee_id] : []);
        setSelectedAssignees(ids);
        el.taskModal.classList.add('active');
    }

    function closeTaskModal() {
        el.taskModal.classList.remove('active');
        closeAssigneeDropdown();
    }

    function handleSaveTask(e) {
        e.preventDefault();
        var id  = el.taskId.value;
        var sel = getSelectedAssignees();
        var payload = {
            title:          el.taskTitle.value.trim(),
            description:    el.taskDesc.value.trim(),
            priority:       el.taskPriority.value,
            status:         el.taskStatus.value,
            due_date:       el.taskDue.value || null,
            assignee_ids:   sel.ids,
            assignee_names: sel.names,
            project:        (el.taskProject && el.taskProject.value) ? el.taskProject.value : null
        };
        if (!payload.title) return;

        var method = id ? 'PUT'  : 'POST';
        var url    = id ? API_BASE + '/tasks/' + id : API_BASE + '/tasks';

        apiFetch(url, {
            method:  method,
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                closeTaskModal();
                loadTasks();
                showNotification(id ? 'Task updated' : 'Task created', 'success');
            } else {
                showNotification(data.error || 'Failed to save task', 'error');
            }
        })
        .catch(function() { showNotification('Network error', 'error'); });
    }

    function openDeleteModal(id) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;
        deleteTargetId = id;
        el.deleteName.textContent = task.title;
        el.deleteModal.classList.add('active');
    }

    function closeDeleteModal() { el.deleteModal.classList.remove('active'); deleteTargetId = null; }

    function handleDeleteTask() {
        if (!deleteTargetId) return;
        apiFetch(API_BASE + '/tasks/' + deleteTargetId, { method: 'DELETE' })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data.success) {
                    closeDeleteModal();
                    loadTasks();
                    showNotification('Task deleted', 'success');
                } else {
                    showNotification(data.error || 'Failed to delete', 'error');
                }
            })
            .catch(function() { showNotification('Network error', 'error'); });
    }

    // ── Quick status ───────────────────────────────────────────────────────
    function quickStatusChange(id, newStatus) {
        apiFetch(API_BASE + '/tasks/' + id + '/status', {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ status: newStatus })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                if (data.approval_pending) showNotification('Task submitted for approval.', 'success');
                loadTasks();
            } else {
                showNotification(data.error || 'Failed to update status', 'error');
            }
        })
        .catch(function() { showNotification('Network error', 'error'); });
    }

    // ── Utilities ──────────────────────────────────────────────────────────
    function showNotification(message, type) {
        var existing = document.querySelector('.tt-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'tt-toast ' + (type || 'success');
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(function() { toast.classList.add('show'); });
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 2500);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function isOverdue(dateStr) {
        if (!dateStr) return false;
        var today = new Date(); today.setHours(0, 0, 0, 0);
        return new Date(dateStr + 'T00:00:00') < today;
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Public API ─────────────────────────────────────────────────────────
    return {
        init:              init,
        destroy:           destroy,
        editTask:          openEditModal,
        deleteTask:        openDeleteModal,
        quickStatusChange: quickStatusChange,
        _toggleProject:    _toggleProject
    };

})();
