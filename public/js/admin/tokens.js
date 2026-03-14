// Admin Tokens Section JS
let tokenCountdownIntervals = new Map();
let autoDeleteEnabled = false;

// Load tokens data
async function loadTokens() {
    try {
        // Clear existing countdown intervals
        clearAllTokenCountdowns();

        const response = await fetch('/api/admin/tokens');
        const data = await response.json();

        if (data.success) {
            // Update desktop table
            const tbody = document.getElementById('tokensTableBody');
            tbody.innerHTML = '';
            autoDeleteEnabled = data.autoDeleteEnabled;
            if (typeof updateAutoDeleteStatus === 'function') updateAutoDeleteStatus();

            // Update mobile table
            const mobileTable = document.getElementById('tokensMobileTable');
            mobileTable.innerHTML = '';

            if (data.tokens.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                            <div class="flex flex-col items-center">
                                <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                                </svg>
                                <p class="text-gray-500 text-lg">No tokens found</p>
                                <p class="text-gray-400 text-sm mt-1">Tokens will appear here once generated</p>
                            </div>
                        </td>
                    </tr>
                `;
                mobileTable.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                        </svg>
                        <p class="text-gray-500 text-lg">No tokens found</p>
                        <p class="text-gray-400 text-sm mt-1">Tokens will appear here once generated</p>
                    </div>
                `;
                return;
            }

            // Desktop table
            data.tokens.forEach(token => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition-all duration-200';
                const statusClass = getStatusClass(token.status);
                const timeRemaining = token.status === 'ACTIVE' ? formatTime(token.timeRemaining) : '--';

                row.innerHTML = `
                    <td class="px-6 py-4">
                        <span class="font-mono text-sm font-semibold text-gray-900">${token.device_id}</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="status-badge ${statusClass}">
                            ${token.status}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <span id="token-time-${token._id}" class="text-sm font-medium ${token.status === 'ACTIVE' && token.timeRemaining < 60 ? 'text-red-600' : 'text-gray-700'}">
                            ${timeRemaining}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(token.created_at)}</td>
                    <td class="px-6 py-4">
                        <button onclick="deleteToken('${token._id}')" class="text-red-600 hover:text-red-800 transition-colors duration-200 font-medium text-sm bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg">
                            Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(row);

                // Start countdown for active tokens
                if (token.status === 'ACTIVE' && token.timeRemaining > 0) {
                    startTokenCountdown(token._id, token.timeRemaining);
                }
            });

            // Mobile cards - Enhanced design
            data.tokens.forEach(token => {
                const card = document.createElement('div');
                card.className = 'mobile-table-card';
                const timeRemaining = token.status === 'ACTIVE' ? formatTime(token.timeRemaining) : '--';
                const statusBadge = getMobileStatusBadge(token.status);
                const isExpiring = token.status === 'ACTIVE' && token.timeRemaining < 60;

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                                </svg>
                                <span class="font-mono text-sm font-semibold text-gray-900">${token.device_id}</span>
                            </div>
                            ${statusBadge}
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-gray-50 rounded-lg p-3 text-center">
                            <div class="text-xs text-gray-500 mb-1">Time Remaining</div>
                            <div id="mobile-token-time-${token._id}" class="text-sm font-semibold ${isExpiring ? 'text-red-600' : 'text-gray-900'}">
                                ${timeRemaining}
                            </div>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-3 text-center">
                            <div class="text-xs text-gray-500 mb-1">Created</div>
                            <div class="text-sm font-semibold text-gray-900">${formatDateShort(token.created_at)}</div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end">
                        <button onclick="deleteToken('${token._id}')" class="text-red-600 hover:text-red-800 transition-colors duration-200 font-medium text-sm bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            Delete Token
                        </button>
                    </div>
                `;
                mobileTable.appendChild(card);

                // Start countdown for active tokens on mobile
                if (token.status === 'ACTIVE' && token.timeRemaining > 0) {
                    startMobileTokenCountdown(token._id, token.timeRemaining);
                }
            });
        }
    } catch (error) {
        console.error('Error loading tokens:', error);
        addRecentActivity('Failed to load token data', 'error');
    }
}

