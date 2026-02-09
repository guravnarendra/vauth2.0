const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  dark_mode: {
    type: Boolean,
    default: false
  },
  table_prefs: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  notifications: {
    email: { type: Boolean, default: true },
    desktop: { type: Boolean, default: true },
    sound: { type: Boolean, default: true }
  }
});

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);
