// routes/analytics.js
const express = require('express');
const db      = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics
router.get('/', protect, requireRoles('admin'), (req, res) => {
  try {
    const courses     = db.get('courses').value();
    const students    = db.get('students').value();
    const assignments = db.get('assignments').value();
    const activity    = db.get('activity').orderBy('created_at', 'desc').take(5).value();

    const totalCourses   = courses.length;
    const totalStudents  = students.length;
    const completionRate = students.length
      ? Math.round(students.reduce((sum, student) => sum + (student.progress || 0), 0) / students.length)
      : 0;
    const pendingReviews = assignments.reduce((sum, assignment) =>
      sum + Math.max(0, (assignment.submissions || []).filter(submission => submission.score === undefined).length), 0);

    // Category breakdown
    const catMap = {};
    courses.forEach(c => {
      catMap[c.category] = (catMap[c.category] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(catMap).map(([category, count]) => ({
      category,
      pct: totalCourses ? Math.round((count / totalCourses) * 100) : 0
    }));

    // Monthly enrollments — last 6 months (use student created_at)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short' });
      const count = students.filter(s => {
        if (!s.created_at) return false;
        const sd = new Date(s.created_at);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      }).length;
      months.push({ month: label, count });
    }

    // Top courses by enrolled students
    const topCourses = courses
      .map(course => {
        const enrolled = students.filter(student => (student.courseIds || []).includes(course.id));
        const graded = assignments
          .filter(assignment => assignment.courseId === course.id)
          .flatMap(assignment => (assignment.submissions || []).map(submission => ({
            ...submission,
            maxPoints: assignment.max_points
          })))
          .filter(submission => submission.score !== undefined);
        const maxScore = graded.length
          ? Math.round(graded.reduce((sum, submission) => sum + (submission.score / submission.maxPoints * 100), 0) / graded.length)
          : 0;
        const completion = enrolled.length
          ? Math.round(enrolled.reduce((sum, student) => sum + ((student.courseProgress || {})[course.id] || 0), 0) / enrolled.length)
          : 0;
        return {
          title: course.title,
          students: enrolled.length,
          completion,
          avgScore: graded.length ? maxScore : null,
          revenue: null,
          rating: null
        };
      })
      .sort((a, b) => b.students - a.students)
      .slice(0, 4);

    const quizSubmissions = assignments
      .filter(assignment => assignment.type === 'Quiz')
      .flatMap(assignment => (assignment.submissions || []).map(submission => ({
        ...submission,
        maxPoints: assignment.max_points
      })))
      .filter(submission => submission.score !== undefined);
    const dropoffRate = students.length
      ? Math.round(students.filter(student => (student.progress || 0) < 10).length / students.length * 100)
      : 0;

    res.json({
      totalCourses,
      totalStudents,
      completionRate,
      pendingReviews,
      revenue: null,
      avgTime: null,
      quizPassRate: quizSubmissions.length
        ? Math.round(quizSubmissions.filter(submission => submission.score / submission.maxPoints >= 0.5).length / quizSubmissions.length * 100)
        : 0,
      dropoffRate,
      monthlyEnrollments: months,
      categoryBreakdown,
      topCourses,
      recentActivity: activity
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
