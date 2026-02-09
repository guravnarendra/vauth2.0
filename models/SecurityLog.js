const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  event: {
    type: String,
    required: true
  },
  user: {
    type: String
  },
  ip: {
    type: String
  },
  device_info: {
    type: mongoose.Schema.Types.Mixed
  },
  location: {
    city: String,
    country: String
  },
  risk_score: {
    type: Number,
    default: 0
  }
});

securityLogSchema.index({ timestamp: -1 });
securityLogSchema.index({ user: 1 });

module.exports = mongoose.model('SecurityLog', securityLogSchema);
