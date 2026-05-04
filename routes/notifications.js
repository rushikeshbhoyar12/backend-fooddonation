const express = require('express');
const { find, findOne, updateOne, countDocuments, toObjectId } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await find('notifications', { user_id: req.user.id }, { sort: { created_at: -1 } });

    res.json(notifications);

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    // Verify notification belongs to user
    const notification = await findOne('notifications', { _id: toObjectId(notificationId), user_id: req.user.id });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await updateOne('notifications', { _id: toObjectId(notificationId) }, { is_read: true });

    res.json({ message: 'Notification marked as read' });

  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ message: 'Server error updating notification' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await updateOne('notifications', { user_id: req.user.id }, { is_read: true });

    res.json({ message: 'All notifications marked as read' });

  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({ message: 'Server error updating notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await countDocuments('notifications', { user_id: req.user.id, is_read: false });

    res.json({ count });

  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error fetching unread count' });
  }
});

module.exports = router;