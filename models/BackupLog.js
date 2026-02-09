const mongoose = require('mongoose');

const backupLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['manual', 'auto'],
    default: 'auto'
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true
  },
  size: {
    type: Number // in bytes
  },
  location: {
    type: String
  },
  error: String
});

backupLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('BackupLog', backupLogSchema);
