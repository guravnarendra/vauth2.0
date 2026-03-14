// Admin Sessions Section JS
let sessionCountdownIntervals = new Map();

// Load sessions data
async function loadSessions() {
    try {
        // Clear existing countdown intervals
        clearAllSessionCountdowns();

        const response = await fetch('/api/admin/sessions');
        const data = await response.json();

        if (data.success) {
            // Update desktop table
            const tbody = document.getElementById('sessionsTableBody');
            tbody.innerHTML = '';

            // Update mobile table
            const mobileTable = document.getElementById('sessionsMobileTable');
            mobileTable.innerHTML = '';

            if (data.sessions.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                            <div class="flex flex-col items-center">
                                <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p class="text-gray-500 text-lg">No active sessions</p>
                                <p class="text-gray-400 text-sm mt-1">Active sessions will appear here</p>
                            </div>
                        </td>
                    </tr>
                `;
                mobileTable.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <p class="text-gray-500 text-lg">No active sessions</p>
                        <p class="text-gray-400 text-sm mt-1">Active sessions will appear here</p>
                    </div>
                `;
                return;
            }

            // Desktop table
            data.sessions.forEach(session => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition-all duration-200';
                const isExpiring = session.timeRemaining < 300; // 5 minutes

                row.innerHTML = `
                    <td class="px-6 py-4">
                        <div class="text-sm font-semibold text-gray-900">${session.username}</div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="font-mono text-sm text-gray-700">${session.device_id}</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            ${session.ip}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(session.started_at)}</td>
                    <td class="px-6 py-4">
                        <span id="session-time-${session._id}" class="text-sm font-medium ${isExpiring ? 'text-red-600' : 'text-gray-700'}">
                            ${formatTime(session.timeRemaining)}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <button onclick="forceLogout('${session._id}')" class="text-red-600 hover:text-red-800 transition-colors duration-200 font-medium text-sm bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg">
                            Force Logout
                        </button>
                    </td>
                `;
                tbody.appendChild(row);

                // Start countdown for session time remaining
                if (session.timeRemaining > 0) {
                    startSessionCountdown(session._id, session.timeRemaining);
                }
            });

            // Mobile cards
            data.sessions.forEach(session => {
                const card = document.createElement('div');
                card.className = 'mobile-table-card';
                const isExpiring = session.timeRemaining < 300;

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <h3 class="font-semibold text-gray-900 text-lg mb-1">${session.username}</h3>
                            <div class="flex items-center gap-2 text-sm text-gray-600">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                                </svg>
                                <span>${session.ip}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-gray-50 rounded-lg p-3">
                            <div class="text-xs text-gray-500 mb-1">Device ID</div>
                            <div class="text-sm font-mono text-gray-900 font-semibold">${session.device_id}</div>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-3">
                            <div class="text-xs text-gray-500 mb-1">Time Left</div>
                            <div id="mobile-session-time-${session._id}" class="text-sm font-semibold ${isExpiring ? 'text-red-600' : 'text-gray-900'}">
                                ${formatTime(session.timeRemaining)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <span>Started: ${formatDateShort(session.started_at)}</span>
                    </div>
                    
                    <div class="flex justify-end">
                        <button onclick="forceLogout('${session._id}')" class="text-red-600 hover:text-red-800 transition-colors duration-200 font-medium text-sm bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                            </svg>
                            Force Logout
                        </button>
                    </div>
                `;
                mobileTable.appendChild(card);

                // Start countdown for session time remaining on mobile
                if (session.timeRemaining > 0) {
                    startMobileSessionCountdown(session._id, session.timeRemaining);
                }
            });
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        addRecentActivity('Failed to load session data', 'error');
    }
}

// Start countdown for session time remaining
function startSessionCountdown(sessionId, initialSeconds) {
    // Clear any existing interval for this session
    if (sessionCountdownIntervals.has(sessionId)) {
        clearInterval(sessionCountdownIntervals.get(sessionId));
    }

    let seconds = initialSeconds;
    const timeElement = document.getElementById(`session-time-${sessionId}`);

    const interval = setInterval(() => {
        seconds--;

        if (seconds <= 0) {
            timeElement.textContent = '00:00';
            timeElement.className = 'text-red-600 font-semibold';
            clearInterval(interval);
            sessionCountdownIntervals.delete(sessionId);
            return;
        }

        // Add warning class when less than 5 minutes
        if (seconds < 300) {
            timeElement.className = 'text-red-600 font-semibold';
        }

        timeElement.textContent = formatTime(seconds);
    }, 1000);

    sessionCountdownIntervals.set(sessionId, interval);
}

// Start countdown for mobile session time remaining
function startMobileSessionCountdown(sessionId, initialSeconds) {
    let seconds = initialSeconds;
    const timeElement = document.getElementById(`mobile-session-time-${sessionId}`);

    const interval = setInterval(() => {
        seconds--;

        if (seconds <= 0) {
            timeElement.textContent = '00:00';
            timeElement.className = 'text-red-600 font-semibold';
            clearInterval(interval);
            return;
        }

        // Add warning class when less than 5 minutes
        if (seconds < 300) {
            timeElement.className = 'text-red-600 font-semibold';
        }

        timeElement.textContent = formatTime(seconds);
    }, 1000);
}

// Clear all session countdown intervals
function clearAllSessionCountdowns() {
    sessionCountdownIntervals.forEach((interval, sessionId) => {
        clearInterval(interval);
    });
    sessionCountdownIntervals.clear();
}

// Force logout session
async function forceLogout(sessionId) {
    if (!confirm('Are you sure you want to force logout this session?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/sessions/${sessionId}/force-logout`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            // Clear countdown for this session
            if (sessionCountdownIntervals.has(sessionId)) {
                clearInterval(sessionCountdownIntervals.get(sessionId));
                sessionCountdownIntervals.delete(sessionId);
            }

            loadSessions();
            if (typeof loadDashboardStats === 'function') loadDashboardStats();
            addRecentActivity('Session force logout executed', 'warning');
        } else {
            showAlert('Error forcing logout: ' + data.message);
            addRecentActivity('Failed to force logout session', 'error');
        }
    } catch (error) {
        console.error('Error forcing logout:', error);
        showAlert('Network error. Please try again.');
        addRecentActivity('Network error while forcing logout', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    loadSessions();
    const refreshBtn = document.getElementById('refreshSessions');
    if (refreshBtn) refreshBtn.addEventListener('click', loadSessions);
});
