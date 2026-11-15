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
      ? Math.round(students.reduce((sum, s) => sum + (s.progress || 0), 0) / students.length)
      : 0;
    const pendingReviews = assignments.filter(a => (a.pending || 0) > 0).length;
    const revenue        = totalStudents * 40;

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
      .slice()
      .sort((a, b) => (b.enrolledStudents || 0) - (a.enrolledStudents || 0))
      .slice(0, 4)
      .map(c => ({
        title:           c.title,
        students:        c.enrolledStudents || 0,
        completion:      c.completionRate   || 0,
        avgScore:        c.avgScore         || 0,
        revenue:         (c.enrolledStudents || 0) * 40,
        rating:          c.rating           || 0
      }));

    res.json({
      totalCourses,
      totalStudents,
      completionRate,
      pendingReviews,
      revenue,
      avgTime:        '2h 14m',
      quizPassRate:   assignments.length
        ? Math.round(assignments.filter(a => a.avg_score > 50).length / assignments.length * 100)
        : 84,
      dropoffRate:    11,
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
