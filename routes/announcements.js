const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, (req, res) => {
  let items = db.get('announcements').orderBy('created_at', 'desc').value();
  if (req.user.role === 'student') {
    const student = db.get('students').find({ userId: req.user.id }).value();
    const courseIds = student ? student.courseIds || [] : [];
    items = items.filter(item => item.audience === 'all' || (item.courseId && courseIds.includes(item.courseId)));
  }
  if (req.user.role === 'instructor') {
    const instructor = db.get('instructors').find({ userId: req.user.id }).value();
    const courseIds = db.get('courses').filter(course =>
      instructor && (course.instructor || '').toLowerCase() === instructor.name.toLowerCase()
    ).map('id').value();
    items = items.filter(item => item.audience === 'all' || item.instructorId === instructor?.id || courseIds.includes(item.courseId));
  }
  res.json(items);
});

router.post('/', protect, requireRoles('admin', 'instructor'), (req, res) => {
  const { title, message, courseId = '', audience = 'all' } = req.body;
  if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'Title and message are required' });
  }
  if (req.user.role === 'instructor') {
    const instructor = db.get('instructors').find({ userId: req.user.id }).value();
    const course = courseId ? db.get('courses').find({ id: courseId }).value() : null;
    if (courseId && (!course || (course.instructor || '').toLowerCase() !== instructor.name.toLowerCase())) {
      return res.status(403).json({ message: 'You can only announce to your own courses' });
    }
  }
  const announcement = {
    id: uuidv4(), title: title.trim(), message: message.trim(), courseId,
    audience: ['all', 'course'].includes(audience) ? audience : 'all',
    instructorId: req.user.role === 'instructor'
      ? db.get('instructors').find({ userId: req.user.id }).value()?.id : null,
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };
  db.get('announcements').push(announcement).write();
  res.status(201).json(announcement);
});

module.exports = router;
