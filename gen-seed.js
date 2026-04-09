const crypto = require('crypto');
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256').update('admin1234' + salt).digest('hex');
const id = 'user_' + crypto.randomBytes(8).toString('hex');
const now = Date.now();
console.log(`INSERT OR IGNORE INTO users (id, username, email, password_hash, password_salt, role, is_active, created_at) VALUES ('${id}', 'admin', 'admin@local.dev', '${hash}', '${salt}', 'admin', 1, ${now});`);