// routes/students.js
const express  = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db       = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');

const router = express.Router();

function logActivity(text) {
  db.get('activity').push({
    id: uuidv4(),
    text,
    time: 'Just now',
    created_at: new Date().toISOString()
  }).write();
}

// GET /api/students
router.get('/me', protect, requireRoles('student'), (req, res) => {
  const student = db.get('students').find({ userId: req.user.id }).value();
  if (!student) return res.status(404).json({ message: 'Student profile not found' });
  res.json(student);
});

router.get('/', protect, requireRoles('admin', 'instructor'), (req, res) => {
  try {
    let students = db.get('students').orderBy('created_at', 'desc').value();
    if (req.user.role === 'instructor') {
      const instructor = db.get('instructors').find({ userId: req.user.id }).value();
      const courseIds = db.get('courses')
        .filter(course => (course.instructor || '').toLowerCase() === instructor.name.toLowerCase())
        .map('id')
        .value();
      students = students.filter(student => (student.courseIds || []).some(id => courseIds.includes(id)));
    }
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/students
router.post('/', protect, requireRoles('admin', 'instructor'), async (req, res) => {
  try {
    const { name, email, password, courseIds = [] } = req.body;
    if (typeof name !== 'string' || typeof email !== 'string' || !name.trim() || !email.trim()) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'A password of at least 8 characters is required' });
    }
    if (!Array.isArray(courseIds)) {
      return res.status(400).json({ message: 'Course selection is invalid' });
    }
    if (req.user.role === 'instructor' && courseIds.length === 0) {
      return res.status(400).json({ message: 'Select at least one of your active courses for this student' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = db.get('users').find(u => u.email && u.email.toLowerCase() === normalizedEmail).value();
    const existingStudent = db.get('students')
      .find(student => student.email && student.email.toLowerCase() === normalizedEmail)
      .value();
    if (existingUser || existingStudent)
      return res.status(400).json({ message: 'An account with this email already exists' });

    const uniqueCourseIds = [...new Set(courseIds)];
    let selectedCourses = db.get('courses').filter(course => uniqueCourseIds.includes(course.id) && course.status === 'active').value();
    if (selectedCourses.length !== uniqueCourseIds.length) {
      return res.status(400).json({ message: 'One or more selected courses are unavailable' });
    }
    if (req.user.role === 'instructor') {
      const instructor = db.get('instructors').find({ userId: req.user.id }).value();
      selectedCourses = selectedCourses.filter(course => (course.instructor || '').toLowerCase() === instructor.name.toLowerCase());
      if (selectedCourses.length !== uniqueCourseIds.length) {
        return res.status(403).json({ message: 'You can only add students to your own courses' });
      }
    }

    const now = new Date();
    const monthYear = now.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const userId = uuidv4();
    const user = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: 'student',
      created_at: now.toISOString()
    };
    const student = {
      id:              uuidv4(),
      userId,
      name: name.trim(),
      email: normalizedEmail,
      courseIds: uniqueCourseIds,
      enrolled_courses: uniqueCourseIds.length,
      progress:        0,
      status:          'active',
      joined_at:       monthYear,
      created_at:      now.toISOString()
    };
    db.get('users').push(user).write();
    db.get('students').push(student).write();
    logActivity(`New student ${student.name} enrolled`);
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/students/:id
router.put('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const student = db.get('students').find({ id: req.params.id }).value();
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const updates = { ...req.body, id: student.id, created_at: student.created_at };
    db.get('students').find({ id: req.params.id }).assign(updates).write();
    res.json(db.get('students').find({ id: req.params.id }).value());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/students/:id
router.delete('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const student = db.get('students').find({ id: req.params.id }).value();
    if (!student) return res.status(404).json({ message: 'Student not found' });
    db.get('students').remove({ id: req.params.id }).write();
    if (student.userId) db.get('users').remove({ id: student.userId }).write();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
