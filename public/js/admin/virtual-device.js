// Admin Virtual Device Section JS
// Handle virtual token generation
async function handleVirtualToken(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const deviceId = formData.get('device_id');

    try {
        const response = await fetch('/api/admin/virtual-device/generate-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ device_id: deviceId })
        });

        const data = await response.json();

        if (data.success) {
            // Show generated token
            document.getElementById('generatedToken').textContent = data.token;
            document.getElementById('tokenExpiry').textContent = formatDate(data.expires_at);
            document.getElementById('tokenDisplay').classList.remove('hidden');

            // Reset form
            e.target.reset();

            addRecentActivity(`Virtual token generated for device ${deviceId}`, 'success');
        } else {
            showAlert('Error generating token: ' + data.message);
            addRecentActivity(`Failed to generate token for device ${deviceId}`, 'error');
        }
    } catch (error) {
        console.error('Error generating virtual token:', error);
        showAlert('Network error. Please try again.');
        addRecentActivity('Network error while generating token', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('virtualTokenForm');
    if (form) form.addEventListener('submit', handleVirtualToken);
});
