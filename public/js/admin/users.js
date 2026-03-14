// Admin Users Section JS
// Load users data
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();

        if (data.success) {
            // Update desktop table
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '';

            // Update mobile table
            const mobileTable = document.getElementById('usersMobileTable');
            mobileTable.innerHTML = '';

            if (data.users.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="px-6 py-12 text-center text-gray-500">
                            <div class="flex flex-col items-center">
                                <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                                </svg>
                                <p class="text-gray-500 text-lg">No users found</p>
                                <p class="text-gray-400 text-sm mt-1">Users will appear here once created</p>
                            </div>
                        </td>
                    </tr>
                `;
                mobileTable.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                        </svg>
                        <p class="text-gray-500 text-lg">No users found</p>
                        <p class="text-gray-400 text-sm mt-1">Users will appear here once created</p>
                    </div>
                `;
                return;
            }

            // Desktop table
            data.users.forEach(user => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition-all duration-200';
                row.innerHTML = `
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center text-white font-semibold text-sm mr-4">
                                ${user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="text-sm font-semibold text-gray-900">${user.name}</div>
                                <div class="text-xs text-gray-500">${user.email || 'No email'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900 font-medium">${user.username}</td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 font-mono">
                            ${user.vauth_device_ID}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(user.created_at)}</td>
                `;
                tbody.appendChild(row);
            });

            // Mobile cards
            data.users.forEach(user => {
                const card = document.createElement('div');
                card.className = 'mobile-table-card';
                card.innerHTML = `
                    <div class="flex items-center mb-4">
                        <div class="w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center text-white font-semibold text-lg mr-4">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1">
                            <h3 class="font-semibold text-gray-900 text-lg">${user.name}</h3>
                            <p class="text-gray-600 text-sm">${user.username}</p>
                            ${user.email ? `<p class="text-gray-500 text-xs mt-1">${user.email}</p>` : ''}
                        </div>
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span class="text-sm font-medium text-gray-700">Device ID</span>
                            <span class="text-sm font-mono text-primary font-semibold">${user.vauth_device_ID}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span class="text-sm font-medium text-gray-700">Created</span>
                            <span class="text-sm text-gray-600">${formatDate(user.created_at)}</span>
                        </div>
                    </div>
                `;
                mobileTable.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error loading users:', error);
        addRecentActivity('Failed to load user data', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    const refreshBtn = document.getElementById('refreshUsers');
    if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);
});
