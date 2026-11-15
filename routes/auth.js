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

router.get('/setup-status', (req, res) => {
  res.json({ needsAdminSetup: db.get('users').value().length === 0 });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.get('users').find(u => typeof u.email === 'string' && u.email.toLowerCase() === normalizedEmail).value();
    if (!user)
      return res.status(401).json({ message: 'Invalid credentials' });
    if (!['admin', 'instructor', 'student'].includes(user.role)) {
      return res.status(403).json({ message: 'This account has no valid application role' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Invalid credentials' });

    if (user.active === false) {
      return res.status(403).json({ message: 'This account has been disabled' });
    }
    if (user.role === 'instructor') {
      const instructor = db.get('instructors').find({ userId: user.id }).value();
      if (!instructor || instructor.status !== 'active') {
        return res.status(403).json({ message: 'Instructor access is not active' });
      }
    }
    if (user.role === 'student') {
      const student = db.get('students').find({ userId: user.id }).value();
      if (!student || student.status === 'inactive') {
        return res.status(403).json({ message: 'Student access is not active' });
      }
    }

    const token = signToken(user.id);
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
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
