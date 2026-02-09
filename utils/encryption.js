// utils/encryption.js
const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
// Problem 4 Fix: Ensure encryption key is stable and validated
if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: ENCRYPTION_KEY is missing in production! Data will be unreadable on restart.');
  // In a real app, we might want to exit, but for this project we'll log a loud warning
}

const rawKey = process.env.ENCRYPTION_KEY || 'vauth-default-development-key-32-chars!!';
if (rawKey.length < 32) {
  console.warn('WARNING: ENCRYPTION_KEY is too short. Should be at least 32 characters.');
}
const secretKey = crypto.createHash('sha256').update(rawKey).digest();
const ivLength = 16;

function encrypt(text) {
  try {
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption error:', err);
    throw new Error('Failed to encrypt data');
  }
}

function decrypt(text) {
  try {
    const [ivHex, encryptedData] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err);
    throw new Error('Failed to decrypt data');
  }
}

module.exports = { encrypt, decrypt };
