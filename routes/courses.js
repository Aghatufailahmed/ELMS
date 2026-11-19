const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();
const lessonFields = ['title', 'description', 'content', 'type', 'duration', 'points'];

function getLessons(course) {
  return Array.isArray(course.content) ? course.content : [];
}

function getCourseAccess(req, res, id) {
  const course = db.get('courses').find({ id }).value();
  if (!course) {
    res.status(404).json({ message: 'Course not found' });
    return null;
  }
  if (req.user.role === 'instructor') {
    const instructor = db.get('instructors').find({ userId: req.user.id }).value();
    if (!instructor || (course.instructor || '').toLowerCase() !== instructor.name.toLowerCase()) {
      res.status(403).json({ message: 'You can only manage your own courses' });
      return null;
    }
  }
  if (req.user.role === 'student') {
    const student = db.get('students').find({ userId: req.user.id }).value();
    if (course.status !== 'active' || !student || !(student.courseIds || []).includes(course.id)) {
      res.status(403).json({ message: 'Enroll in this active course to access its lessons' });
      return null;
    }
  }
  return course;
}

function logActivity(text) {
  const entries = db.get('activity').value() || [];
  entries.push({ id: uuidv4(), text, time: 'Just now', created_at: new Date().toISOString() });
  db.set('activity', entries.slice(-20)).write();
}

