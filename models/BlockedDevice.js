const mongoose = require('mongoose');

const blockedDeviceSchema = new mongoose.Schema({
    device_id: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        default: ''
    },
    blocked_by: {
        type: String,
        default: 'admin'
    },
    reason: {
        type: String,
        default: 'Manually blocked by admin'
    },
    status: {
        type: String,
        enum: ['blocked', 'active'],
        default: 'blocked'
    },
    blocked_at: {
        type: Date,
        default: Date.now
    },
    unblocked_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Static: block a device
blockedDeviceSchema.statics.blockDevice = async function(device_id, reason = 'Manually blocked by admin') {
    const existing = await this.findOne({ device_id });
    if (existing) {
        existing.status = 'blocked';
        existing.reason = reason;
        existing.blocked_at = new Date();
        existing.unblocked_at = null;
        return await existing.save();
    }
    return await this.create({ device_id, reason, status: 'blocked' });
};

// Static: unblock a device
blockedDeviceSchema.statics.unblockDevice = async function(device_id) {
    const device = await this.findOne({ device_id });
    if (device) {
        device.status = 'active';
        device.unblocked_at = new Date();
        return await device.save();
    }
    return null;
};

// Static: check if a device is blocked
blockedDeviceSchema.statics.isBlocked = async function(device_id) {
    const device = await this.findOne({ device_id, status: 'blocked' });
    return !!device;
};

// Static: list all devices with their block status
blockedDeviceSchema.statics.listAll = async function() {
    return await this.find().sort({ blocked_at: -1 });
};

const BlockedDevice = mongoose.model('BlockedDevice', blockedDeviceSchema);
module.exports = BlockedDevice;
