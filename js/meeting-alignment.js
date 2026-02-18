/**
 * Meeting Alignment Module
 * Real API integration with Google Calendar and Gmail
 */

const MeetingAlignment = (function() {
    // API Base URL
    const API_BASE = '/api';

    // State
    let selectedParticipants = [];
    let currentMeetingId = null;
    let meetingTimer = null;
    let meetingStartTime = null;
    let transcriptText = '';
    let recognition = null;
    let isRecording = false;
    let currentFilter = 'all';
    let isInitialized = false;
    let isGoogleConnected = false;
    let annotations = [];
    let annotationFilter = 'all';

    // DOM Elements
    const elements = {};

    // Initialize
    function init() {
        if (isInitialized) return;

        cacheElements();
        bindEvents();
        setMinDate();
        checkGoogleAuthStatus();
        isInitialized = true;

        console.log('Meeting Alignment initialized');
    }

    function cacheElements() {
        // Meeting form elements
        elements.meetingForm = document.getElementById('meetingForm');
        elements.employeeSearch = document.getElementById('employeeSearch');
        elements.searchResults = document.getElementById('employeeSearchResults');
        elements.selectedParticipants = document.getElementById('selectedParticipants');
        elements.externalName = document.getElementById('externalName');
        elements.externalEmail = document.getElementById('externalEmail');
        elements.addExternalBtn = document.getElementById('addExternalBtn');

        // Tab elements
        elements.tabBtns = document.querySelectorAll('.tab-btn');
        elements.tabPanes = document.querySelectorAll('.tab-pane');

        // Meeting lists
        elements.upcomingList = document.getElementById('upcomingMeetingsList');
        elements.pastList = document.getElementById('pastMeetingsList');

        // Google connect
        elements.connectGoogleBtn = document.getElementById('connectGoogleBtn');
        elements.googleConnectStatus = document.getElementById('googleConnectStatus');

        // Navigation
        elements.backToDashboard = document.getElementById('backToDashboard');
        elements.backToMeetings = document.getElementById('backToMeetings');

        // Live meeting elements
        elements.liveMeetingTitle = document.getElementById('liveMeetingTitle');
        elements.timerDisplay = document.getElementById('timerDisplay');
        elements.joinMeetBtn = document.getElementById('joinMeetBtn');
        elements.endMeetingBtn = document.getElementById('endMeetingBtn');
        elements.transcriptContent = document.getElementById('transcriptContent');
        elements.startTranscriptBtn = document.getElementById('startTranscriptBtn');
        elements.pauseTranscriptBtn = document.getElementById('pauseTranscriptBtn');
        elements.recordingIndicator = document.getElementById('recordingIndicator');
        elements.saveTranscriptBtn = document.getElementById('saveTranscriptBtn');
        elements.clearTranscriptBtn = document.getElementById('clearTranscriptBtn');

        // Annotations
        elements.annotationsList = document.getElementById('annotationsList');
        elements.annotationType = document.getElementById('annotationType');
        elements.annotationText = document.getElementById('annotationText');
        elements.addAnnotationBtn = document.getElementById('addAnnotationBtn');
        elements.annotationFilters = document.querySelectorAll('#liveMeetingPage .filter-btn');

        // Modal
        elements.modal = document.getElementById('meetingDetailsModal');
        elements.modalTitle = document.getElementById('modalMeetingTitle');
        elements.modalBody = document.getElementById('modalMeetingBody');
        elements.modalFooter = document.getElementById('modalMeetingFooter');
        elements.closeModalBtn = document.getElementById('closeModalBtn');
    }

    function bindEvents() {
        // Tab switching
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Meeting form
        if (elements.meetingForm) {
            elements.meetingForm.addEventListener('submit', handleMeetingSubmit);
        }

        // Employee search
        if (elements.employeeSearch) {
            elements.employeeSearch.addEventListener('input', debounce(searchEmployees, 300));
            elements.employeeSearch.addEventListener('focus', () => {
                if (elements.searchResults.innerHTML) {
                    elements.searchResults.classList.add('active');
                }
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.participant-search')) {
                    elements.searchResults.classList.remove('active');
                }
            });
        }

        // Add external participant
        if (elements.addExternalBtn) {
            elements.addExternalBtn.addEventListener('click', addExternalParticipant);
        }

        // Google connect
        if (elements.connectGoogleBtn) {
            elements.connectGoogleBtn.addEventListener('click', connectGoogle);
        }

        // Navigation
        if (elements.backToDashboard) {
            elements.backToDashboard.addEventListener('click', goBackToDashboard);
        }
        if (elements.backToMeetings) {
            elements.backToMeetings.addEventListener('click', goBackToMeetings);
        }

        // Live meeting controls
        if (elements.startTranscriptBtn) {
            elements.startTranscriptBtn.addEventListener('click', startTranscription);
        }
        if (elements.pauseTranscriptBtn) {
            elements.pauseTranscriptBtn.addEventListener('click', pauseTranscription);
        }
        if (elements.saveTranscriptBtn) {
            elements.saveTranscriptBtn.addEventListener('click', saveTranscript);
        }
        if (elements.clearTranscriptBtn) {
            elements.clearTranscriptBtn.addEventListener('click', clearTranscript);
        }
        if (elements.endMeetingBtn) {
            elements.endMeetingBtn.addEventListener('click', endMeeting);
        }

        // Annotations
        if (elements.addAnnotationBtn) {
            elements.addAnnotationBtn.addEventListener('click', addAnnotation);
        }
        if (elements.annotationText) {
            elements.annotationText.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addAnnotation();
            });
        }
        elements.annotationFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                annotationFilter = btn.dataset.type;
                elements.annotationFilters.forEach(b => b.classList.toggle('active', b === btn));
                renderAnnotations();
            });
        });

        // Modal
        if (elements.closeModalBtn) {
            elements.closeModalBtn.addEventListener('click', closeModal);
        }
        if (elements.modal) {
            elements.modal.addEventListener('click', (e) => {
                if (e.target === elements.modal) closeModal();
            });
        }

        // Listen for OAuth success message from popup
        window.addEventListener('message', (event) => {
            if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                isGoogleConnected = true;
                updateGoogleButtonUI(true);
                showNotification('Google Calendar connected successfully!', 'success');
            }
        });
    }

    // Tab switching
    function switchTab(tabName) {
        elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        elements.tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === tabName + 'Tab');
        });

        if (tabName === 'upcoming') {
            loadMeetings('upcoming');
        } else if (tabName === 'past') {
            loadMeetings('past');
        }
    }

    // Set minimum date to today
    function setMinDate() {
        const dateInput = document.getElementById('meetingDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
            dateInput.value = today;
        }
    }

    // Check Google auth status
    async function checkGoogleAuthStatus() {
        try {
            const response = await fetch(`${API_BASE}/oauth/status`);
            const data = await response.json();
            isGoogleConnected = data.authenticated;
            updateGoogleButtonUI(isGoogleConnected);
        } catch (error) {
            console.error('Error checking auth status:', error);
            updateGoogleButtonUI(false);
        }
    }

    // Employee search via API
    async function searchEmployees() {
        const query = elements.employeeSearch.value.trim();
        if (query.length < 2) {
            elements.searchResults.classList.remove('active');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/employees/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.employees && data.employees.length > 0) {
                renderSearchResults(data.employees);
            } else {
                elements.searchResults.innerHTML = '<div class="search-result-item">No employees found</div>';
                elements.searchResults.classList.add('active');
            }
        } catch (error) {
            console.error('Error searching employees:', error);
            showNotification('Failed to search employees', 'error');
        }
    }

    function renderSearchResults(employees) {
        const existingEmails = selectedParticipants.map(p => p.email);

        const html = employees
            .filter(emp => !existingEmails.includes(emp.email))
            .map(emp => `
                <div class="search-result-item" data-employee='${JSON.stringify(emp)}'>
                    <div>
                        <div class="name">${emp.name}</div>
                        <div class="email">${emp.email}</div>
                    </div>
                    <span>${emp.department || ''}</span>
                </div>
            `).join('');

        elements.searchResults.innerHTML = html || '<div class="search-result-item">All matching employees already added</div>';
        elements.searchResults.classList.add('active');

        elements.searchResults.querySelectorAll('.search-result-item[data-employee]').forEach(item => {
            item.addEventListener('click', () => {
                const employee = JSON.parse(item.dataset.employee);
                addInternalParticipant(employee);
                elements.employeeSearch.value = '';
                elements.searchResults.classList.remove('active');
            });
        });
    }

    function addInternalParticipant(employee) {
        if (selectedParticipants.find(p => p.email === employee.email)) {
            return;
        }

        selectedParticipants.push({
            employee_id: employee.id,
            name: employee.name,
            email: employee.email,
            type: 'internal'
        });

        renderSelectedParticipants();
    }

    function addExternalParticipant() {
        const name = elements.externalName.value.trim();
        const email = elements.externalEmail.value.trim();

        if (!email || !isValidEmail(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }

        if (selectedParticipants.find(p => p.email === email)) {
            showNotification('This participant is already added', 'error');
            return;
        }

        selectedParticipants.push({
            employee_id: null,
            name: name || email,
            email: email,
            type: 'external'
        });

        elements.externalName.value = '';
        elements.externalEmail.value = '';
        renderSelectedParticipants();
        showNotification('External participant added', 'success');
    }

    function renderSelectedParticipants() {
        elements.selectedParticipants.innerHTML = selectedParticipants.map((p, index) => `
            <div class="participant-chip ${p.type}">
                <span>${p.name}</span>
                <button class="remove-btn" onclick="MeetingAlignment.removeParticipant(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    function removeParticipant(index) {
        selectedParticipants.splice(index, 1);
        renderSelectedParticipants();
    }

    // Meeting form submission
    async function handleMeetingSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const createGoogleMeet = document.getElementById('createGoogleMeet').checked;
        const sendInvites = document.getElementById('sendInvites').checked;

        // Check if Google is connected when trying to create Meet
        if (createGoogleMeet && !isGoogleConnected) {
            showNotification('Please connect Google Calendar first to create Meet links', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        try {
            const response = await fetch(`${API_BASE}/meetings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.get('title'),
                    description: formData.get('description'),
                    meeting_date: formData.get('meeting_date'),
                    start_time: formData.get('start_time'),
                    end_time: formData.get('end_time'),
                    participants: selectedParticipants,
                    createGoogleMeet,
                    sendInvites
                })
            });

            const data = await response.json();

            if (data.success) {
                let message = `Meeting "${data.meeting.title}" created successfully!`;
                if (data.meeting.google_meet_link) {
                    message += ' Google Meet link generated.';
                }
                if (sendInvites) {
                    message += ' Invites sent to participants.';
                }
                showNotification(message, 'success');

                // Reset form
                e.target.reset();
                selectedParticipants = [];
                renderSelectedParticipants();
                setMinDate();

                // Switch to upcoming tab
                switchTab('upcoming');
            } else {
                showNotification(data.error || 'Failed to create meeting', 'error');
            }
        } catch (error) {
            console.error('Create meeting error:', error);
            showNotification('Failed to create meeting. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-calendar-check"></i> Schedule Meeting';
        }
    }

    // Load meetings from API
    async function loadMeetings(filter) {
        const listElement = filter === 'upcoming' ? elements.upcomingList : elements.pastList;
        listElement.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading meetings...</div>';

        try {
            const response = await fetch(`${API_BASE}/meetings?filter=${filter}`);
            const data = await response.json();

            if (data.meetings) {
                renderMeetingsList(data.meetings, listElement, filter);
            } else {
                listElement.innerHTML = '<div class="no-meetings"><i class="fas fa-calendar"></i><p>No meetings found</p></div>';
            }
        } catch (error) {
            console.error('Error loading meetings:', error);
            listElement.innerHTML = '<div class="no-meetings"><i class="fas fa-exclamation-circle"></i><p>Failed to load meetings</p></div>';
        }
    }

    function renderMeetingsList(meetings, container, filter) {
        if (!meetings || meetings.length === 0) {
            const message = filter === 'upcoming'
                ? 'No upcoming meetings scheduled'
                : 'No past meetings found';
            container.innerHTML = `<div class="no-meetings"><i class="fas fa-calendar"></i><p>${message}</p></div>`;
            return;
        }

        container.innerHTML = meetings.map(meeting => {
            const date = new Date(meeting.meeting_date + 'T' + meeting.start_time);
            const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const participantCount = meeting.participants ? meeting.participants.length : 0;

            const actionBtns = filter === 'upcoming'
                ? `
                    <button class="meeting-card-btn primary" onclick="MeetingAlignment.startMeeting(${meeting.id})">
                        <i class="fas fa-play"></i> Start
                    </button>
                    <button class="meeting-card-btn secondary" onclick="MeetingAlignment.viewMeetingDetails(${meeting.id})">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                `
                : `
                    <button class="meeting-card-btn secondary" onclick="MeetingAlignment.viewMeetingDetails(${meeting.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                `;

            return `
                <div class="meeting-card" data-meeting-id="${meeting.id}">
                    <div class="meeting-card-info">
                        <div class="meeting-card-title">${meeting.title}</div>
                        <div class="meeting-card-meta">
                            <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                            <span><i class="fas fa-clock"></i> ${formattedTime}</span>
                            <span><i class="fas fa-users"></i> ${participantCount} participants</span>
                            ${meeting.google_meet_link ? '<span class="meet-badge"><i class="fab fa-google"></i> Meet</span>' : ''}
                        </div>
                    </div>
                    <div class="meeting-card-actions">
                        ${actionBtns}
                    </div>
                </div>
            `;
        }).join('');
    }

    // View meeting details
    async function viewMeetingDetails(meetingId) {
        try {
            const response = await fetch(`${API_BASE}/meetings/${meetingId}`);
            const data = await response.json();

            if (!data.meeting) {
                showNotification('Meeting not found', 'error');
                return;
            }

            const meeting = data.meeting;
            const date = new Date(meeting.meeting_date + 'T' + meeting.start_time);

            elements.modalTitle.textContent = meeting.title;
            elements.modalBody.innerHTML = `
                <div class="meeting-detail-row">
                    <span class="label">Date:</span>
                    <span class="value">${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="meeting-detail-row">
                    <span class="label">Time:</span>
                    <span class="value">${formatTime(meeting.start_time)} - ${formatTime(meeting.end_time)}</span>
                </div>
                <div class="meeting-detail-row">
                    <span class="label">Organizer:</span>
                    <span class="value">${meeting.organizer_name}</span>
                </div>
                ${meeting.google_meet_link ? `
                <div class="meeting-detail-row">
                    <span class="label">Meet Link:</span>
                    <span class="value"><a href="${meeting.google_meet_link}" target="_blank" class="meet-link">${meeting.google_meet_link}</a></span>
                </div>
                ` : ''}
                ${meeting.description ? `
                <div class="meeting-detail-row">
                    <span class="label">Description:</span>
                    <span class="value">${meeting.description}</span>
                </div>
                ` : ''}
                <div class="meeting-detail-row">
                    <span class="label">Participants:</span>
                    <span class="value">
                        <div class="participants-list">
                            ${meeting.participants.map(p => `
                                <div class="participant-item">
                                    <div class="participant-avatar">${(p.name || p.email).charAt(0).toUpperCase()}</div>
                                    <div class="participant-info">
                                        <div class="name">${p.name || 'External'}</div>
                                        <div class="email">${p.email}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </span>
                </div>
            `;

            elements.modalFooter.innerHTML = `
                ${meeting.google_meet_link ? `
                    <a href="${meeting.google_meet_link}" target="_blank" class="meeting-card-btn primary">
                        <i class="fab fa-google"></i> Join Meet
                    </a>
                ` : ''}
                ${meeting.status === 'scheduled' ? `
                    <button class="meeting-card-btn primary" onclick="MeetingAlignment.startMeeting(${meeting.id}); MeetingAlignment.closeModal();">
                        <i class="fas fa-play"></i> Start Meeting
                    </button>
                ` : ''}
            `;

            elements.modal.classList.add('active');
        } catch (error) {
            console.error('Error fetching meeting details:', error);
            showNotification('Failed to load meeting details', 'error');
        }
    }

    function closeModal() {
        elements.modal.classList.remove('active');
    }

    // Start meeting
    async function startMeeting(meetingId) {
        try {
            const response = await fetch(`${API_BASE}/meetings/${meetingId}`);
            const data = await response.json();

            if (!data.meeting) {
                showNotification('Meeting not found', 'error');
                return;
            }

            const meeting = data.meeting;
            currentMeetingId = meetingId;

            // Update meeting status
            await fetch(`${API_BASE}/meetings/${meetingId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' })
            });

            // Update live meeting page
            elements.liveMeetingTitle.textContent = meeting.title;
            if (meeting.google_meet_link) {
                elements.joinMeetBtn.href = meeting.google_meet_link;
                elements.joinMeetBtn.style.display = 'flex';
            } else {
                elements.joinMeetBtn.style.display = 'none';
            }

            // Reset transcript and annotations
            transcriptText = '';
            elements.transcriptContent.innerHTML = '<p class="transcript-placeholder">Click the play button to start recording the meeting transcript using your microphone.</p>';
            resetAnnotations();

            // Start timer
            startMeetingTimer();

            // Navigate to live meeting page
            const meetingAlignmentPage = document.getElementById('meetingAlignmentPage');
            const liveMeetingPage = document.getElementById('liveMeetingPage');
            transitionToPage(meetingAlignmentPage, liveMeetingPage);

            showNotification('Meeting started! You can now record transcripts.', 'success');
        } catch (error) {
            console.error('Error starting meeting:', error);
            showNotification('Failed to start meeting', 'error');
        }
    }

    function startMeetingTimer() {
        meetingStartTime = Date.now();
        updateTimer();
        meetingTimer = setInterval(updateTimer, 1000);
    }

    function updateTimer() {
        const elapsed = Date.now() - meetingStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        elements.timerDisplay.textContent =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function stopMeetingTimer() {
        if (meetingTimer) {
            clearInterval(meetingTimer);
            meetingTimer = null;
        }
    }

    // End meeting
    async function endMeeting() {
        if (!confirm('Are you sure you want to end this meeting?')) return;

        stopTranscription();
        stopMeetingTimer();

        try {
            await fetch(`${API_BASE}/meetings/${currentMeetingId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' })
            });
        } catch (error) {
            console.error('Error updating meeting status:', error);
        }

        showNotification('Meeting ended and saved.', 'success');
        currentMeetingId = null;
        goBackToMeetings();
    }

    // Transcription using Web Speech API
    function startTranscription() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            showNotification('Speech recognition is not supported in your browser. Please use Chrome or Edge.', 'error');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            elements.startTranscriptBtn.style.display = 'none';
            elements.pauseTranscriptBtn.style.display = 'flex';
            elements.recordingIndicator.style.display = 'flex';
            if (elements.transcriptContent.querySelector('.transcript-placeholder')) {
                elements.transcriptContent.innerHTML = '';
            }
            showNotification('Recording started. Speak clearly into your microphone.', 'success');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                transcriptText += finalTranscript;
            }

            elements.transcriptContent.innerHTML = `<div class="transcript-text">${transcriptText}${interimTranscript ? '<span style="color: #888;">' + interimTranscript + '</span>' : ''}</div>`;
            elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                showNotification('Microphone access denied. Please allow microphone access.', 'error');
            }
        };

        recognition.onend = () => {
            if (isRecording) {
                recognition.start();
            }
        };

        recognition.start();
    }

    function pauseTranscription() {
        stopTranscription();
        showNotification('Recording paused.', 'info');
    }

    function stopTranscription() {
        if (recognition) {
            isRecording = false;
            recognition.stop();
            recognition = null;
        }
        elements.startTranscriptBtn.style.display = 'flex';
        elements.pauseTranscriptBtn.style.display = 'none';
        elements.recordingIndicator.style.display = 'none';
    }

    function saveTranscript() {
        if (!transcriptText.trim()) {
            showNotification('No transcript to save', 'error');
            return;
        }
        // Download as text file
        const blob = new Blob([transcriptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-transcript-${currentMeetingId}-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Transcript downloaded!', 'success');
    }

    function clearTranscript() {
        if (confirm('Are you sure you want to clear the transcript?')) {
            transcriptText = '';
            elements.transcriptContent.innerHTML = '<p class="transcript-placeholder">Click the play button to start recording.</p>';
            showNotification('Transcript cleared.', 'info');
        }
    }

    // ── Annotations ────────────────────────────────────────
    function addAnnotation() {
        const text = elements.annotationText.value.trim();
        if (!text) return;

        const type = elements.annotationType.value;
        annotations.push({
            id: Date.now(),
            type: type,
            text: text,
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            meetingId: currentMeetingId
        });

        elements.annotationText.value = '';
        renderAnnotations();
    }

    function deleteAnnotation(id) {
        annotations = annotations.filter(a => a.id !== id);
        renderAnnotations();
    }

    function renderAnnotations() {
        if (!elements.annotationsList) return;

        const filtered = annotationFilter === 'all'
            ? annotations
            : annotations.filter(a => a.type === annotationFilter);

        if (filtered.length === 0) {
            const msg = annotations.length === 0
                ? 'No annotations yet. Add notes, action items, or decisions during the meeting.'
                : 'No annotations match this filter.';
            elements.annotationsList.innerHTML = `<div style="color:#666;font-size:13px;text-align:center;padding:30px 15px;">${msg}</div>`;
            return;
        }

        elements.annotationsList.innerHTML = filtered.map(a => `
            <div class="annotation-item" data-id="${a.id}">
                <span class="type-badge ${a.type}">${a.type.replace('_', ' ')}</span>
                <button class="delete-btn" onclick="MeetingAlignment.deleteAnnotation(${a.id})" title="Delete">
                    <i class="fas fa-times"></i>
                </button>
                <div class="text">${escHtml(a.text)}</div>
                <div class="meta">
                    <span>${a.timestamp}</span>
                </div>
            </div>
        `).join('');

        elements.annotationsList.scrollTop = elements.annotationsList.scrollHeight;
    }

    function resetAnnotations() {
        annotations = [];
        annotationFilter = 'all';
        if (elements.annotationFilters) {
            elements.annotationFilters.forEach(b => b.classList.toggle('active', b.dataset.type === 'all'));
        }
        renderAnnotations();
    }

    function escHtml(s) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(s));
        return div.innerHTML;
    }

    // Google Calendar connection
    function updateGoogleButtonUI(connected) {
        if (connected) {
            elements.connectGoogleBtn.innerHTML = '<i class="fab fa-google"></i><span>Connected</span>';
            elements.connectGoogleBtn.classList.add('connected');
        } else {
            elements.connectGoogleBtn.innerHTML = '<i class="fab fa-google"></i><span>Connect Google</span>';
            elements.connectGoogleBtn.classList.remove('connected');
        }
    }

    async function connectGoogle() {
        if (isGoogleConnected) {
            // Disconnect
            if (confirm('Disconnect from Google Calendar?')) {
                try {
                    await fetch(`${API_BASE}/oauth/logout`, { method: 'POST' });
                    isGoogleConnected = false;
                    updateGoogleButtonUI(false);
                    showNotification('Disconnected from Google', 'info');
                } catch (error) {
                    showNotification('Failed to disconnect', 'error');
                }
            }
            return;
        }

        // Connect - get OAuth URL and open popup
        try {
            const response = await fetch(`${API_BASE}/oauth/init`);
            const data = await response.json();

            if (data.authUrl) {
                // Open OAuth in popup
                const width = 500;
                const height = 600;
                const left = (window.innerWidth - width) / 2;
                const top = (window.innerHeight - height) / 2;
                window.open(
                    data.authUrl,
                    'Google Auth',
                    `width=${width},height=${height},left=${left},top=${top}`
                );
            } else {
                showNotification('Failed to initialize Google auth', 'error');
            }
        } catch (error) {
            console.error('Error connecting to Google:', error);
            showNotification('Failed to connect to Google', 'error');
        }
    }

    // Navigation
    function goBackToDashboard() {
        const meetingPage = document.getElementById('meetingAlignmentPage');
        const dashboardPage = document.getElementById('dashboardPage');
        transitionToPage(meetingPage, dashboardPage);
    }

    function goBackToMeetings() {
        if (currentMeetingId && meetingTimer) {
            if (!confirm('Are you sure you want to leave this meeting?')) return;
            stopTranscription();
            stopMeetingTimer();
            currentMeetingId = null;
        }
        const liveMeetingPage = document.getElementById('liveMeetingPage');
        const meetingPage = document.getElementById('meetingAlignmentPage');
        transitionToPage(liveMeetingPage, meetingPage);
        switchTab('upcoming');
    }

    // Notification helper
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: white;
                    font-size: 14px;
                    z-index: 10000;
                    animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.2);
                }
                .notification-success { background: #10b981; }
                .notification-error { background: #ef4444; }
                .notification-info { background: #3b82f6; }
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // Utility functions
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function formatTime(timeStr) {
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    }

    // Public API
    return {
        init,
        removeParticipant,
        startMeeting,
        viewMeetingDetails,
        closeModal,
        deleteAnnotation
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Meeting Alignment module loaded');
});
