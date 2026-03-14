const express = require('express');
const os = require('os');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Token = require('../models/Token');
const Session = require('../models/Session');
const BlockedDevice = require('../models/BlockedDevice');
const BlockedIP = require('../models/BlockedIP');
const { autoDeleteExpiredTokens } = require('../middleware/cleanup');
const router = express.Router();

// Auto-delete expired tokens setting
let autoDeleteEnabled = false;
/**
 * Admin authentication middleware
 */
function requireAdminAuth(req, res, next) {
    if (!req.session.isAdmin) {
        return res.status(401).json({
            success: false,
            message: 'Admin authentication required'
        });
    }
    next();
}

/**
 * POST /api/admin/login
 * Admin login with credentials from .env
 */
router.post('/login', [
    body('username').trim().isLength({ min: 1 }).withMessage('Username is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { username, password } = req.body;

        // Check against environment variables
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            req.session.isAdmin = true;
            req.session.adminUsername = username;

            res.json({
                success: true,
                message: 'Admin login successful'
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * POST /api/admin/logout
 * Admin logout
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Admin session destruction error:', err);
        }
        res.json({
            success: true,
            message: 'Admin logged out successfully'
        });
    });
});

/**
 * POST /api/admin/add-user
 * Add new user with encrypted PII
 */
