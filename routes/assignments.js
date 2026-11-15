const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');

const router = express.Router();

function instructorOwnsCourse(user, course) {
  const instructor = db.get('instructors').find({ userId: user.id }).value();
  return instructor && course &&
    (course.instructor || '').toLowerCase() === instructor.name.toLowerCase();
}

function getAssignmentAccess(req, res, id) {
  const assignment = db.get('assignments').find({ id }).value();
  if (!assignment) {
    res.status(404).json({ message: 'Assignment not found' });
    return null;
  }
  const course = db.get('courses').find({ id: assignment.courseId }).value();
  if (req.user.role === 'instructor' && !instructorOwnsCourse(req.user, course)) {
    res.status(403).json({ message: 'You can only manage assignments for your courses' });
    return null;
  }
  if (req.user.role === 'student') {
    const student = db.get('students').find({ userId: req.user.id }).value();
    if (!student || !(student.courseIds || []).includes(assignment.courseId)) {
      res.status(403).json({ message: 'Enroll in this course to access the assignment' });
      return null;
    }
  }
  return assignment;
}

router.get('/', protect, requireRoles('admin', 'instructor', 'student'), (req, res) => {
  try {
    let assignments = db.get('assignments').orderBy('due_date', 'asc').value();
    const student = req.user.role === 'student'
      ? db.get('students').find({ userId: req.user.id }).value()
      : null;
    if (student) {
      assignments = assignments.filter(assignment => (student.courseIds || []).includes(assignment.courseId))
        .map(assignment => ({
          ...assignment,
          submissions: undefined,
          mySubmission: (assignment.submissions || []).find(item => item.studentId === student.id) || null
        }));
    } else if (req.user.role === 'instructor') {
      assignments = assignments.filter(assignment => {
        const course = db.get('courses').find({ id: assignment.courseId }).value();
        return instructorOwnsCourse(req.user, course);
      });
    }

    res.json(assignments.map(assignment => {
      const course = db.get('courses').find({ id: assignment.courseId }).value();
      const submissions = assignment.submissions || [];
      const enrolledStudents = course
        ? db.get('students').filter(student => (student.courseIds || []).includes(course.id)).value().length
        : 0;
      return {
        ...assignment,
        course_name: course ? course.title : assignment.course_name,
        submissions: req.user.role === 'student' ? undefined : submissions,
        submitted: submissions.length,
        pending: submissions.filter(submission => submission.score === undefined).length,
        missing: Math.max(0, enrolledStudents - submissions.length)
      };
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, requireRoles('admin', 'instructor'), (req, res) => {
  try {
    const { title, type = 'Assignment', courseId, due_date = '', max_points = 100 } = req.body;
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!['Assignment', 'Quiz', 'Project'].includes(type)) {
      return res.status(400).json({ message: 'Invalid assignment type' });
    }
    const course = db.get('courses').find({ id: courseId }).value();
    if (!course) return res.status(400).json({ message: 'Select a valid course' });
    if (req.user.role === 'instructor' && !instructorOwnsCourse(req.user, course)) {
      return res.status(403).json({ message: 'Assignments can only be created for your own courses' });
    }
    const points = Number(max_points);
    if (!Number.isInteger(points) || points < 1 || points > 10000) {
      return res.status(400).json({ message: 'Max points must be between 1 and 10,000' });
    }
    const assignment = {
      id: uuidv4(),
      title: title.trim(),
      type,
      courseId: course.id,
      course_name: course.title,
      due_date: typeof due_date === 'string' ? due_date : '',
      max_points: points,
      submissions: [],
      created_at: new Date().toISOString()
    };
    db.get('assignments').push(assignment).write();
    res.status(201).json({ ...assignment, submitted: 0, pending: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/submissions', protect, requireRoles('student'), (req, res) => {
  const assignment = getAssignmentAccess(req, res, req.params.id);
  if (!assignment) return;
  const { answer } = req.body;
  if (typeof answer !== 'string' || !answer.trim() || answer.length > 20000) {
    return res.status(400).json({ message: 'Enter an answer of up to 20,000 characters' });
  }
  if (assignment.due_date && new Date(`${assignment.due_date}T23:59:59`) < new Date()) {
    return res.status(400).json({ message: 'The assignment deadline has passed' });
  }
  const student = db.get('students').find({ userId: req.user.id }).value();
  const submissions = assignment.submissions || [];
  const existingIndex = submissions.findIndex(item => item.studentId === student.id);
  if (existingIndex >= 0 && submissions[existingIndex].score !== undefined) {
    return res.status(409).json({ message: 'This submission has already been graded' });
  }
  const submission = {
    studentId: student.id,
    studentName: student.name,
    answer: answer.trim(),
    submitted_at: new Date().toISOString()
  };
  if (existingIndex >= 0) submissions[existingIndex] = submission;
  else submissions.push(submission);
  db.get('assignments').find({ id: assignment.id }).assign({ submissions }).write();
  res.status(existingIndex >= 0 ? 200 : 201).json({ success: true, submission });
});

router.put('/:id/submissions/:studentId', protect, requireRoles('admin', 'instructor'), (req, res) => {
  const assignment = getAssignmentAccess(req, res, req.params.id);
  if (!assignment) return;
  const submissions = assignment.submissions || [];
  const index = submissions.findIndex(item => item.studentId === req.params.studentId);
  if (index < 0) return res.status(404).json({ message: 'Submission not found' });
  const score = Number(req.body.score);
  if (!Number.isInteger(score) || score < 0 || score > assignment.max_points) {
    return res.status(400).json({ message: `Score must be between 0 and ${assignment.max_points}` });
  }
  const feedback = req.body.feedback === undefined ? '' : req.body.feedback;
  if (typeof feedback !== 'string' || feedback.length > 5000) {
    return res.status(400).json({ message: 'Feedback must be under 5,000 characters' });
  }
  submissions[index] = {
    ...submissions[index],
    score,
    feedback: feedback.trim(),
    graded_at: new Date().toISOString(),
    graded_by: req.user.id
  };
  db.get('assignments').find({ id: assignment.id }).assign({ submissions }).write();
  res.json({ success: true, submission: submissions[index] });
});

router.put('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const assignment = db.get('assignments').find({ id: req.params.id }).value();
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    const updates = {};
    for (const field of ['title', 'type', 'due_date', 'max_points']) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.title !== undefined && (typeof updates.title !== 'string' || !updates.title.trim())) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (updates.title) updates.title = updates.title.trim();
    if (updates.type !== undefined && !['Assignment', 'Quiz', 'Project'].includes(updates.type)) {
      return res.status(400).json({ message: 'Invalid assignment type' });
    }
    if (updates.max_points !== undefined &&
        (!Number.isInteger(Number(updates.max_points)) || Number(updates.max_points) < 1 || Number(updates.max_points) > 10000)) {
      return res.status(400).json({ message: 'Max points must be between 1 and 10,000' });
    }
    db.get('assignments').find({ id: assignment.id }).assign(updates).write();
    res.json(db.get('assignments').find({ id: assignment.id }).value());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, requireRoles('admin'), (req, res) => {
  const assignment = db.get('assignments').find({ id: req.params.id }).value();
  if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
  db.get('assignments').remove({ id: assignment.id }).write();
  res.json({ success: true });
});

module.exports = router;
