// Admin Common JS - Shared across all admin pages
let socket;
// Detect current section from URL (e.g., /admin/users -> 'users', /admin -> 'dashboard')
let currentSection = (function () {
    const path = window.location.pathname.replace('/admin/', '').replace('/admin', '');
    return path || 'dashboard';
})();

// Initialize Socket.io connection
function initializeSocket() {
    socket = io();
    socket.on('connect', function () {
        console.log('Connected to server');
        socket.emit('join-admin');
        addRecentActivity('Connected to real-time server', 'success');
    });
    // Real-time event handlers
    socket.on('user-login-attempt', handleLoginAttempt);
    socket.on('token-verification', handleTokenVerification);
    socket.on('session-created', handleSessionCreated);
    socket.on('user-logout', handleUserLogout);
    socket.on('security-alert', handleSecurityAlert);
    socket.on('virtual-token-generated', handleVirtualTokenGenerated);
    socket.on('session-force-logout', handleSessionForceLogout);
    socket.on('token-expired', handleTokenExpired);
    socket.on('token-status-update', handleTokenStatusUpdate);

    // New real-time events for block/rate-limiting
    socket.on('device-blocked', (data) => {
        addRecentActivity(`Device ${data.device_id} blocked`, 'warning');
        if (currentSection === 'block-device') loadBlockedDevices();
    });
    socket.on('device-unblocked', (data) => {
        addRecentActivity(`Device ${data.device_id} unblocked`, 'success');
        if (currentSection === 'block-device') loadBlockedDevices();
    });
    socket.on('ip-blocked', (data) => {
        addRecentActivity(`IP ${data.ip} blocked: ${data.reason}`, 'warning');
        if (currentSection === 'rate-limiting') loadBlockedIPs();
    });
    socket.on('ip-unblocked', (data) => {
        addRecentActivity(`IP ${data.ip} unblocked`, 'success');
        if (currentSection === 'rate-limiting') loadBlockedIPs();
    });

    // Handle system status updates
    socket.on('system-status', (data) => {
        if (document.getElementById('liveUserCounter')) {
            document.getElementById('liveUserCounter').textContent = `${data.connectedClients} online`;
        }
        if (document.getElementById('cpuBar')) {
            const cpuUsage = Math.floor(Math.random() * 30) + 10; // Simulated for visual
            document.getElementById('cpuBar').style.width = `${cpuUsage}%`;
        }
    });
}

// Add new event handler for token status updates
function handleTokenStatusUpdate(data) {
    const { tokenId, newStatus } = data;

    // Update token in the tokens table if visible
    if (currentSection === 'tokens') {
        updateTokenStatusInUI(tokenId, newStatus);
    }

    // Refresh dashboard stats
    if (typeof loadDashboardStats === 'function') loadDashboardStats();

    addRecentActivity(`Token status updated to ${newStatus}`, 'info');
}

// Update token status in UI
function updateTokenStatusInUI(tokenId, newStatus) {
    // Update desktop table
    const tokenRow = document.querySelector(`#tokensTableBody tr td.status-badge`);
    if (tokenRow) {
        const statusBadge = tokenRow.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.textContent = newStatus;
            statusBadge.className = `status-badge ${getStatusClass(newStatus)}`;
        }
    }

    // Update mobile table
    const mobileToken = document.querySelector(`[id*="mobile-token-time-${tokenId}"]`);
    if (mobileToken) {
        const mobileStatus = mobileToken.closest('.mobile-table-card').querySelector('.status-badge');
        if (mobileStatus) {
            mobileStatus.textContent = newStatus;
            mobileStatus.className = `status-badge ${getStatusClass(newStatus)}`;
        }
    }

    // Stop countdown if token is no longer active
    if (newStatus !== 'ACTIVE' && tokenCountdownIntervals.has(tokenId)) {
        clearInterval(tokenCountdownIntervals.get(tokenId));
        tokenCountdownIntervals.delete(tokenId);
    }
}

// Real-time event handlers
function handleLoginAttempt(data) {
    const status = data.success ? 'success' : 'error';
    const message = `Login attempt by ${data.username} - ${data.success ? 'Success' : 'Failed'}`;
    addRecentActivity(message, status, { username: data.username, ip: data.ip });

    if (currentSection === 'dashboard') {
        animateRequestFlow('login', data.success, { username: data.username, ip: data.ip });
    }
}

function handleTokenVerification(data) {
    const status = data.success ? 'success' : 'error';
    const message = `Token verification for ${data.username || 'Unknown'} - ${data.success ? 'Valid' : 'Invalid'}`;
    addRecentActivity(message, status, { username: data.username, ip: data.ip });

    if (currentSection === 'dashboard') {
        animateRequestFlow('token_verify', data.success, { username: data.username, ip: data.ip, device_id: data.device_id });
    }

    // Refresh tokens if on tokens page
    if (currentSection === 'tokens') {
        loadTokens();
    }
}

