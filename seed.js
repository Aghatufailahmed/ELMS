require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/db');

async function createAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before creating the first admin.');
  }
  if (!ADMIN_NAME.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL.trim())) {
    throw new Error('ADMIN_NAME and a valid ADMIN_EMAIL are required.');
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }
  if (db.get('users').value().length ||
      db.get('instructors').value().length ||
      db.get('students').value().length) {
    throw new Error('Accounts already exist. This command never resets or overwrites project data.');
  }

  db.get('users').push({
    id: uuidv4(),
    name: ADMIN_NAME.trim(),
    email: ADMIN_EMAIL.trim().toLowerCase(),
    password: await bcrypt.hash(ADMIN_PASSWORD, 12),
    role: 'admin',
    created_at: new Date().toISOString()
  }).write();

  console.log(`Administrator created for ${ADMIN_EMAIL.trim().toLowerCase()}.`);
}

createAdmin().catch(error => {
  console.error(`Unable to create administrator: ${error.message}`);
  process.exitCode = 1;
});
