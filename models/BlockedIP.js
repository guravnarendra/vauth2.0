const mongoose = require('mongoose');

const blockedIPSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        default: 'Unknown'
    },
    reason: {
        type: String,
        default: 'Rate limit exceeded'
    },
    attempts_count: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['blocked', 'unblocked'],
        default: 'blocked'
    },
    auto_blocked: {
        type: Boolean,
        default: true
    },
    blocked_at: {
        type: Date,
        default: Date.now
    },
    unblocked_at: {
        type: Date,
        default: null
    },
    last_attempt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Static: block an IP
blockedIPSchema.statics.blockIP = async function (ip, username = 'Unknown', attempts = 0, reason = 'Rate limit exceeded') {
    const existing = await this.findOne({ ip });
    if (existing) {
        existing.status = 'blocked';
        existing.reason = reason;
        existing.username = username || existing.username;
        existing.attempts_count = attempts || existing.attempts_count + 1;
        existing.blocked_at = new Date();
        existing.last_attempt = new Date();
        existing.unblocked_at = null;
        return await existing.save();
    }
    return await this.create({ ip, username, reason, attempts_count: attempts, status: 'blocked', auto_blocked: true });
};

// Static: unblock an IP
blockedIPSchema.statics.unblockIP = async function (ip) {
    const record = await this.findOne({ ip });
    if (record) {
        record.status = 'unblocked';
        record.unblocked_at = new Date();
        return await record.save();
    }
    return null;
};

// Static: check if an IP is blocked
blockedIPSchema.statics.isBlocked = async function (ip) {
    const record = await this.findOne({ ip, status: 'blocked' });
    return !!record;
};

// Static: increment attempt count
blockedIPSchema.statics.incrementAttempts = async function (ip, username = 'Unknown') {
    const existing = await this.findOne({ ip });
    if (existing) {
        existing.attempts_count += 1;
        existing.last_attempt = new Date();
        existing.username = username || existing.username;
        return await existing.save();
    }
    return await this.create({ ip, username, attempts_count: 1, status: 'unblocked', auto_blocked: false });
};

// Static: list all
blockedIPSchema.statics.listAll = async function () {
    return await this.find().sort({ blocked_at: -1 });
};

const BlockedIP = mongoose.model('BlockedIP', blockedIPSchema);
module.exports = BlockedIP;
