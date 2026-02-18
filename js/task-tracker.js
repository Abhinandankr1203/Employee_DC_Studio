/**
 * Task Tracker Module
 * CRUD task management with filtering, search, and inline status changes
 */

const TaskTracker = (function() {
    const API_BASE = '/api';

    // State
    let tasks = [];
    let employees = [];
    let counts = { total: 0, 'to-do': 0, 'in-progress': 0, done: 0 };
    let isInitialized = false;
    let deleteTargetId = null;
    let searchTimeout = null;
    let pollInterval = null;
    const POLL_SECONDS = 15;

    // DOM Elements
    const el = {};

    // ==================== SETUP ====================

    function init() {
        if (!isInitialized) {
            cacheElements();
            bindEvents();
            loadEmployees();
            isInitialized = true;
            console.log('TaskTracker initialized');
        }

        loadTasks();
        startPolling();
    }

    function destroy() {
        stopPolling();
    }

    function startPolling() {
        stopPolling();
        pollInterval = setInterval(loadTasks, POLL_SECONDS * 1000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function cacheElements() {
        // Stats
        el.statTotal = document.getElementById('ttStatTotal');
        el.statTodo = document.getElementById('ttStatTodo');
        el.statProgress = document.getElementById('ttStatProgress');
        el.statDone = document.getElementById('ttStatDone');

        // Toolbar
        el.search = document.getElementById('ttSearch');
        el.filterStatus = document.getElementById('ttFilterStatus');
        el.filterPriority = document.getElementById('ttFilterPriority');
        el.filterAssignee = document.getElementById('ttFilterAssignee');

        // Table
        el.tableBody = document.getElementById('ttTableBody');
        el.empty = document.getElementById('ttEmpty');
        el.table = document.getElementById('ttTable');

        // Add/Edit modal
        el.taskModal = document.getElementById('ttTaskModal');
        el.modalTitle = document.getElementById('ttModalTitle');
        el.taskForm = document.getElementById('ttTaskForm');
        el.taskId = document.getElementById('ttTaskId');
        el.taskTitle = document.getElementById('ttTaskTitle');
        el.taskDesc = document.getElementById('ttTaskDesc');
        el.taskPriority = document.getElementById('ttTaskPriority');
        el.taskStatus = document.getElementById('ttTaskStatus');
        el.taskDue = document.getElementById('ttTaskDue');
        el.taskAssignee = document.getElementById('ttTaskAssignee');

        // Delete modal
        el.deleteModal = document.getElementById('ttDeleteModal');
        el.deleteName = document.getElementById('ttDeleteName');
    }

    function bindEvents() {
        // Add task button
        document.getElementById('ttAddTaskBtn').addEventListener('click', openAddModal);

        // Search with debounce
        el.search.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadTasks, 300);
        });

        // Filters
        el.filterStatus.addEventListener('change', loadTasks);
        el.filterPriority.addEventListener('change', loadTasks);
        el.filterAssignee.addEventListener('change', loadTasks);

        // Task form submit
        el.taskForm.addEventListener('submit', handleSaveTask);

        // Modal close buttons
        document.getElementById('ttModalClose').addEventListener('click', closeTaskModal);
        document.getElementById('ttModalCancel').addEventListener('click', closeTaskModal);
        document.getElementById('ttDeleteClose').addEventListener('click', closeDeleteModal);
        document.getElementById('ttDeleteCancel').addEventListener('click', closeDeleteModal);
        document.getElementById('ttDeleteConfirm').addEventListener('click', handleDeleteTask);

        // Close modals on overlay click
        el.taskModal.addEventListener('click', function(e) {
            if (e.target === el.taskModal) closeTaskModal();
        });
        el.deleteModal.addEventListener('click', function(e) {
            if (e.target === el.deleteModal) closeDeleteModal();
        });
    }

    // ==================== DATA ====================

    function loadEmployees() {
        fetch(API_BASE + '/employees')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                employees = data.employees || [];
                populateAssigneeDropdowns();
            })
            .catch(function(err) {
                console.error('Failed to load employees:', err);
            });
    }

    function populateAssigneeDropdowns() {
        var options = '<option value="">Unassigned</option>';
        employees.forEach(function(emp) {
            options += '<option value="' + emp.id + '">' + emp.name + '</option>';
        });
        el.taskAssignee.innerHTML = options;

        var filterOptions = '<option value="">All Assignees</option>';
        employees.forEach(function(emp) {
            filterOptions += '<option value="' + emp.id + '">' + emp.name + '</option>';
        });
        el.filterAssignee.innerHTML = filterOptions;
    }

    function loadTasks() {
        var params = [];
        var status = el.filterStatus.value;
        var priority = el.filterPriority.value;
        var assignee = el.filterAssignee.value;
        var search = el.search.value.trim();

        if (status) params.push('status=' + encodeURIComponent(status));
        if (priority) params.push('priority=' + encodeURIComponent(priority));
        if (assignee) params.push('assignee_id=' + encodeURIComponent(assignee));
        if (search) params.push('search=' + encodeURIComponent(search));

        var qs = params.length ? '?' + params.join('&') : '';

        fetch(API_BASE + '/tasks' + qs)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                tasks = data.tasks || [];
                counts = data.counts || { total: 0, 'to-do': 0, 'in-progress': 0, done: 0 };
                updateStats();
                renderTasks();
            })
            .catch(function(err) {
                console.error('Failed to load tasks:', err);
            });
    }

    // ==================== RENDERING ====================

    function updateStats() {
        el.statTotal.textContent = counts.total;
        el.statTodo.textContent = counts['to-do'];
        el.statProgress.textContent = counts['in-progress'];
        el.statDone.textContent = counts.done;
    }

    function renderTasks() {
        if (tasks.length === 0) {
            el.table.style.display = 'none';
            el.empty.style.display = 'block';
            return;
        }

        el.table.style.display = '';
        el.empty.style.display = 'none';

        var html = '';
        tasks.forEach(function(task) {
            var priorityClass = 'tt-priority-' + task.priority;
            var dueHtml = '';
            if (task.due_date) {
                var overdue = isOverdue(task.due_date) && task.status !== 'done';
                dueHtml = '<span class="tt-due-date' + (overdue ? ' tt-due-overdue' : '') + '">' +
                    (overdue ? '<i class="fas fa-exclamation-triangle"></i> ' : '') +
                    formatDate(task.due_date) + '</span>';
            } else {
                dueHtml = '<span class="tt-due-date">-</span>';
            }

            html += '<tr>' +
                '<td data-label="Title"><div class="tt-task-title">' + escapeHtml(task.title) + '</div>' +
                    (task.description ? '<div class="tt-task-desc">' + escapeHtml(task.description) + '</div>' : '') +
                '</td>' +
                '<td data-label="Priority"><span class="tt-priority ' + priorityClass + '">' + task.priority + '</span></td>' +
                '<td data-label="Status">' +
                    '<select class="tt-status-select" onchange="TaskTracker.quickStatusChange(' + task.id + ', this.value)">' +
                        '<option value="to-do"' + (task.status === 'to-do' ? ' selected' : '') + '>To Do</option>' +
                        '<option value="in-progress"' + (task.status === 'in-progress' ? ' selected' : '') + '>In Progress</option>' +
                        '<option value="done"' + (task.status === 'done' ? ' selected' : '') + '>Done</option>' +
                    '</select>' +
                '</td>' +
                '<td data-label="Assignee">' + (task.assignee_name ? escapeHtml(task.assignee_name) : '<span style="color:#bbb">Unassigned</span>') + '</td>' +
                '<td data-label="Due Date">' + dueHtml + '</td>' +
                '<td data-label="Actions"><div class="tt-actions">' +
                    '<button class="tt-action-btn" onclick="TaskTracker.editTask(' + task.id + ')" title="Edit"><i class="fas fa-pen"></i></button>' +
                    '<button class="tt-action-btn tt-delete-btn" onclick="TaskTracker.deleteTask(' + task.id + ')" title="Delete"><i class="fas fa-trash"></i></button>' +
                '</div></td>' +
            '</tr>';
        });

        el.tableBody.innerHTML = html;
    }

    // ==================== CRUD ====================

    function openAddModal() {
        el.modalTitle.textContent = 'Add Task';
        el.taskId.value = '';
        el.taskForm.reset();
        el.taskPriority.value = 'medium';
        el.taskStatus.value = 'to-do';
        el.taskModal.classList.add('active');
    }

    function openEditModal(id) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;

        el.modalTitle.textContent = 'Edit Task';
        el.taskId.value = task.id;
        el.taskTitle.value = task.title;
        el.taskDesc.value = task.description || '';
        el.taskPriority.value = task.priority;
        el.taskStatus.value = task.status;
        el.taskDue.value = task.due_date || '';
        el.taskAssignee.value = task.assignee_id || '';
        el.taskModal.classList.add('active');
    }

    function closeTaskModal() {
        el.taskModal.classList.remove('active');
    }

    function handleSaveTask(e) {
        e.preventDefault();

        var id = el.taskId.value;
        var assigneeId = el.taskAssignee.value;
        var assigneeName = '';
        if (assigneeId) {
            var emp = employees.find(function(e) { return e.id === parseInt(assigneeId); });
            if (emp) assigneeName = emp.name;
        }

        var payload = {
            title: el.taskTitle.value.trim(),
            description: el.taskDesc.value.trim(),
            priority: el.taskPriority.value,
            status: el.taskStatus.value,
            due_date: el.taskDue.value || null,
            assignee_id: assigneeId ? parseInt(assigneeId) : null,
            assignee_name: assigneeName || null
        };

        if (!payload.title) return;

        var method, url;
        if (id) {
            method = 'PUT';
            url = API_BASE + '/tasks/' + id;
        } else {
            method = 'POST';
            url = API_BASE + '/tasks';
        }

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
        .catch(function(err) {
            showNotification('Network error', 'error');
            console.error(err);
        });
    }

    function openDeleteModal(id) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;

        deleteTargetId = id;
        el.deleteName.textContent = task.title;
        el.deleteModal.classList.add('active');
    }

    function closeDeleteModal() {
        el.deleteModal.classList.remove('active');
        deleteTargetId = null;
    }

    function handleDeleteTask() {
        if (!deleteTargetId) return;

        fetch(API_BASE + '/tasks/' + deleteTargetId, { method: 'DELETE' })
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
            .catch(function(err) {
                showNotification('Network error', 'error');
                console.error(err);
            });
    }

    // ==================== QUICK ACTIONS ====================

    function quickStatusChange(id, newStatus) {
        fetch(API_BASE + '/tasks/' + id + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                loadTasks();
            } else {
                showNotification(data.error || 'Failed to update status', 'error');
            }
        })
        .catch(function(err) {
            showNotification('Network error', 'error');
            console.error(err);
        });
    }

    // ==================== UTILITIES ====================

    function showNotification(message, type) {
        // Remove existing toast
        var existing = document.querySelector('.tt-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'tt-toast ' + (type || 'success');
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger show
        requestAnimationFrame(function() {
            toast.classList.add('show');
        });

        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 2500);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function isOverdue(dateStr) {
        if (!dateStr) return false;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var due = new Date(dateStr + 'T00:00:00');
        return due < today;
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== PUBLIC API ====================

    return {
        init: init,
        destroy: destroy,
        editTask: openEditModal,
        deleteTask: openDeleteModal,
        quickStatusChange: quickStatusChange
    };

})();
