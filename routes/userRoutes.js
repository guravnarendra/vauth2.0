const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Token = require('../models/Token');
const Session = require('../models/Session');
const router = express.Router();

// Track failed login attempts for security alerts
const failedAttempts = new Map();

/**
 * POST /api/user/login
 * User login with username and password
 */
router.post('/login', [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { username, password } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;

        // Find user by username
        const user = await User.findOne({ username });
        
        if (!user) {
            // Track failed attempt
            trackFailedAttempt(username, clientIP, 'USER_NOT_FOUND', req.io);
            
            return res.status(401).json({
                success: false,
                message: 'User not exists'
            });
        }

        // Verify password
        const isValidPassword = await user.verifyPassword(password);
        
        if (!isValidPassword) {
            // Track failed attempt
            trackFailedAttempt(username, clientIP, 'INVALID_PASSWORD', req.io);
            
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Clear failed attempts on successful login
        failedAttempts.delete(username);

        // Emit real-time event for admin dashboard
        req.io.to('admin').emit('user-login-attempt', {
            username,
            ip: clientIP,
            success: true,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Login successful',
            vauth_device_ID: user.vauth_device_ID
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * POST /api/user/verify-token
 * Verify 2FA token and create session
 */
router.post('/verify-token', [
  body('device_id').trim().isLength({ min: 1 }).withMessage('Device ID is required'),
  body('token').trim().isLength({ min: 6, max: 6 }).withMessage('Token must be 6 characters')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { device_id, token } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Find user by device ID
    const user = await User.findOne({ vauth_device_ID: device_id });
    if (!user) {
      trackTokenFailure(device_id, clientIP, 'DEVICE_NOT_FOUND', req.io);
      return res.status(401).json({
        success: false,
        message: 'Invalid device'
      });
    }

    // Verify token using Firebase
    const tokenResult = await Token.verifyToken(device_id, token);
    
    if (!tokenResult.valid) {
      let message = 'Invalid token';
      if (tokenResult.reason === 'TOKEN_EXPIRED') {
        message = 'Token expired';
      } else if (tokenResult.reason === 'TOKEN_NOT_FOUND') {
        message = 'Token invalid';
      }

      trackTokenFailure(device_id, clientIP, tokenResult.reason, req.io, user.username);
      return res.status(401).json({
        success: false,
        message: message
      });
    }

    // Create session
    const expiryMinutes = parseInt(process.env.SESSION_EXPIRY_MINUTES) || 10;
    const session = await Session.createSession(user.username, device_id, clientIP, expiryMinutes);

    // Store session in express session
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.sessionId = session._id;

    // Emit real-time events
    req.io.to('admin').emit('token-verification', {
      username: user.username,
      device_id,
      ip: clientIP,
      success: true,
      timestamp: new Date()
    });

    req.io.to('admin').emit('session-created', {
      username: user.username,
      device_id,
      ip: clientIP,
      sessionId: session._id,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Token verified successfully',
      sessionId: session._id
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


/**
 * POST /api/user/logout
 * End user session
 */
router.post('/logout', async (req, res) => {
    try {
        if (req.session.sessionId) {
            // Mark session as expired
            await Session.findByIdAndUpdate(req.session.sessionId, {
                status: 'EXPIRED'
            });

            // Emit real-time event
            req.io.to('admin').emit('user-logout', {
                username: req.session.username,
                sessionId: req.session.sessionId,
                timestamp: new Date()
            });
        }

        // Destroy express session
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/user/session-status
 * Check current session status
 */
router.get('/session-status', async (req, res) => {
    try {
        if (!req.session.sessionId) {
            return res.json({
                success: false,
                authenticated: false,
                message: 'No active session'
            });
        }

        const sessionResult = await Session.validateSession(req.session.sessionId);
        
        if (!sessionResult.valid) {
            // Clear invalid session
            req.session.destroy();
            
            return res.json({
                success: false,
                authenticated: false,
                message: sessionResult.reason
            });
        }

        // Get user data for profile
        const user = await User.findById(req.session.userId);
        const decryptedData = user ? user.getDecryptedData() : {};

        res.json({
            success: true,
            authenticated: true,
            username: req.session.username,
            timeRemaining: sessionResult.session.timeRemaining,
            profile: decryptedData
        });

    } catch (error) {
        console.error('Session status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * GET /api/user/active-sessions
 * Get all active sessions for the current user
 */
router.get('/active-sessions', async (req, res) => {
    try {
        if (!req.session.username) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const sessions = await Session.find({
            username: req.session.username,
            status: 'ACTIVE',
            expires_at: { $gt: new Date() }
        }).sort({ started_at: -1 });

        res.json({
            success: true,
            sessions: sessions.map(s => ({
                _id: s._id,
                device_id: s.device_id,
                ip: s.ip,
                location: s.location_city || 'Unknown',
                timeRemaining: s.timeRemaining,
                isCurrent: s._id.toString() === req.session.sessionId
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * POST /api/user/logout-all
 * Logout from all devices
 */
router.post('/logout-all', async (req, res) => {
    try {
        if (!req.session.username) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        await Session.updateMany(
            { username: req.session.username, status: 'ACTIVE' },
            { $set: { status: 'EXPIRED' } }
        );

        req.session.destroy();
        res.json({ success: true, message: 'Logged out from all devices' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * POST /api/user/change-password
 * Change user password
 */
router.post('/change-password', [
    body('currentPassword').isLength({ min: 1 }),
    body('newPassword').isLength({ min: 6 })
], async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.session.userId);

        if (!user || !(await user.verifyPassword(currentPassword))) {
            return res.status(400).json({ success: false, message: 'Invalid current password' });
        }

        user.password_hash = await User.hashPassword(newPassword);
        await user.save();

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

/**
 * POST /api/user/extend-session
 * Extend current session (Problem 6.1 Fix)
 */
router.post('/extend-session', async (req, res) => {
    try {
        if (!req.session.sessionId) {
            return res.status(401).json({
                success: false,
                message: 'No active session'
            });
        }

        const session = await Session.findById(req.session.sessionId);
        if (!session || session.status !== 'ACTIVE') {
            return res.status(401).json({
                success: false,
                message: 'Session invalid or expired'
            });
        }

        // Extend by another 10 minutes (or env value)
        const extensionMinutes = parseInt(process.env.SESSION_EXPIRY_MINUTES) || 10;
        session.expires_at = new Date(Date.now() + (extensionMinutes * 60 * 1000));
        await session.save();

        res.json({
            success: true,
            message: 'Session extended successfully',
            timeRemaining: session.timeRemaining
        });

    } catch (error) {
        console.error('Extend session error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * Track failed login attempts
 */
function trackFailedAttempt(username, ip, reason, io) {
    const key = username;
    const attempts = failedAttempts.get(key) || [];
    
    attempts.push({
        ip,
        reason,
        timestamp: new Date()
    });
    
    failedAttempts.set(key, attempts);
    
    // Check for multiple failed attempts
    if (attempts.length >= 3) {
        // Send alert to admin
        io.to('admin').emit('security-alert', {
            type: 'MULTIPLE_FAILED_LOGINS',
            username,
            attempts: attempts.length,
            lastIP: ip,
            timestamp: new Date()
        });
    }
    
    // Emit failed login event
    io.to('admin').emit('user-login-attempt', {
        username,
        ip,
        success: false,
        reason,
        timestamp: new Date()
    });
}

/**
 * Track failed token verification attempts
 */
function trackTokenFailure(device_id, ip, reason, io, username = null) {
    if (username) {
        const key = username;
        const attempts = failedAttempts.get(key) || [];
        
        attempts.push({
            ip,
            reason: 'INVALID_TOKEN',
            timestamp: new Date()
        });
        
        failedAttempts.set(key, attempts);
        
        // Check for multiple failed token attempts
        if (attempts.length >= 3) {
            io.to('admin').emit('security-alert', {
                type: 'MULTIPLE_FAILED_TOKENS',
                username,
                attempts: attempts.length,
                lastIP: ip,
                timestamp: new Date()
            });
        }
    }
    
    // Emit failed token verification event
    io.to('admin').emit('token-verification', {
        username,
        device_id,
        ip,
        success: false,
        reason,
        timestamp: new Date()
    });
}

module.exports = router;