function handleSessionCreated(data) {
    addRecentActivity(`New session created for ${data.username}`, 'success');
    if (typeof loadDashboardStats === 'function') loadDashboardStats();

    if (currentSection === 'sessions') {
        loadSessions();
    }
}

function handleUserLogout(data) {
    addRecentActivity(`User ${data.username} logged out`, 'info');
    if (typeof loadDashboardStats === 'function') loadDashboardStats();

    if (currentSection === 'sessions') {
        loadSessions();
    }
}

function handleSecurityAlert(data) {
    let message = '';

    if (data.type === 'MULTIPLE_FAILED_LOGINS') {
        message = `⚠ Security Alert: ${data.username} has ${data.attempts} failed login attempts from ${data.lastIP}`;
    } else if (data.type === 'MULTIPLE_FAILED_TOKENS') {
        message = `⚠ Security Alert: ${data.username} is attempting unauthorized access with invalid tokens`;
    }

    showAlert(message);
    addRecentActivity(message, 'warning');
}

function handleVirtualTokenGenerated(data) {
    addRecentActivity(`Virtual token generated for device ${data.device_id}`, 'info');

    if (currentSection === 'tokens') {
        loadTokens();
    }
}

function handleSessionForceLogout(data) {
    addRecentActivity(`Session force logout executed`, 'warning');

    if (currentSection === 'sessions') {
        loadSessions();
    }
}

function handleTokenExpired(data) {
    addRecentActivity(`Token expired for device ${data.device_id}`, 'warning');

    if (currentSection === 'tokens') {
        loadTokens();
    }
    if (typeof loadDashboardStats === 'function') loadDashboardStats();
}

// Add recent activity
function addRecentActivity(message, type = 'info', metadata = {}) {
    const activityContainer = document.getElementById('recentActivity');
    if (!activityContainer) return;

    // Remove "No recent activity" message if present
    const emptyMessage = activityContainer.querySelector('.text-center');
    if (emptyMessage) {
        emptyMessage.remove();
    }

    const activityItem = document.createElement('div');
    activityItem.className = `flex items-start p-4 rounded-xl ${getActivityClass(type)} border-l-4 ${getActivityBorderClass(type)} transition-all duration-500 animate-in fade-in slide-in-from-right-4`;

    const icon = getActivityIcon(type);
    const timestamp = new Date().toLocaleTimeString();

    activityItem.innerHTML = `
        <div class="flex-shrink-0 mt-1">
            ${icon}
        </div>
        <div class="ml-3 flex-1">
            <div class="flex justify-between">
                <p class="text-sm font-medium text-gray-900">${message}</p>
                <p class="text-[10px] text-gray-400">${timestamp}</p>
            </div>
            ${metadata.username ? `<p class="text-[10px] text-gray-500 mt-0.5">User: ${metadata.username} | IP: ${metadata.ip || 'Unknown'}</p>` : ''}
        </div>
    `;

    // Add to top of list
    activityContainer.insertBefore(activityItem, activityContainer.firstChild);

    // Keep only last 15 activities
    while (activityContainer.children.length > 15) {
        activityContainer.removeChild(activityContainer.lastChild);
    }

    // Persist to localStorage
    saveActivitiesToLocal();
}

function saveActivitiesToLocal() {
    const activityContainer = document.getElementById('recentActivity');
    if (!activityContainer) return;
    const activities = Array.from(activityContainer.children).map(el => el.outerHTML);
    localStorage.setItem('vauth_recent_activities', JSON.stringify(activities.slice(0, 15)));
}

function loadActivitiesFromLocal() {
    const saved = localStorage.getItem('vauth_recent_activities');
    if (saved) {
        const activities = JSON.parse(saved);
        const activityContainer = document.getElementById('recentActivity');
        if (activityContainer && activities.length > 0) {
            activityContainer.innerHTML = activities.join('');
        }
    }
}

