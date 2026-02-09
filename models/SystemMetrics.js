const mongoose = require('mongoose');

const systemMetricsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  db_type: {
    type: String,
    enum: ['mongodb', 'firebase'],
    required: true
  },
  health_percent: {
    type: Number,
    required: true
  },
  response_time: {
    type: Number, // in ms
    required: true
  },
  connection_count: {
    type: Number,
    required: true
  },
  cpu_usage: Number,
  memory_usage: Number
});

systemMetricsSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SystemMetrics', systemMetricsSchema);
