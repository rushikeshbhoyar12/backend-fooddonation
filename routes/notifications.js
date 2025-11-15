const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await executeQuery(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [req.user.id]);

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
    const notifications = await executeQuery('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [notificationId, req.user.id]);
    
    if (notifications.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await executeQuery('UPDATE notifications SET is_read = TRUE WHERE id = ?', [notificationId]);

    res.json({ message: 'Notification marked as read' });

  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ message: 'Server error updating notification' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await executeQuery('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);

    res.json({ message: 'All notifications marked as read' });

  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({ message: 'Server error updating notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ? AND is_read = FALSE
    `, [req.user.id]);

    res.json({ count: result[0].count });

  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error fetching unread count' });
  }
});

module.exports = router;