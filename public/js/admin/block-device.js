// Admin Block Device Section JS
async function loadBlockedDevices() {
    try {
        const response = await fetch('/api/admin/blocked-devices');
        const data = await response.json();

        if (data.success) {
            // Update stats
            document.getElementById('totalDevices').textContent = data.stats.total;
            document.getElementById('blockedDeviceCount').textContent = data.stats.blocked;
            document.getElementById('activeDeviceCount').textContent = data.stats.active;

            renderBlockedDevicesTable(data.devices);
            setupDeviceSearch(data.devices);
        }
    } catch (error) {
        console.error('Error loading blocked devices:', error);
        addRecentActivity('Failed to load blocked devices', 'error');
    }
}

function renderBlockedDevicesTable(devices) {
    const tbody = document.getElementById('blockedDevicesTableBody');
    const mobileTable = document.getElementById('blockedDevicesMobileTable');

    if (devices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No devices found</td></tr>';
        mobileTable.innerHTML = '<p class="text-center text-gray-500 py-4">No devices found</p>';
        return;
    }

    // Desktop table
    tbody.innerHTML = devices.map(d => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4"><span class="font-mono text-sm font-semibold">${d.device_id}</span></td>
            <td class="px-6 py-4 text-sm text-gray-700">${d.username}</td>
            <td class="px-6 py-4">
                <span class="status-badge ${d.status === 'blocked' ? 'status-expired' : 'status-active'}">${d.status.toUpperCase()}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">${d.blocked_at ? formatDateShort(d.blocked_at) : '--'}</td>
            <td class="px-6 py-4">
                ${d.status === 'blocked'
            ? `<button onclick="unblockDevice('${d.device_id}')" class="btn-success text-xs px-3 py-1">Unblock</button>`
            : `<button onclick="blockDevice('${d.device_id}')" class="btn-error text-xs px-3 py-1">Block</button>`
        }
            </td>
        </tr>
    `).join('');

    // Mobile table
    mobileTable.innerHTML = devices.map(d => `
        <div class="mobile-table-card">
            <div class="flex justify-between items-start mb-2">
                <span class="font-mono text-sm font-semibold">${d.device_id}</span>
                <span class="status-badge ${d.status === 'blocked' ? 'status-expired' : 'status-active'}">${d.status.toUpperCase()}</span>
            </div>
            <p class="text-sm text-gray-600 mb-2">User: ${d.username}</p>
            ${d.blocked_at ? `<p class="text-xs text-gray-400 mb-2">Blocked: ${formatDateShort(d.blocked_at)}</p>` : ''}
            <div class="mt-2">
                ${d.status === 'blocked'
            ? `<button onclick="unblockDevice('${d.device_id}')" class="btn-success text-xs px-3 py-1 w-full">Unblock</button>`
            : `<button onclick="blockDevice('${d.device_id}')" class="btn-error text-xs px-3 py-1 w-full">Block</button>`
        }
            </div>
        </div>
    `).join('');
}

function setupDeviceSearch(devices) {
    const searchInput = document.getElementById('deviceSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = devices.filter(d =>
                d.device_id.toLowerCase().includes(query) ||
                d.username.toLowerCase().includes(query)
            );
            renderBlockedDevicesTable(filtered);
        });
    }
}

async function blockDevice(deviceId) {
    if (!confirm(`Block device ${deviceId}? The user will not be able to login.`)) return;
    try {
        const response = await fetch(`/api/admin/blocked-devices/${deviceId}/block`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Manually blocked by admin' })
        });
        const data = await response.json();
        if (data.success) {
            addRecentActivity(`Device ${deviceId} blocked`, 'warning');
            loadBlockedDevices();
        } else {
            showAlert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error blocking device:', error);
        showAlert('Network error while blocking device');
    }
}

async function unblockDevice(deviceId) {
    if (!confirm(`Unblock device ${deviceId}?`)) return;
    try {
        const response = await fetch(`/api/admin/blocked-devices/${deviceId}/unblock`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            addRecentActivity(`Device ${deviceId} unblocked`, 'success');
            loadBlockedDevices();
        } else {
            showAlert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error unblocking device:', error);
        showAlert('Network error while unblocking device');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadBlockedDevices();
    const refreshBtn = document.getElementById('refreshBlockedDevices');
    if (refreshBtn) refreshBtn.addEventListener('click', loadBlockedDevices);
});
