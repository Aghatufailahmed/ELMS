// routes/instructors.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { protect, requireRoles } = require('../middleware/auth');

const router = express.Router();

function logActivity(text) {
  db.get('activity').push({
    id: uuidv4(),
    text,
    time: 'Just now',
    created_at: new Date().toISOString()
  }).write();
  const all = db.get('activity').value();
  if (all.length > 20) {
    db.set('activity', all.slice(all.length - 20)).write();
  }
}

// GET /api/instructors
router.get('/', protect, requireRoles('admin'), (req, res) => {
  try {
    const instructors = db.get('instructors').value() || [];
    const courses = db.get('courses').value() || [];

    // Augment with actual course count assigned to each instructor
    const enriched = instructors.map(inst => {
      const assignedCount = courses.filter(c => c.instructor && c.instructor.toLowerCase() === inst.name.toLowerCase()).length;
      return {
        ...inst,
        coursesCount: assignedCount
      };
    });

    res.json(enriched.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/instructors
router.post('/', protect, requireRoles('admin'), async (req, res) => {
  try {
    const { name, email, password, department, bio } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Instructor name is required' });
    }
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ message: 'Instructor email is required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'A password of at least 8 characters is required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existingUser = db.get('users').find(u => u.email && u.email.toLowerCase() === trimmedEmail).value();
    const existingInstructor = db.get('instructors')
      .find(instructor => instructor.email && instructor.email.toLowerCase() === trimmedEmail)
      .value();
    if (existingUser || existingInstructor) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const now = new Date().toISOString();
    const user = {
      id: uuidv4(),
      name: name.trim(),
      email: trimmedEmail,
      password: await bcrypt.hash(password, 10),
      role: 'instructor',
      created_at: now
    };
    const instructor = {
      id: uuidv4(),
      userId: user.id,
      name: name.trim(),
      email: trimmedEmail,
      department: (department && department.trim()) || 'General Faculty',
      bio: (bio && bio.trim()) || '',
      status: 'active',
      created_at: now
    };

    db.get('users').push(user).write();
    db.get('instructors').push(instructor).write();
    logActivity(`Instructor ${instructor.name} added to faculty`);
    res.status(201).json(instructor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/instructors/:id
router.put('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const item = db.get('instructors').find({ id }).value();
    if (!item) {
      return res.status(404).json({ message: 'Instructor not found' });
    }

    const previousName = item.name;
    const { name, email, department, bio, status } = req.body;
    if (status !== undefined && !['active', 'on-leave'].includes(status)) {
      return res.status(400).json({ message: 'Invalid instructor status' });
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ message: 'Instructor name is required' });
    }
    if (email !== undefined && (typeof email !== 'string' || !email.trim())) {
      return res.status(400).json({ message: 'Instructor email is required' });
    }
    const nextEmail = email ? email.trim().toLowerCase() : item.email;
    const emailOwner = db.get('users').find(user =>
      user.id !== item.userId && user.email.toLowerCase() === nextEmail
    ).value();
    if (emailOwner) return res.status(400).json({ message: 'An account with this email already exists' });
    const updated = db.get('instructors')
      .find({ id })
      .assign({
        ...(name ? { name: name.trim() } : {}),
        ...(email ? { email: email.trim().toLowerCase() } : {}),
        ...(department !== undefined ? { department: department.trim() } : {}),
        ...(bio !== undefined ? { bio: bio.trim() } : {}),
        ...(status ? { status } : {})
      })
      .write();

    if (item.userId) {
      db.get('users').find({ id: item.userId }).assign({
        ...(name ? { name: name.trim() } : {}),
        ...(email ? { email: nextEmail } : {})
      }).write();
    }
    if (name && name.trim().toLowerCase() !== previousName.toLowerCase()) {
      db.get('courses').value()
        .filter(course => (course.instructor || '').toLowerCase() === previousName.toLowerCase())
        .forEach(course => {
          db.get('courses').find({ id: course.id }).assign({ instructor: name.trim() }).write();
        });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/instructors/:id
router.delete('/:id', protect, requireRoles('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const item = db.get('instructors').find({ id }).value();
    if (!item) {
      return res.status(404).json({ message: 'Instructor not found' });
    }

    db.get('instructors').remove({ id }).write();
    if (item.userId) db.get('users').remove({ id: item.userId }).write();
    db.get('courses').value()
      .filter(course => (course.instructor || '').toLowerCase() === item.name.toLowerCase())
      .forEach(course => {
        db.get('courses').find({ id: course.id }).assign({ instructor: '' }).write();
      });
    logActivity(`Instructor ${item.name} removed`);
    res.json({ success: true, message: 'Instructor removed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
