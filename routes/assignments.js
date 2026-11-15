// routes/assignments.js
const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const db       = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/assignments
router.get('/', protect, requireRoles('admin', 'instructor', 'student'), (req, res) => {
  try {
    let assignments = db.get('assignments').orderBy('due_date', 'asc').value();
    if (req.user.role === 'student') {
      const student = db.get('students').find({ userId: req.user.id }).value();
      const enrolledCourses = db.get('courses')
        .filter(course => (student.courseIds || []).includes(course.id))
        .map('title')
        .value();
      assignments = assignments.filter(assignment => enrolledCourses.includes(assignment.course_name));
    } else if (req.user.role === 'instructor') {
      const instructor = db.get('instructors').find({ userId: req.user.id }).value();
      const courseNames = db.get('courses')
        .filter(course => (course.instructor || '').toLowerCase() === instructor.name.toLowerCase())
        .map('title')
        .value();
      assignments = assignments.filter(assignment => courseNames.includes(assignment.course_name));
    }
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/assignments
router.post('/', protect, requireRoles('admin', 'instructor'), (req, res) => {
  try {
    const { title, type, course_name, due_date, max_points } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    if (req.user.role === 'instructor') {
      const instructor = db.get('instructors').find({ userId: req.user.id }).value();
      const ownsCourse = db.get('courses').find(course =>
        course.title === course_name &&
        (course.instructor || '').toLowerCase() === instructor.name.toLowerCase()
      ).value();
      if (!ownsCourse) {
        return res.status(403).json({ message: 'Assignments can only be created for your own courses' });
      }
    }
    const assignment = {
      id:          uuidv4(),
      title,
      type:        type       || 'Assignment',
      course_name: course_name || '',
      due_date:    due_date   || '',
      max_points:  parseInt(max_points) || 100,
      submitted:   0,
      pending:     0,
      avg_score:   0,
      created_at:  new Date().toISOString()
    };
    db.get('assignments').push(assignment).write();
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/assignments/:id
router.put('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const a = db.get('assignments').find({ id: req.params.id }).value();
    if (!a) return res.status(404).json({ message: 'Assignment not found' });
    const updates = { ...req.body, id: a.id, created_at: a.created_at };
    db.get('assignments').find({ id: req.params.id }).assign(updates).write();
    res.json(db.get('assignments').find({ id: req.params.id }).value());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/assignments/:id
router.delete('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const a = db.get('assignments').find({ id: req.params.id }).value();
    if (!a) return res.status(404).json({ message: 'Assignment not found' });
    db.get('assignments').remove({ id: req.params.id }).write();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
