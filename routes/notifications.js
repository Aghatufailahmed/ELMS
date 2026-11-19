const express = require('express');
const db = require('../config/db');
const { protect } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.get('/', protect, (req, res) => {
  const items = db.get('notifications')
    .filter(item => item.userId === req.user.id)
    .orderBy('created_at', 'desc')
    .value();
  res.json(items);
});

router.put('/:id/read', protect, (req, res) => {
  const notification = db.get('notifications')
    .find(item => item.id === req.params.id && item.userId === req.user.id)
    .value();
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  db.get('notifications').find({ id: notification.id }).assign({ read: true, read_at: new Date().toISOString() }).write();
  res.json({ success: true });
});

router.put('/read-all', protect, (req, res) => {
  const now = new Date().toISOString();
  db.get('notifications').value()
    .filter(item => item.userId === req.user.id && !item.read)
    .forEach(item => db.get('notifications').find({ id: item.id }).assign({ read: true, read_at: now }).write());
  res.json({ success: true });
});

module.exports = router;

module.exports.createNotification = (userId, title, message, type = 'info') => {
  db.get('notifications').push({
    id: uuidv4(),
    userId,
    title,
    message,
    type,
    read: false,
    created_at: new Date().toISOString()
  }).write();
};
