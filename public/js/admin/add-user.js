// Admin Add User Section JS
// Handle add user form submission
async function handleAddUser(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const userData = Object.fromEntries(formData);

    try {
        const response = await fetch('/api/admin/add-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (data.success) {
            // Show generated credentials
            document.getElementById('genUsername').textContent = data.credentials.username;
            document.getElementById('genPassword').textContent = data.credentials.password;
            document.getElementById('genDeviceId').textContent = data.credentials.vauth_device_ID;
            document.getElementById('credentialsDisplay').classList.remove('hidden');

            // Reset form
            e.target.reset();

            // Refresh stats
            loadDashboardStats();

            addRecentActivity(`New user created: ${userData.name}`, 'success');
        } else {
            showAlert('Error creating user: ' + data.message);
            addRecentActivity(`Failed to create user: ${userData.name}`, 'error');
        }
    } catch (error) {
        console.error('Error adding user:', error);
        showAlert('Network error. Please try again.');
        addRecentActivity('Network error while creating user', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('addUserForm');
    if (form) form.addEventListener('submit', handleAddUser);
});
