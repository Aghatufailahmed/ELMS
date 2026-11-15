// routes/courses.js
const express  = require('express');
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
  // Keep only last 20 activity entries
  const all = db.get('activity').value();
  if (all.length > 20) {
    db.set('activity', all.slice(all.length - 20)).write();
  }
}

// GET /api/courses
router.get('/', protect, requireRoles('admin', 'instructor', 'student'), (req, res) => {
  try {
    let courses = db.get('courses').orderBy('created_at', 'desc').value();
    if (req.user.role === 'student') {
      const student = db.get('students').find({ userId: req.user.id }).value();
      const enrolledIds = student.courseIds || [];
      courses = courses.filter(course => course.status === 'active')
        .map(course => ({ ...course, isEnrolled: enrolledIds.includes(course.id) }));
    } else if (req.user.role === 'instructor') {
      const instructor = db.get('instructors').find({ userId: req.user.id }).value();
      courses = courses.filter(course => (course.instructor || '').toLowerCase() === instructor.name.toLowerCase());
    }
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/courses
router.post('/', protect, requireRoles('admin'), (req, res) => {
  try {
    const { title, instructor, category, level, description, duration, lessons } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    const course = {
      id: uuidv4(),
      title,
      instructor: instructor || '',
      category:   category   || 'General',
      level:      level      || 'Beginner',
      description: description || '',
      status:     'draft',
      lessons:    parseInt(lessons) || 0,
      duration:   duration   || '',
      enrolledStudents: 0,
      created_at: new Date().toISOString()
    };
    db.get('courses').push(course).write();
    logActivity(`New course ${title} created`);
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/courses/:id
router.put('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const course = db.get('courses').find({ id: req.params.id }).value();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const updates = { ...req.body, id: course.id, created_at: course.created_at };
    db.get('courses').find({ id: req.params.id }).assign(updates).write();
    res.json(db.get('courses').find({ id: req.params.id }).value());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/courses/:id
router.delete('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const course = db.get('courses').find({ id: req.params.id }).value();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    db.get('courses').remove({ id: req.params.id }).write();
    logActivity(`Course ${course.title} was deleted`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/enroll', protect, requireRoles('student'), (req, res) => {
  const course = db.get('courses').find({ id: req.params.id }).value();
  if (!course || course.status !== 'active') {
    return res.status(404).json({ message: 'Active course not found' });
  }

  const student = db.get('students').find({ userId: req.user.id }).value();
  if (!student) return res.status(404).json({ message: 'Student profile not found' });

  const courseIds = student.courseIds || [];
  if (courseIds.includes(course.id)) {
    return res.status(409).json({ message: 'You are already enrolled in this course' });
  }

  const updatedIds = [...courseIds, course.id];
  db.get('students').find({ id: student.id }).assign({
    courseIds: updatedIds,
    enrolled_courses: updatedIds.length
  }).write();
  db.get('courses').find({ id: course.id }).assign({
    enrolledStudents: (course.enrolledStudents || 0) + 1
  }).write();
  logActivity(`Student ${student.name} enrolled in ${course.title}`);
  res.status(200).json({ success: true, courseId: course.id });
});

module.exports = router;
