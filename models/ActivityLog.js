const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['success', 'error', 'warning', 'info'],
    default: 'info'
  },
  user: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  ip: {
    type: String
  },
  status: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  admin_id: {
    type: String // To track which admin performed the action
  }
});

activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ user: 1 });
activityLogSchema.index({ type: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
