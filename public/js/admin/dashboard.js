// Admin Dashboard Section JS
let startTime = Date.now();
function startUptimeCounter() {
    const counter = document.getElementById('uptimeCounter');
    if (!counter) return;

    setInterval(() => {
        const diff = Date.now() - startTime;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        counter.textContent = `${days}d ${hours}h ${mins}m`;
    }, 60000);
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Show loading state (return if not on dashboard page)
        const totalUsersEl = document.getElementById('totalUsers');
        if (!totalUsersEl) return;
        totalUsersEl.textContent = '--';
        document.getElementById('activeTokens').textContent = '--';
        document.getElementById('activeSessions').textContent = '--';
        document.getElementById('expiredTokens').textContent = '--';

        const response = await fetch('/api/admin/dashboard-stats');
        const data = await response.json();

        if (data.success) {
            // Animate number counting
            animateValue('totalUsers', 0, data.stats.totalUsers, 1000);
            animateValue('activeTokens', 0, data.stats.activeTokens, 1000);
            animateValue('activeSessions', 0, data.stats.activeSessions, 1000);
            animateValue('expiredTokens', 0, data.stats.expiredTokens, 1000);

            autoDeleteEnabled = data.stats.autoDeleteEnabled;
            updateAutoDeleteStatus();
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        addRecentActivity('Failed to load dashboard statistics', 'error');
    }
}

// Animate number counting
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.textContent = value.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Load initial data
function loadInitialData() {
    if (typeof loadUsers === 'function') loadUsers();
    if (typeof loadTokens === 'function') loadTokens();
    if (typeof loadSessions === 'function') loadSessions();
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
            loadTokens(); // Refresh tokens list
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
    loadDashboardStats();
    loadInitialData();
    startUptimeCounter();
    setInterval(loadDashboardStats, 30000);

    const refreshDash = document.getElementById('refreshStats');
    if (refreshDash) refreshDash.addEventListener('click', loadDashboardStats);
});