router.get('/', protect, requireRoles('admin', 'instructor', 'student'), (req, res) => {
  try {
    let courses = db.get('courses').orderBy('created_at', 'desc').value();
    if (req.user.role === 'student') {
      const student = db.get('students').find({ userId: req.user.id }).value();
      const enrolledIds = (student && student.courseIds) || [];
      courses = courses.filter(course => course.status === 'active').map(course => ({
        ...course,
        lessons: getLessons(course).length,
        isEnrolled: enrolledIds.includes(course.id),
        progress: (student.courseProgress || {})[course.id] || 0,
        content: undefined
      }));
    } else if (req.user.role === 'instructor') {
      const instructor = db.get('instructors').find({ userId: req.user.id }).value();
      courses = courses.filter(course =>
        instructor && (course.instructor || '').toLowerCase() === instructor.name.toLowerCase()
      ).map(course => ({ ...course, lessons: getLessons(course).length, content: undefined }));
    } else {
      courses = courses.map(course => ({ ...course, lessons: getLessons(course).length, content: undefined }));
    }
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, requireRoles('admin'), (req, res) => {
  try {
    const { title, instructor = '', category = 'General', level = 'Beginner', description = '', duration = '' } = req.body;
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (typeof instructor !== 'string') {
      return res.status(400).json({ message: 'Instructor must be a name' });
    }
    if (instructor.trim() && !db.get('instructors').find(item =>
      item.status === 'active' && item.name.toLowerCase() === instructor.trim().toLowerCase()
    ).value()) {
      return res.status(400).json({ message: 'Select an active instructor account' });
    }
    const course = {
      id: uuidv4(),
      title: title.trim(),
      instructor: instructor.trim(),
      category,
      level,
      description,
      status: 'draft',
      lessons: 0,
      content: [],
      duration,
      enrolledStudents: 0,
      completionRate: 0,
      created_at: new Date().toISOString()
    };
    db.get('courses').push(course).write();
    logActivity(`New course ${course.title} created`);
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, requireRoles('admin', 'instructor', 'student'), (req, res) => {
  const course = getCourseAccess(req, res, req.params.id);
  if (!course) return;
  const student = req.user.role === 'student'
    ? db.get('students').find({ userId: req.user.id }).value()
    : null;
  res.json({
    ...course,
    lessons: getLessons(course),
    completedLessonIds: student ? (student.completedLessonIds || []) : undefined
  });
});

router.put('/:id', protect, requireRoles('admin', 'instructor'), (req, res) => {
  try {
    const course = getCourseAccess(req, res, req.params.id);
    if (!course) return;
    const fields = req.user.role === 'admin'
      ? ['title', 'instructor', 'category', 'level', 'description', 'duration', 'status']
      : ['title', 'category', 'level', 'description', 'duration'];
    const updates = {};
    for (const field of fields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.title !== undefined && (typeof updates.title !== 'string' || !updates.title.trim())) {
      return res.status(400).json({ message: 'Course title is required' });
    }
    if (updates.status !== undefined && !['draft', 'active', 'in-review'].includes(updates.status)) {
      return res.status(400).json({ message: 'Invalid course status' });
    }
    if (updates.title) updates.title = updates.title.trim();
    if (updates.instructor !== undefined && typeof updates.instructor !== 'string') {
      return res.status(400).json({ message: 'Instructor must be a name' });
    }
    if (updates.instructor && updates.instructor.trim() && !db.get('instructors').find(item =>
      item.status === 'active' && item.name.toLowerCase() === updates.instructor.trim().toLowerCase()
    ).value()) {
      return res.status(400).json({ message: 'Select an active instructor account' });
    }
    if (updates.instructor !== undefined) updates.instructor = updates.instructor.trim();
    updates.id = course.id;
    updates.created_at = course.created_at;
    db.get('courses').find({ id: course.id }).assign(updates).write();
    res.json(db.get('courses').find({ id: course.id }).value());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const course = db.get('courses').find({ id: req.params.id }).value();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    db.get('courses').remove({ id: course.id }).write();
    db.get('students').value().forEach(student => {
      const courseIds = (student.courseIds || []).filter(id => id !== course.id);
      const courseProgress = { ...(student.courseProgress || {}) };
      delete courseProgress[course.id];
      const progress = courseIds.length
        ? Math.round(courseIds.reduce((sum, id) => sum + (courseProgress[id] || 0), 0) / courseIds.length)
        : 0;
      db.get('students').find({ id: student.id }).assign({
        courseIds,
        enrolled_courses: courseIds.length,
        courseProgress,
        progress
      }).write();
    });
    db.get('assignments').remove({ courseId: course.id }).write();
    logActivity(`Course ${course.title} was deleted`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/lessons', protect, requireRoles('admin', 'instructor'), (req, res) => {
  const course = getCourseAccess(req, res, req.params.id);
  if (!course) return;
  const { title, description = '', content = '', type = 'Reading', duration = '', points = 0 } = req.body;
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ message: 'Lesson title is required' });
  }
  if (typeof content !== 'string' || content.length > 50000) {
    return res.status(400).json({ message: 'Lesson content must be under 50,000 characters' });
  }
  const lesson = {
    id: uuidv4(),
    title: title.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    content,
    type: ['Video Lecture', 'Reading', 'Quiz', 'Assignment'].includes(type) ? type : 'Reading',
    duration: typeof duration === 'string' ? duration.trim() : '',
    points: Math.max(0, Math.min(1000, Number(points) || 0)),
    created_at: new Date().toISOString()
  };
  const contentItems = [...getLessons(course), lesson];
  db.get('courses').find({ id: course.id }).assign({ content: contentItems, lessons: contentItems.length }).write();
  db.get('students').value()
    .filter(student => (student.courseIds || []).includes(course.id))
    .forEach(student => createNotification(student.userId, 'New lecture', `${lesson.title} was uploaded to ${course.title}`, 'lecture'));
  res.status(201).json(lesson);
});

router.put('/:id/lessons/:lessonId', protect, requireRoles('admin', 'instructor'), (req, res) => {
  const course = getCourseAccess(req, res, req.params.id);
  if (!course) return;
  const lessons = getLessons(course);
  const index = lessons.findIndex(lesson => lesson.id === req.params.lessonId);
  if (index < 0) return res.status(404).json({ message: 'Lesson not found' });
  const updates = {};
  for (const field of lessonFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.title !== undefined && (typeof updates.title !== 'string' || !updates.title.trim())) {
    return res.status(400).json({ message: 'Lesson title is required' });
  }
  if (updates.content !== undefined && (typeof updates.content !== 'string' || updates.content.length > 50000)) {
    return res.status(400).json({ message: 'Lesson content must be under 50,000 characters' });
  }
  if (updates.title) updates.title = updates.title.trim();
  const updatedLesson = { ...lessons[index], ...updates };
  lessons[index] = updatedLesson;
  db.get('courses').find({ id: course.id }).assign({ content: lessons }).write();
  res.json(updatedLesson);
});

router.delete('/:id/lessons/:lessonId', protect, requireRoles('admin', 'instructor'), (req, res) => {
  const course = getCourseAccess(req, res, req.params.id);
  if (!course) return;
  const remainingLessons = getLessons(course).filter(lesson => lesson.id !== req.params.lessonId);
  if (remainingLessons.length === getLessons(course).length) {
    return res.status(404).json({ message: 'Lesson not found' });
  }
  db.get('courses').find({ id: course.id }).assign({
    content: remainingLessons,
    lessons: remainingLessons.length
  }).write();
  db.get('students').value().forEach(student => {
    const completedLessonIds = (student.completedLessonIds || []).filter(id => id !== req.params.lessonId);
    db.get('students').find({ id: student.id }).assign({ completedLessonIds }).write();
  });
  res.json({ success: true });
});

router.post('/:id/lessons/:lessonId/complete', protect, requireRoles('student'), (req, res) => {
  const course = getCourseAccess(req, res, req.params.id);
  if (!course) return;
  const lessons = getLessons(course);
  const lesson = lessons.find(item => item.id === req.params.lessonId);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
  const student = db.get('students').find({ userId: req.user.id }).value();
  const completedLessonIds = student.completedLessonIds || [];
  if (!completedLessonIds.includes(lesson.id)) completedLessonIds.push(lesson.id);
  const completedCount = completedLessonIds.filter(id => lessons.some(item => item.id === id)).length;
  const progress = lessons.length ? Math.round(completedCount / lessons.length * 100) : 0;
  const courseProgress = { ...(student.courseProgress || {}), [course.id]: progress };
  const enrolledProgress = (student.courseIds || []).map(id => courseProgress[id] || 0);
  const overallProgress = enrolledProgress.length
    ? Math.round(enrolledProgress.reduce((sum, value) => sum + value, 0) / enrolledProgress.length)
    : 0;
  db.get('students').find({ id: student.id }).assign({
    completedLessonIds,
    courseProgress,
    progress: overallProgress
  }).write();
  const enrolledStudents = db.get('students').filter(item => (item.courseIds || []).includes(course.id)).value();
  const completionRate = enrolledStudents.length
    ? Math.round(enrolledStudents.reduce((sum, item) =>
        sum + ((item.id === student.id ? courseProgress[course.id] : (item.courseProgress || {})[course.id]) || 0), 0
      ) / enrolledStudents.length)
    : 0;
  db.get('courses').find({ id: course.id }).assign({ completionRate }).write();
  res.json({ success: true, progress });
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
    enrolled_courses: updatedIds.length,
    courseProgress: { ...(student.courseProgress || {}), [course.id]: 0 }
  }).write();
  db.get('courses').find({ id: course.id }).assign({
    enrolledStudents: (course.enrolledStudents || 0) + 1
  }).write();
  logActivity(`Student ${student.name} enrolled in ${course.title}`);
  res.status(200).json({ success: true, courseId: course.id });
});

module.exports = router;
