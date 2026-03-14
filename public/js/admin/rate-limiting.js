// Admin Rate Limiting Section JS
async function loadBlockedIPs() {
    try {
        const response = await fetch('/api/admin/blocked-ips');
        const data = await response.json();

        if (data.success) {
            // Update stats
            document.getElementById('totalIPRecords').textContent = data.stats.total;
            document.getElementById('currentlyBlockedIPs').textContent = data.stats.currentlyBlocked;
            document.getElementById('autoBlockedIPs').textContent = data.stats.autoBlocked;
            document.getElementById('manualBlockedIPs').textContent = data.stats.manuallyBlocked;

            renderBlockedIPsTable(data.blockedIPs);
        }
    } catch (error) {
        console.error('Error loading blocked IPs:', error);
        addRecentActivity('Failed to load blocked IPs', 'error');
    }
}

function renderBlockedIPsTable(ips) {
    const tbody = document.getElementById('blockedIPsTableBody');
    const mobileTable = document.getElementById('blockedIPsMobileTable');

    if (ips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No blocked IPs found. The system is clean!</td></tr>';
        mobileTable.innerHTML = '<p class="text-center text-gray-500 py-4">No blocked IPs found</p>';
        return;
    }

    // Desktop table
    tbody.innerHTML = ips.map(ip => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4"><span class="font-mono text-sm font-semibold">${ip.ip}</span></td>
            <td class="px-6 py-4 text-sm text-gray-700">${ip.username || 'Unknown'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${ip.reason}</td>
            <td class="px-6 py-4 text-sm text-gray-700 font-semibold">${ip.attempts_count}</td>
            <td class="px-6 py-4">
                <span class="status-badge ${ip.status === 'blocked' ? 'status-expired' : 'status-active'}">${ip.status.toUpperCase()}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">${formatDateShort(ip.blocked_at)}</td>
            <td class="px-6 py-4">
                ${ip.status === 'blocked'
            ? `<button onclick="unblockIP('${ip.ip}')" class="btn-success text-xs px-3 py-1">Unblock</button>`
            : '<span class="text-xs text-gray-400">Unblocked</span>'
        }
            </td>
        </tr>
    `).join('');

    // Mobile table
    mobileTable.innerHTML = ips.map(ip => `
        <div class="mobile-table-card">
            <div class="flex justify-between items-start mb-2">
                <span class="font-mono text-sm font-semibold">${ip.ip}</span>
                <span class="status-badge ${ip.status === 'blocked' ? 'status-expired' : 'status-active'}">${ip.status.toUpperCase()}</span>
            </div>
            <p class="text-sm text-gray-600">User: ${ip.username || 'Unknown'}</p>
            <p class="text-xs text-gray-400">${ip.reason}</p>
            <p class="text-xs text-gray-400">Attempts: ${ip.attempts_count} | Blocked: ${formatDateShort(ip.blocked_at)}</p>
            ${ip.status === 'blocked'
            ? `<button onclick="unblockIP('${ip.ip}')" class="btn-success text-xs px-3 py-1 w-full mt-2">Unblock</button>`
            : ''
        }
        </div>
    `).join('');
}

async function unblockIP(ip) {
    if (!confirm(`Unblock IP ${ip}?`)) return;
    try {
        const response = await fetch(`/api/admin/blocked-ips/${ip}/unblock`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            addRecentActivity(`IP ${ip} unblocked`, 'success');
            loadBlockedIPs();
        } else {
            showAlert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error unblocking IP:', error);
        showAlert('Network error while unblocking IP');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadBlockedIPs();
    const refreshBtn = document.getElementById('refreshBlockedIPs');
    if (refreshBtn) refreshBtn.addEventListener('click', loadBlockedIPs);
});