// Start countdown for token time remaining
function startTokenCountdown(tokenId, initialSeconds) {
    // Clear any existing interval for this token
    if (tokenCountdownIntervals.has(tokenId)) {
        clearInterval(tokenCountdownIntervals.get(tokenId));
    }

    let seconds = initialSeconds;
    const timeElement = document.getElementById(`token-time-${tokenId}`);

    const interval = setInterval(() => {
        seconds--;

        if (seconds <= 0) {
            timeElement.textContent = '00:00';
            timeElement.className = 'text-red-600 font-semibold';
            clearInterval(interval);
            tokenCountdownIntervals.delete(tokenId);

            // Update token status to expired
            updateTokenStatus(tokenId, 'EXPIRED');
            return;
        }

        // Add warning class when less than 60 seconds
        if (seconds < 60) {
            timeElement.className = 'text-red-600 font-semibold';
        }

        timeElement.textContent = formatTime(seconds);
    }, 1000);

    tokenCountdownIntervals.set(tokenId, interval);
}

// Start countdown for mobile token time remaining
function startMobileTokenCountdown(tokenId, initialSeconds) {
    let seconds = initialSeconds;
    const timeElement = document.getElementById(`mobile-token-time-${tokenId}`);

    const interval = setInterval(() => {
        seconds--;

        if (seconds <= 0) {
            timeElement.textContent = '00:00';
            timeElement.className = 'text-red-600 font-semibold';
            clearInterval(interval);
            return;
        }

        // Add warning class when less than 60 seconds
        if (seconds < 60) {
            timeElement.className = 'text-red-600 font-semibold';
        }

        timeElement.textContent = formatTime(seconds);
    }, 1000);
}

// Clear all token countdown intervals
function clearAllTokenCountdowns() {
    tokenCountdownIntervals.forEach((interval, tokenId) => {
        clearInterval(interval);
    });
    tokenCountdownIntervals.clear();
}

// Update token status when expired
function updateTokenStatus(tokenId, newStatus) {
    // Find the token row and update its status
    const statusElement = document.querySelector(`#tokensTableBody tr td .status-badge`);
    if (statusElement) {
        statusElement.textContent = newStatus;
        statusElement.className = `status-badge ${getStatusClass(newStatus)}`;
    }

    // Update dashboard stats
    if (typeof loadDashboardStats === 'function') loadDashboardStats();
}

// Delete token
async function deleteToken(tokenId) {
    if (!confirm('Are you sure you want to delete this token?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/tokens/${tokenId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            // Clear countdown for this token
            if (tokenCountdownIntervals.has(tokenId)) {
                clearInterval(tokenCountdownIntervals.get(tokenId));
                tokenCountdownIntervals.delete(tokenId);
            }

            loadTokens();
            if (typeof loadDashboardStats === 'function') loadDashboardStats();
            addRecentActivity('Token deleted successfully', 'success');
        } else {
            showAlert('Error deleting token: ' + data.message);
            addRecentActivity('Failed to delete token', 'error');
        }
    } catch (error) {
        console.error('Error deleting token:', error);
        showAlert('Network error. Please try again.');
        addRecentActivity('Network error while deleting token', 'error');
    }
}

// Toggle auto-delete expired tokens
async function toggleAutoDelete() {
    try {
        const response = await fetch('/api/admin/auto-delete-expired', {
            method: 'PATCH'
        });
        const data = await response.json();
        if (data.success) {
            autoDeleteEnabled = data.autoDeleteEnabled;
            updateAutoDeleteStatus();
            loadTokens();
            addRecentActivity(`Auto-delete ${autoDeleteEnabled ? 'enabled' : 'disabled'}`, 'info');
        } else {
            showAlert('Error toggling auto-delete: ' + data.message);
            addRecentActivity('Failed to toggle auto-delete', 'error');
        }
    } catch (error) {
        console.error('Error toggling auto-delete:', error);
        showAlert('Network error. Please try again.');
        addRecentActivity('Network error while toggling auto-delete', 'error');
    }
}

// Update auto-delete status display
function updateAutoDeleteStatus() {
    const statusElement = document.getElementById('autoDeleteStatus');
    if (!statusElement) return;
    statusElement.textContent = autoDeleteEnabled ? 'ON' : 'OFF';

    const button = document.getElementById('toggleAutoDelete');
    if (!button) return;
    if (autoDeleteEnabled) {
        button.classList.remove('btn-warning');
        button.classList.add('btn-success');
    } else {
        button.classList.remove('btn-success');
        button.classList.add('btn-warning');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    loadTokens();
    const refreshBtn = document.getElementById('refreshTokens');
    if (refreshBtn) refreshBtn.addEventListener('click', loadTokens);

    const toggleBtn = document.getElementById('toggleAutoDelete');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleAutoDelete);
});
