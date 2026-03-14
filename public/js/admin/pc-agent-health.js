// Admin PC-Agent Health Section JS
// Load Pc-agent health data (REAL DATA)
async function loadPcAgentHealth() {
    try {
        const response = await fetch('/api/admin/pc-agent-health');
        const data = await response.json();

        if (data.success) {
            // Status card
            const statusText = document.getElementById('pcAgentStatusText');
            statusText.textContent = data.status === 'OK' ? 'Online' : 'Degraded';
            statusText.className = `text-2xl md:text-3xl font-bold ${data.status === 'OK' ? 'text-green-600' : 'text-red-600'} count-animation`;

            // Last check
            document.getElementById('pcAgentLastCheck').textContent = new Date(data.timestamp).toLocaleTimeString();

            // Uptime
            document.getElementById('pcAgentUptime').textContent = data.system.uptime;

            // CPU
            document.getElementById('pcAgentCpuUsage').textContent = data.cpu.usage + '%';
            document.getElementById('pcAgentCpuCores').textContent = data.cpu.cores + ' cores';

            // Memory
            document.getElementById('pcAgentMemUsage').textContent = data.memory.usage + '%';
            document.getElementById('pcAgentMemDetail').textContent = data.memory.used + ' / ' + data.memory.total;

            // API link
            const apiLinkEl = document.getElementById('pcAgentApiLink');
            if (apiLinkEl) apiLinkEl.textContent = data.apiLink;

            // Health indicators
            setHealthDot('healthDotCore', 'healthTextCore', true, 'Running');
            setHealthDot('healthDotDb', 'healthTextDb', data.database.status === 'Connected', data.database.status);
            setHealthDot('healthDotDbTime', 'healthTextDbTime', data.database.responseTimeMs < 200, data.database.responseTime);
            setHealthDot('healthDotMem', 'healthTextMem', data.memory.usage < 80, data.memory.usage + '%');
            setHealthDot('healthDotCpu', 'healthTextCpu', data.cpu.usage < 80, data.cpu.usage + '%');

            // System info
            document.getElementById('sysInfoPlatform').textContent = data.system.platform;
            document.getElementById('sysInfoArch').textContent = data.system.arch;
            document.getElementById('sysInfoHostname').textContent = data.system.hostname;
            document.getElementById('sysInfoNode').textContent = data.system.nodeVersion;
            document.getElementById('sysInfoSessions').textContent = data.application.activeSessions;
            document.getElementById('sysInfoUsers').textContent = data.application.totalUsers;
        }
    } catch (error) {
        console.error('Error loading Pc-agent health:', error);
        const statusText = document.getElementById('pcAgentStatusText');
        if (statusText) {
            statusText.textContent = 'Offline';
            statusText.className = 'text-2xl md:text-3xl font-bold text-red-600 count-animation';
        }
        document.getElementById('pcAgentLastCheck').textContent = new Date().toLocaleTimeString();
    }
}

// Helper to set health indicator dot and text
function setHealthDot(dotId, textId, isHealthy, text) {
    const dot = document.getElementById(dotId);
    const textEl = document.getElementById(textId);
    if (dot) dot.className = `w-3 h-3 rounded-full mr-3 ${isHealthy ? 'bg-green-500' : 'bg-yellow-500'}`;
    if (textEl) {
        textEl.textContent = text;
        textEl.className = `text-sm font-semibold ${isHealthy ? 'text-green-600' : 'text-yellow-600'}`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadPcAgentHealth();
    const refreshBtn = document.getElementById('refreshPcAgentHealth');
    if (refreshBtn) refreshBtn.addEventListener('click', loadPcAgentHealth);

    // Copy API link
    const copyBtn = document.getElementById('copyApiLink');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const link = document.getElementById('pcAgentApiLink');
            if (link) {
                navigator.clipboard.writeText(link.textContent.trim()).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                });
            }
        });
    }
});
