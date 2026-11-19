const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'data', 'profile-photos');
fs.mkdirSync(uploadDir, { recursive: true });

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
    cb(null, true);
  }
});

function profileFor(user) {
  if (user.role === 'student') return db.get('students').find({ userId: user.id }).value();
  if (user.role === 'instructor') return db.get('instructors').find({ userId: user.id }).value();
  return null;
}

router.get('/me', protect, (req, res) => {
  const profile = profileFor(req.user);
  const { password, ...safeUser } = req.user;
  res.json({ user: safeUser, profile: profile || null });
});

router.put('/me', protect, requireRoles('admin', 'instructor', 'student'), async (req, res) => {
  const { name, email, phone } = req.body;
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ message: 'Name is required' });
  }
  if (email !== undefined) {
    if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ message: 'Email is required' });
    const normalized = email.trim().toLowerCase();
    const owner = db.get('users').find(item => item.id !== req.user.id && item.email.toLowerCase() === normalized).value();
    if (owner) return res.status(409).json({ message: 'An account with this email already exists' });
  }
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email.trim().toLowerCase();
  if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim() : '';
  db.get('users').find({ id: req.user.id }).assign(updates).write();
  const profile = profileFor(req.user);
  if (profile) {
    db.get(req.user.role === 'student' ? 'students' : 'instructors')
      .find({ id: profile.id }).assign(updates).write();
  }
  res.json({ success: true, user: db.get('users').find({ id: req.user.id }).omit('password').value(),
    profile: profileFor(db.get('users').find({ id: req.user.id }).value()) });
});

router.put('/password', protect, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
    return res.status(400).json({ message: 'Current password, new password, and confirmation are required' });
  }
  if (newPassword !== confirmPassword) return res.status(400).json({ message: 'Password confirmation does not match' });
  if (newPassword.length < 12 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return res.status(400).json({ message: 'Use at least 12 characters with uppercase, lowercase, and a number' });
  }
  if (!await bcrypt.compare(currentPassword, req.user.password)) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }
  db.get('users').find({ id: req.user.id }).assign({
    password: await bcrypt.hash(newPassword, 12),
    password_changed_at: new Date().toISOString()
  }).write();
  res.json({ success: true, message: 'Password changed successfully' });
});

router.post('/photo', protect, requireRoles('admin', 'instructor', 'student'), (req, res) => {
  photoUpload.single('photo')(req, res, err => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Select a profile photo' });
    const oldProfile = profileFor(req.user);
    if (oldProfile && oldProfile.profilePhoto) {
      const oldPath = path.join(__dirname, '..', 'data', 'profile-photos', path.basename(oldProfile.profilePhoto));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const relative = `/api/profile/photo/${path.basename(req.file.path)}`;
    if (oldProfile) db.get(req.user.role === 'student' ? 'students' : 'instructors')
      .find({ id: oldProfile.id }).assign({ profilePhoto: relative }).write();
    res.status(201).json({ success: true, profilePhoto: relative });
  });
});

router.get('/photo/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Photo not found' });
  res.sendFile(filePath);
});

module.exports = router;
