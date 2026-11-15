// routes/auth.js
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db       = require('../config/db');
const { protect } = require('../middleware/auth');

const router = express.Router();

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.get('users').find(u => u.email.toLowerCase() === normalizedEmail).value();
    if (!user)
      return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user.id);
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register
router.post('/register', protect, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (req.user.role !== 'admin')
      return res.status(403).json({ message: 'Only administrators can register users' });
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' ||
        !name.trim() || !email.trim() || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const normalizedEmail = email.trim().toLowerCase();
    const exists = db.get('users').find(u => u.email.toLowerCase() === normalizedEmail).value();
    if (exists)
      return res.status(400).json({ message: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      name: name.trim(),
      email: normalizedEmail,
      password: hashed,
      role: 'admin',
      created_at: new Date().toISOString()
    };
    db.get('users').push(user).write();

    const token = signToken(user.id);
    const { password: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  const { password: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

module.exports = router;
