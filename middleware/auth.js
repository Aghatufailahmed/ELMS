// middleware/auth.js — JWT protect middleware
const jwt = require('jsonwebtoken');
const db  = require('../config/db');

exports.protect = (req, res, next) => {
  let token;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.split(' ')[1];
  }
  if (!token && typeof req.query.token === 'string') token = req.query.token;
  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.get('users').find({ id: decoded.id }).value();
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (!['admin', 'instructor', 'student'].includes(user.role)) {
      return res.status(403).json({ message: 'This account has no valid application role' });
    }
    if (user.active === false) return res.status(403).json({ message: 'This account has been disabled' });
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
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};

exports.requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to perform this action' });
  }
  next();
};