router.post('/add-user', requireAdminAuth, [
    body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('mobile').trim().isLength({ min: 10 }).withMessage('Valid mobile number is required'),
    body('operating_country').trim().isLength({ min: 1 }).withMessage('Operating country is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { name, email, mobile, operating_country } = req.body;

        // Generate credentials
        const username = generateUsername(name);
        const password = generatePassword();
        const vauth_device_ID = generateDeviceID();

        // Check for uniqueness
        const existingUser = await User.findOne({
            $or: [
                { username },
                { vauth_device_ID }
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Generated credentials conflict with existing user. Please try again.'
            });
        }

        // Create user with encrypted PII
        const user = await User.createUser({
            name,
            email,
            mobile,
            operating_country,
            username,
            password,
            vauth_device_ID
        });

        res.json({
            success: true,
            message: 'User created successfully',
            credentials: {
                username,
                password,
                vauth_device_ID
            }
        });

    } catch (error) {
        console.error('Add user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/admin/users
 * Get list of all users
 */
router.get('/users', requireAdminAuth, async (req, res) => {
    try {
        const users = await User.find({}, {
            password_hash: 0 // Exclude password hash
        }).sort({ created_at: -1 });

        const userList = users.map(user => user.getDecryptedData());

        res.json({
            success: true,
            users: userList
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/admin/tokens
 * Get list of all tokens with status and expiry
 */
router.get('/tokens', requireAdminAuth, async (req, res) => {
    try {
        // FIXED: Get tokens array and sort manually
        const tokens = await Token.find({});

        // Sort by created_at descending (newest first)
        const sortedTokens = tokens.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const tokenList = sortedTokens.map(token => ({
            _id: token._id,
            device_id: token.device_id,
            status: token.status,
            created_at: token.created_at,
            expires_at: token.expires_at,
            used_at: token.used_at,
            timeRemaining: token.timeRemaining || calculateTimeRemaining(token)
        }));

        res.json({
            success: true,
            tokens: tokenList,
            autoDeleteEnabled
        });
    } catch (error) {
        console.error('Get tokens error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Helper function to calculate time remaining
function calculateTimeRemaining(token) {
    if (token.status !== 'ACTIVE') return 0;
    const now = new Date();
    const expiresAt = new Date(token.expires_at);
    const remaining = Math.max(0, expiresAt - now);
    return Math.floor(remaining / 1000);
}

/**
 * DELETE /api/admin/tokens/:tokenId
 * Delete specific token
 */
router.delete('/tokens/:tokenId', requireAdminAuth, async (req, res) => {
    try {
        const { tokenId } = req.params;
        const result = await Token.findByIdAndDelete(tokenId);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Token not found'
            });
        }

        res.json({
            success: true,
            message: 'Token deleted successfully'
        });
    } catch (error) {
        console.error('Delete token error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


/**
 * PATCH /api/admin/auto-delete-expired
 * Toggle auto-delete expired tokens
 */
router.patch('/auto-delete-expired', requireAdminAuth, async (req, res) => {
    try {
        autoDeleteEnabled = !autoDeleteEnabled;

        if (autoDeleteEnabled) {
            // Run auto-delete immediately
            const deletedCount = await autoDeleteExpiredTokens();

            res.json({
                success: true,
                message: `Auto-delete enabled. Deleted ${deletedCount} expired tokens.`,
                autoDeleteEnabled
            });
        } else {
            res.json({
                success: true,
                message: 'Auto-delete disabled.',
                autoDeleteEnabled
            });
        }

    } catch (error) {
        console.error('Toggle auto-delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/admin/sessions
 * Get list of active sessions
 */
router.get('/sessions', requireAdminAuth, async (req, res) => {
    try {
        const sessions = await Session.getActiveSessions();

        const sessionList = sessions.map(session => ({
            _id: session._id,
            username: session.username,
            device_id: session.device_id,
            ip: session.ip,
            started_at: session.started_at,
            expires_at: session.expires_at,
            status: session.status,
            timeRemaining: session.timeRemaining,
            duration: session.duration
        }));

        res.json({
            success: true,
            sessions: sessionList
        });

    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * POST /api/admin/sessions/:sessionId/force-logout
 * Force logout specific session
 */
router.post('/sessions/:sessionId/force-logout', requireAdminAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const success = await Session.forceLogout(sessionId);

        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Session not found or already inactive'
            });
        }

        // Emit real-time event
        req.io.to('admin').emit('session-force-logout', {
            sessionId,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Session force logout successful'
        });

    } catch (error) {
        console.error('Force logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * POST /api/admin/virtual-device/generate-token
 * Generate token for virtual device
 */
router.post('/virtual-device/generate-token', requireAdminAuth, [
    body('device_id').trim().isLength({ min: 1 }).withMessage('Device ID is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { device_id } = req.body;

        // Check if device exists
        const user = await User.findOne({ vauth_device_ID: device_id });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Device ID not found'
            });
        }

        // Generate token
        const expirySeconds = parseInt(process.env.TOKEN_EXPIRY_SECONDS) || 300;
        const tokenResult = await Token.createToken(device_id, expirySeconds);

        // Emit real-time event
        req.io.to('admin').emit('virtual-token-generated', {
            device_id,
            token: tokenResult.plain_token,
            expires_at: tokenResult.token.expires_at,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Token generated successfully',
            token: tokenResult.plain_token,
            expires_at: tokenResult.token.expires_at
        });

    } catch (error) {
        console.error('Generate virtual token error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/admin/dashboard-stats
 * Get dashboard statistics
 */
router.get('/dashboard-stats', requireAdminAuth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();

        // FIXED: Get all tokens and filter manually
        const allTokens = await Token.find({});
        const activeTokens = allTokens.filter(token => token.status === 'ACTIVE').length;
        const expiredTokens = allTokens.filter(token => token.status === 'EXPIRED').length;

        const activeSessions = await Session.countDocuments({ status: 'ACTIVE' });

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeTokens,
                activeSessions,
                expiredTokens,
                autoDeleteEnabled
            }
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * POST /api/admin/sessions/force-logout-all
 * Force logout all active sessions
 */
router.post('/sessions/force-logout-all', requireAdminAuth, async (req, res) => {
    try {
        const result = await Session.updateMany(
            { status: 'ACTIVE' },
            { $set: { status: 'EXPIRED' } }
        );

        req.io.to('admin').emit('security-alert', {
            type: 'BULK_LOGOUT',
            count: result.modifiedCount,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: `Successfully logged out ${result.modifiedCount} sessions`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * Helper functions for generating credentials
 */
function generateUsername(name) {
    const cleanName = name.toLowerCase().replace(/[^a-z]/g, '');
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${cleanName}${randomNum}`;
}

function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function generateDeviceID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let deviceId = 'VAUTH-';
    for (let i = 0; i < 8; i++) {
        deviceId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return deviceId;
}

// Auto-delete expired tokens if enabled (runs every 10 minutes)
setInterval(async () => {
    if (autoDeleteEnabled) {
        try {
            await autoDeleteExpiredTokens();
        } catch (error) {
            console.error('Auto-delete interval error:', error);
        }
    }
}, 10 * 60 * 1000);

/**
 * GET /api/admin/session-status
 * Check if admin is currently authenticated
 */
router.get('/session-status', (req, res) => {
    res.json({
        success: true,
        authenticated: !!req.session.isAdmin,
        username: req.session.adminUsername || null
    });
});

// ========== BLOCKED DEVICE MANAGEMENT ==========

/**
 * GET /api/admin/blocked-devices
 * List all devices with block status
 */
router.get('/blocked-devices', requireAdminAuth, async (req, res) => {
    try {
        // Get all users to list all device IDs
        const users = await User.find({}, 'username vauth_device_ID');
        const blockedDevices = await BlockedDevice.listAll();
        const blockedMap = {};
        blockedDevices.forEach(d => {
            blockedMap[d.device_id] = d;
        });

        const deviceList = users.map(user => {
            const blocked = blockedMap[user.vauth_device_ID];
            return {
                device_id: user.vauth_device_ID,
                username: user.username,
                status: blocked && blocked.status === 'blocked' ? 'blocked' : 'active',
                reason: blocked ? blocked.reason : null,
                blocked_at: blocked && blocked.status === 'blocked' ? blocked.blocked_at : null,
                unblocked_at: blocked ? blocked.unblocked_at : null
            };
        });

        const totalBlocked = deviceList.filter(d => d.status === 'blocked').length;
        const totalActive = deviceList.filter(d => d.status === 'active').length;

        res.json({
            success: true,
            devices: deviceList,
            stats: {
                total: deviceList.length,
                blocked: totalBlocked,
                active: totalActive
            }
        });
    } catch (error) {
        console.error('Error fetching blocked devices:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch devices' });
    }
});

/**
 * POST /api/admin/blocked-devices/:deviceId/block
 * Block a VAUTH device
 */
router.post('/blocked-devices/:deviceId/block', requireAdminAuth, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { reason } = req.body;
        await BlockedDevice.blockDevice(deviceId, reason || 'Manually blocked by admin');

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('device-blocked', { device_id: deviceId, reason });
        }

        res.json({ success: true, message: `Device ${deviceId} has been blocked` });
    } catch (error) {
        console.error('Error blocking device:', error);
        res.status(500).json({ success: false, message: 'Failed to block device' });
    }
});

/**
 * POST /api/admin/blocked-devices/:deviceId/unblock
 * Unblock a VAUTH device
 */
router.post('/blocked-devices/:deviceId/unblock', requireAdminAuth, async (req, res) => {
    try {
        const { deviceId } = req.params;
        await BlockedDevice.unblockDevice(deviceId);

        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('device-unblocked', { device_id: deviceId });
        }

        res.json({ success: true, message: `Device ${deviceId} has been unblocked` });
    } catch (error) {
        console.error('Error unblocking device:', error);
        res.status(500).json({ success: false, message: 'Failed to unblock device' });
    }
});

// ========== RATE LIMITING / IP BLOCKING ==========

/**
 * GET /api/admin/blocked-ips
 * List all blocked IPs from rate limiting
 */
router.get('/blocked-ips', requireAdminAuth, async (req, res) => {
    try {
        const blockedIPs = await BlockedIP.listAll();
        const totalBlocked = blockedIPs.filter(ip => ip.status === 'blocked').length;
        const autoBlocked = blockedIPs.filter(ip => ip.auto_blocked && ip.status === 'blocked').length;

        res.json({
            success: true,
            blockedIPs,
            stats: {
                total: blockedIPs.length,
                currentlyBlocked: totalBlocked,
                autoBlocked: autoBlocked,
                manuallyBlocked: totalBlocked - autoBlocked
            }
        });
    } catch (error) {
        console.error('Error fetching blocked IPs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch blocked IPs' });
    }
});

/**
 * POST /api/admin/blocked-ips/:ip/unblock
 * Unblock an IP address
 */
router.post('/blocked-ips/:ip/unblock', requireAdminAuth, async (req, res) => {
    try {
        const { ip } = req.params;
        await BlockedIP.unblockIP(ip);

        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('ip-unblocked', { ip });
        }

        res.json({ success: true, message: `IP ${ip} has been unblocked` });
    } catch (error) {
        console.error('Error unblocking IP:', error);
        res.status(500).json({ success: false, message: 'Failed to unblock IP' });
    }
});

// ========== PC-AGENT HEALTH (REAL-TIME) ==========

/**
 * GET /api/admin/pc-agent-health
 * Returns real-time system health data for hardware device integration
 */
router.get('/pc-agent-health', requireAdminAuth, async (req, res) => {
    try {
        const mongoose = require('mongoose');

        // Real system metrics
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = ((usedMem / totalMem) * 100).toFixed(1);

        const cpus = os.cpus();
        let totalIdle = 0, totalTick = 0;
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        const cpuUsage = (100 - ((totalIdle / totalTick) * 100)).toFixed(1);

        const uptimeSeconds = os.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptimeFormatted = `${days}d ${hours}h ${minutes}m`;

        // DB health
        const dbState = mongoose.connection.readyState;
        const dbStates = { 0: 'Disconnected', 1: 'Connected', 2: 'Connecting', 3: 'Disconnecting' };
        const dbStatus = dbStates[dbState] || 'Unknown';

        // Measure DB response time
        const dbStart = Date.now();
        try {
            await mongoose.connection.db.admin().ping();
        } catch (e) { /* ignore */ }
        const dbResponseTime = Date.now() - dbStart;

        // Active sessions / users count
        const activeSessions = await Session.countDocuments({ status: 'active', expires_at: { $gt: new Date() } });
        const totalUsers = await User.countDocuments();

        // Build the API link for hardware
        const protocol = req.protocol;
        const host = req.get('host');
        const apiLink = `${protocol}://${host}/ip-intel`;

        res.json({
            success: true,
            status: 'OK',
            timestamp: new Date().toISOString(),
            apiLink,
            system: {
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                nodeVersion: process.version,
                uptime: uptimeFormatted,
                uptimeSeconds
            },
            cpu: {
                usage: parseFloat(cpuUsage),
                cores: cpus.length,
                model: cpus[0] ? cpus[0].model : 'Unknown'
            },
            memory: {
                total: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                used: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                free: (freeMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                usage: parseFloat(memoryUsage)
            },
            database: {
                status: dbStatus,
                responseTime: dbResponseTime + 'ms',
                responseTimeMs: dbResponseTime
            },
            application: {
                activeSessions,
                totalUsers,
                environment: process.env.NODE_ENV || 'development'
            }
        });
    } catch (error) {
        console.error('Error getting pc-agent health:', error);
        res.status(500).json({ success: false, status: 'ERROR', message: 'Health check failed' });
    }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user
 */
router.delete('/users/:userId', requireAdminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // End all active sessions for this user
        await Session.updateMany(
            { username: user.username, status: 'active' },
            { status: 'expired' }
        );

        await User.findByIdAndDelete(userId);

        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('user-deleted', { username: user.username });
        }

        res.json({ success: true, message: `User ${user.username} deleted successfully` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

module.exports = router;
