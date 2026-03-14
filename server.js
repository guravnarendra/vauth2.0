const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database connections
const connectDB = require('./config/database');
require('./config/firebase'); // Initialize Firebase

// Import routes
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ipIntelRoutes = require('./routes/ipIntel');

// Import middleware
const { cleanupExpiredData } = require('./middleware/cleanup');

// Import Firebase token manager
const firebaseTokenManager = require('./utils/firebaseTokenManager');
const BlockedIP = require('./models/BlockedIP');

// Initialize Express app
const app = express();
app.set('trust proxy', 1); // ✅ must be after `app = express()`

// Create HTTP & WebSocket servers
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000 // send ping every 25 seconds
});

// Problem 10 Fix: Validate environment variables
const requiredEnvVars = ['MONGODB_URI', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Connect to MongoDB
connectDB();

// Initialize Firebase real-time listeners
firebaseTokenManager.setupRealTimeListeners(io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // disabled for development
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

// Rate limiters (with IP tracking for admin dashboard)
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 900000, // 15 min
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 5,
  message: { success: false, message: 'Too many login attempts, your IP has been blocked. Contact admin.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res, next, options) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const username = req.body.username || 'Unknown';
    try {
      await BlockedIP.blockIP(clientIP, username, options.max, 'Rate limit exceeded: too many login attempts');
      console.log(`🚫 IP ${clientIP} blocked due to rate limiting (user: ${username})`);
      const io = req.app.get('io');
      if (io) {
        io.to('admin').emit('ip-blocked', { ip: clientIP, username, reason: 'Rate limit exceeded' });
      }
    } catch (e) { console.error('Failed to save blocked IP:', e); }
    res.status(options.statusCode).json(options.message);
  }
});

const tokenLimiter = rateLimit({
  windowMs: parseInt(process.env.TOKEN_RATE_LIMIT_WINDOW_MS) || 300000, // 5 min
  max: parseInt(process.env.TOKEN_RATE_LIMIT_MAX_ATTEMPTS) || 10,
  message: { success: false, message: 'Too many token verification attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res, next, options) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    try {
      await BlockedIP.blockIP(clientIP, 'Unknown', options.max, 'Rate limit exceeded: too many token attempts');
      const io = req.app.get('io');
      if (io) {
        io.to('admin').emit('ip-blocked', { ip: clientIP, reason: 'Token rate limit exceeded' });
      }
    } catch (e) { console.error('Failed to save blocked IP:', e); }
    res.status(options.statusCode).json(options.message);
  }
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // lazy update every 24h
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // secure in production only
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  },
  name: 'vauth.sid'
}));

// Role-based session middleware to prevent overwriting
app.use((req, res, next) => {
  if (req.path.startsWith('/admin') || req.path.startsWith('/api/admin')) {
    req.sessionRole = 'admin';
  } else {
    req.sessionRole = 'user';
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Make socket.io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Apply rate limits to specific routes
app.use('/api/user/login', loginLimiter);
app.use('/api/user/verify-token', tokenLimiter);
app.use('/api/admin/login', loginLimiter);

// API Routes
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/', ipIntelRoutes);

// Main Frontend Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// User Routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user', 'login.html'));
});

app.get('/2fa', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user', '2fa.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user', 'dashboard.html'));
});

// Admin page auth middleware (redirects to login page)
function requireAdminPage(req, res, next) {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  next();
}

// Admin Routes
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

// Protected admin pages
const adminPages = ['dashboard', 'add-user', 'users', 'tokens', 'sessions', 'virtual-device', 'block-device', 'rate-limiting', 'pc-agent-health'];
app.get('/admin', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});
adminPages.forEach(page => {
  if (page !== 'dashboard') {
    app.get(`/admin/${page}`, requireAdminPage, (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'admin', `${page}.html`));
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const mongoose = require('mongoose');
  const { db: firebaseDb } = require('./config/firebase');

  let mongodbStatus = 'disconnected';
  try {
    if (mongoose.connection.readyState === 1) mongodbStatus = 'connected';
  } catch (e) { mongodbStatus = 'error'; }

  let firebaseStatus = 'disconnected';
  try {
    // Simple check if firebase is initialized and responding
    await firebaseDb.ref('.info/connected').once('value');
    firebaseStatus = 'connected';
  } catch (e) { firebaseStatus = 'error'; }

  const status = (mongodbStatus === 'connected' && firebaseStatus === 'connected') ? 'OK' : 'DEGRADED';

  res.json({
    status,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      mongodb: mongodbStatus,
      firebase: firebaseStatus
    },
    uptime: process.uptime()
  });
});

// Socket.io Real-time Handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Admin joins monitoring room
  socket.on('join-admin', () => {
    socket.join('admin');
    console.log('Admin joined real-time monitoring:', socket.id);

    // Send welcome message with current system status
    socket.emit('admin-welcome', {
      message: 'Welcome to VAUTH Admin Dashboard',
      timestamp: new Date(),
      systemStatus: 'online'
    });
  });

  // Handle token refresh requests
  socket.on('refresh-tokens', async () => {
    try {
      console.log('Manual token refresh requested by:', socket.id);
      // You can add any real-time token refresh logic here
      socket.emit('tokens-refreshed', {
        message: 'Tokens refreshed successfully',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      socket.emit('refresh-error', {
        message: 'Failed to refresh tokens',
        error: error.message
      });
    }
  });

  // Handle session monitoring requests
  socket.on('monitor-sessions', () => {
    console.log('Session monitoring started for:', socket.id);
    socket.emit('sessions-monitoring-started', {
      message: 'Session monitoring activated',
      timestamp: new Date()
    });
  });

  // Disconnects
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);

    // Emit admin left event if they were in admin room
    if (socket.rooms.has('admin')) {
      socket.to('admin').emit('admin-left', {
        adminId: socket.id,
        timestamp: new Date()
      });
    }
  });

  // Handle socket errors
  socket.on('error', (error) => {
    console.error('Socket error:', socket.id, error);
  });

  // Handle connection heartbeat
  socket.on('heartbeat', (data) => {
    socket.emit('heartbeat-ack', {
      timestamp: new Date(),
      clientId: socket.id
    });
  });
});

// Cleanup expired data every 5 minutes
setInterval(cleanupExpiredData, 5 * 60 * 1000);

// System status monitoring
setInterval(() => {
  const systemStatus = {
    timestamp: new Date(),
    connectedClients: io.engine.clientsCount,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };

  // Emit system status to admin room
  io.to('admin').emit('system-status', systemStatus);
}, 30000); // Every 30 seconds

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🔴 Received SIGINT. Shutting down gracefully...');

  const mongoose = require('mongoose');

  // Close socket.io connections
  io.close(() => {
    console.log('✅ Socket.IO server closed');
  });

  // Close MongoDB connection
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (err) {
    console.error('Error closing MongoDB:', err);
  }

  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.log('⚠️  Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGTERM', () => {
  console.log('\n🔴 Received SIGTERM. Shutting down gracefully...');

  io.close(() => {
    console.log('✅ Socket.IO server closed');
  });

  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('⚠️  Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ VAUTH Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💡 Access: http://localhost:${PORT}`);
  console.log(`🔧 Firebase: ${process.env.FIREBASE_PROJECT_ID ? 'Configured' : 'Not configured'}`);
  console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'MongoDB + Firebase' : 'Not configured'}`);
});

module.exports = { app, io, server };