const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'image/jpeg', 'image/png',
  'application/zip', 'application/x-zip-compressed',
  'text/plain'
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) return cb(new Error('This file type is not permitted'));
    cb(null, true);
  }
});

function instructorOwnsCourse(user, course) {
  const instructor = db.get('instructors').find({ userId: user.id }).value();
  return instructor && course && (course.instructor || '').toLowerCase() === instructor.name.toLowerCase();
}

function getCourseAndLesson(req, res) {
  const course = db.get('courses').find({ id: req.params.courseId }).value();
  if (!course) { res.status(404).json({ message: 'Course not found' }); return null; }
  if (req.user.role === 'student') {
    const student = db.get('students').find({ userId: req.user.id }).value();
    if (!student || !(student.courseIds || []).includes(course.id)) {
      res.status(403).json({ message: 'Enroll in this course to access materials' }); return null;
    }
  }
  if (req.user.role === 'instructor' && !instructorOwnsCourse(req.user, course)) {
    res.status(403).json({ message: 'You can only manage materials for your own courses' }); return null;
  }
  const lesson = (course.content || []).find(item => item.id === req.params.lessonId);
  if (!lesson) { res.status(404).json({ message: 'Lesson not found' }); return null; }
  return { course, lesson };
}

router.post('/:courseId/lessons/:lessonId', protect, requireRoles('admin', 'instructor'), (req, res) => {
  upload.array('files', 10)(req, res, err => {
    if (err) return res.status(400).json({ message: err.message });
    const access = getCourseAndLesson(req, res);
    if (!access) {
      (req.files || []).forEach(file => fs.unlinkSync(file.path));
      return;
    }
    if (!req.files || !req.files.length) return res.status(400).json({ message: 'Select at least one file' });
    const records = req.files.map(file => ({
      id: uuidv4(),
      courseId: access.course.id,
      lessonId: access.lesson.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storedName: path.basename(file.path),
      uploaded_by: req.user.id,
      uploaded_at: new Date().toISOString()
    }));
    db.get('lecture_materials').push(...records).write();
    const lessonIndex = access.course.content.findIndex(item => item.id === access.lesson.id);
    access.course.content[lessonIndex].materials = [
      ...(access.course.content[lessonIndex].materials || []),
      ...records.map(record => record.id)
    ];
    db.get('courses').find({ id: access.course.id }).assign({ content: access.course.content }).write();
    res.status(201).json(records);
  });
});

router.get('/:courseId/lessons/:lessonId', protect, requireRoles('admin', 'instructor', 'student'), (req, res) => {
  const access = getCourseAndLesson(req, res);
  if (!access) return;
  res.json(db.get('lecture_materials').filter(item =>
    item.courseId === access.course.id && item.lessonId === access.lesson.id
  ).value());
});

router.get('/download/:materialId', protect, requireRoles('admin', 'instructor', 'student'), (req, res) => {
  const material = db.get('lecture_materials').find({ id: req.params.materialId }).value();
  if (!material) return res.status(404).json({ message: 'Material not found' });
  const course = db.get('courses').find({ id: material.courseId }).value();
  if (req.user.role === 'student') {
    const student = db.get('students').find({ userId: req.user.id }).value();
    if (!student || !(student.courseIds || []).includes(material.courseId)) return res.status(403).json({ message: 'Access denied' });
  } else if (req.user.role === 'instructor' && !instructorOwnsCourse(req.user, course)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  const filePath = path.join(uploadDir, material.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File is missing from storage' });
  res.download(filePath, material.originalName);
});

router.delete('/:materialId', protect, requireRoles('admin', 'instructor'), (req, res) => {
  const material = db.get('lecture_materials').find({ id: req.params.materialId }).value();
  if (!material) return res.status(404).json({ message: 'Material not found' });
  const course = db.get('courses').find({ id: material.courseId }).value();
  if (req.user.role === 'instructor' && !instructorOwnsCourse(req.user, course)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  const filePath = path.join(uploadDir, material.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.get('lecture_materials').remove({ id: material.id }).write();
  const content = (course.content || []).map(lesson => lesson.id === material.lessonId
    ? { ...lesson, materials: (lesson.materials || []).filter(id => id !== material.id) } : lesson);
  db.get('courses').find({ id: course.id }).assign({ content }).write();
  res.json({ success: true });
});

module.exports = router;