// Animate request flow on live map (Center HQ Animation System)
function animateRequestFlow(type, success, metadata = {}) {
    const liveMap = document.getElementById('liveMap');
    const mongoServer = document.getElementById('mongoServer');
    const firebaseServer = document.getElementById('firebaseServer');

    if (!liveMap || !mongoServer || !firebaseServer) return;

    const iconEl = document.createElement('div');
    iconEl.className = 'floating-icon w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl z-30';

    let icon = '👤';
    let color = 'bg-primary';
    let target = mongoServer;
    let label = metadata.username || 'User';

    if (type === 'token_create') {
        icon = '📱'; color = 'bg-secondary'; target = firebaseServer; label = metadata.device_id || 'Token';
    } else if (type === 'token_verify') {
        icon = '✅'; color = 'bg-success'; target = firebaseServer;
    } else if (type === 'security_alert') {
        icon = '⚠️'; color = 'bg-error'; target = mongoServer; label = 'Alert';
    }

    iconEl.classList.add(color);
    iconEl.innerHTML = `<span class="text-lg">${icon}</span><div class="activity-label">${label}</div>`;

    iconEl.style.left = '50%';
    iconEl.style.top = '90%';
    iconEl.style.transform = 'translate(-50%, -50%) scale(0)';
    iconEl.style.opacity = '0';

    liveMap.appendChild(iconEl);

    setTimeout(() => {
        iconEl.style.transform = 'translate(-50%, -50%) scale(1)';
        iconEl.style.opacity = '1';
    }, 50);

    setTimeout(() => {
        const targetRect = target.getBoundingClientRect();
        const mapRect = liveMap.getBoundingClientRect();
        const targetX = ((targetRect.left + targetRect.width / 2) - mapRect.left) / mapRect.width * 100;
        const targetY = ((targetRect.top + targetRect.height / 2) - mapRect.top) / mapRect.height * 100;
        iconEl.style.left = `${targetX}%`;
        iconEl.style.top = `${targetY}%`;
        iconEl.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
        target.classList.add('receiving');
    }, 600);

    setTimeout(() => {
        iconEl.style.transform = 'translate(-50%, -50%) scale(0)';
        iconEl.style.opacity = '0';
        target.classList.remove('receiving');
        createSplash(target);
        setTimeout(() => { if (iconEl.parentNode) iconEl.parentNode.removeChild(iconEl); }, 500);
    }, 1500);
}

function createSplash(target) {
    const splash = document.createElement('div');
    splash.className = 'absolute rounded-full border-2 border-primary opacity-0 z-0';
    splash.style.width = '60px';
    splash.style.height = '60px';
    splash.style.left = '50%';
    splash.style.top = '50%';
    splash.style.transform = 'translate(-50%, -50%)';
    splash.style.transition = 'all 0.5s ease-out';

    target.appendChild(splash);

    setTimeout(() => {
        splash.style.width = '120px';
        splash.style.height = '120px';
        splash.style.opacity = '0.5';
        splash.style.borderWidth = '1px';
    }, 10);

    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 500);
    }, 400);
}

// Show security alert modal
function showAlert(message) {
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').classList.remove('hidden');
}

// Close alert modal
function closeAlert() {
    document.getElementById('alertModal').classList.add('hidden');
}

// Admin logout
async function logout() {
    try {
        // Clear all intervals before logout (safe - may not be defined on all pages)
        if (typeof clearAllTokenCountdowns === 'function') clearAllTokenCountdowns();
        if (typeof clearAllSessionCountdowns === 'function') clearAllSessionCountdowns();

        await fetch('/api/admin/logout', {
            method: 'POST'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        window.location.href = '/admin/login';
    }
}

// Utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateShort(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(seconds) {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getStatusClass(status) {
    switch (status) {
        case 'ACTIVE':
            return 'status-active';
        case 'USED':
            return 'status-used';
        case 'EXPIRED':
            return 'status-expired';
        case 'PENDING':
            return 'status-pending';
        default:
            return 'status-pending';
    }
}

function getMobileStatusBadge(status) {
    switch (status) {
        case 'ACTIVE':
            return '<span class="status-badge status-active">ACTIVE</span>';
        case 'USED':
            return '<span class="status-badge status-used">USED</span>';
        case 'EXPIRED':
            return '<span class="status-badge status-expired">EXPIRED</span>';
        case 'PENDING':
            return '<span class="status-badge status-pending">PENDING</span>';
        default:
            return '<span class="status-badge status-pending">UNKNOWN</span>';
    }
}

function getActivityClass(type) {
    switch (type) {
        case 'success':
            return 'bg-green-50';
        case 'error':
            return 'bg-red-50';
        case 'warning':
            return 'bg-yellow-50';
        default:
            return 'bg-blue-50';
    }
}

function getActivityBorderClass(type) {
    switch (type) {
        case 'success':
            return 'border-green-400';
        case 'error':
            return 'border-red-400';
        case 'warning':
            return 'border-yellow-400';
        default:
            return 'border-blue-400';
    }
}

function getActivityIcon(type) {
    const iconClass = 'h-5 w-5';

    switch (type) {
        case 'success':
            return `<svg class="${iconClass} text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>`;
        case 'error':
            return `<svg class="${iconClass} text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>`;
        case 'warning':
            return `<svg class="${iconClass} text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>`;
        default:
            return `<svg class="${iconClass} text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>`;
    }
}

// Setup logout and alert event listeners
document.addEventListener('DOMContentLoaded', function () {
    initializeSocket();
    loadActivitiesFromLocal();

    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const closeAlertBtn = document.getElementById('closeAlert');
    if (closeAlertBtn) closeAlertBtn.addEventListener('click', closeAlert);
});
