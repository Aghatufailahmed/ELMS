// routes/instructors.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { protect } = require('../middleware/auth');

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
router.get('/', protect, (req, res) => {
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
router.post('/', protect, (req, res) => {
  try {
    const { name, email, department, bio, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Instructor name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Instructor email is required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existing = db.get('instructors').find(i => i.email && i.email.toLowerCase() === trimmedEmail).value();
    if (existing) {
      return res.status(400).json({ message: 'An instructor with this email already exists' });
    }

    const instructor = {
      id: uuidv4(),
      name: name.trim(),
      email: trimmedEmail,
      department: (department && department.trim()) || 'General Faculty',
      bio: (bio && bio.trim()) || '',
      status: status === 'on-leave' ? 'on-leave' : 'active',
      created_at: new Date().toISOString()
    };

    db.get('instructors').push(instructor).write();
    logActivity(`Instructor ${instructor.name} added to faculty`);
    res.status(201).json(instructor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/instructors/:id
router.put('/:id', protect, (req, res) => {
  try {
    const { id } = req.params;
    const item = db.get('instructors').find({ id }).value();
    if (!item) {
      return res.status(404).json({ message: 'Instructor not found' });
    }

    const { name, email, department, bio, status } = req.body;
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

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/instructors/:id
router.delete('/:id', protect, (req, res) => {
  try {
    const { id } = req.params;
    const item = db.get('instructors').find({ id }).value();
    if (!item) {
      return res.status(404).json({ message: 'Instructor not found' });
    }

    db.get('instructors').remove({ id }).write();
    logActivity(`Instructor ${item.name} removed`);
    res.json({ success: true, message: 'Instructor removed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
