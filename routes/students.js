// routes/students.js
const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const db       = require('../config/db');
const { protect } = require('../middleware/auth');

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
router.get('/', protect, (req, res) => {
  try {
    const students = db.get('students').orderBy('created_at', 'desc').value();
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/students
router.post('/', protect, (req, res) => {
  try {
    const { name, email, enrolled_courses, status } = req.body;
    if (!name || !email)
      return res.status(400).json({ message: 'Name and email are required' });

    const exists = db.get('students').find({ email }).value();
    if (exists)
      return res.status(400).json({ message: 'Email already registered' });

    const now = new Date();
    const monthYear = now.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const student = {
      id:              uuidv4(),
      name,
      email,
      enrolled_courses: parseInt(enrolled_courses) || 1,
      progress:        0,
      status:          status || 'active',
      joined_at:       monthYear,
      created_at:      now.toISOString()
    };
    db.get('students').push(student).write();
    logActivity(`New student ${name} enrolled`);
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/students/:id
router.put('/:id', protect, (req, res) => {
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
router.delete('/:id', protect, (req, res) => {
  try {
    const student = db.get('students').find({ id: req.params.id }).value();
    if (!student) return res.status(404).json({ message: 'Student not found' });
    db.get('students').remove({ id: req.params.id }).write();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
