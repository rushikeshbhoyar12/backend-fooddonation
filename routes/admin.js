const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get dashboard stats
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = {};

    // Total users by role
    const userStats = await executeQuery(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);
    
    stats.users = userStats.reduce((acc, stat) => {
      acc[stat.role] = stat.count;
      return acc;
    }, {});
    
    stats.users.total = userStats.reduce((sum, stat) => sum + stat.count, 0);

    // Total donations by status
    const donationStats = await executeQuery(`
      SELECT status, COUNT(*) as count 
      FROM donations 
      GROUP BY status
    `);
    
    stats.donations = donationStats.reduce((acc, stat) => {
      acc[stat.status] = stat.count;
      return acc;
    }, {});
    
    stats.donations.total = donationStats.reduce((sum, stat) => sum + stat.count, 0);

    // Total requests by status
    const requestStats = await executeQuery(`
      SELECT status, COUNT(*) as count 
      FROM requests 
      GROUP BY status
    `);
    
    stats.requests = requestStats.reduce((acc, stat) => {
      acc[stat.status] = stat.count;
      return acc;
    }, {});
    
    stats.requests.total = requestStats.reduce((sum, stat) => sum + stat.count, 0);

    // Recent activity (last 30 days)
    const recentDonations = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM donations 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    
    stats.recentActivity = {
      donations: recentDonations[0].count
    };

    res.json(stats);

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Server error fetching statistics' });
  }
});

// Get all users
router.get('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await executeQuery(`
      SELECT id, name, email, role, phone, city, state, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(users);

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// Get all donations (admin view)
router.get('/donations', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const donations = await executeQuery(`
      SELECT d.*, u.name as donor_name, u.email as donor_email, u.phone as donor_phone
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      ORDER BY d.created_at DESC
    `);

    res.json(donations);

  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ message: 'Server error fetching donations' });
  }
});

// Get all requests (admin view)
router.get('/requests', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const requests = await executeQuery(`
      SELECT r.*, d.title as donation_title, d.food_type,
             donor.name as donor_name, donor.email as donor_email,
             receiver.name as receiver_name, receiver.email as receiver_email
      FROM requests r
      JOIN donations d ON r.donation_id = d.id
      JOIN users donor ON d.donor_id = donor.id
      JOIN users receiver ON r.receiver_id = receiver.id
      ORDER BY r.requested_at DESC
    `);

    res.json(requests);

  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
});

// Update user role or status
router.put('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!['donor', 'receiver', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    await executeQuery('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    res.json({ message: 'User updated successfully' });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// Delete donation (admin)
router.delete('/donations/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const donationId = req.params.id;

    await executeQuery('DELETE FROM donations WHERE id = ?', [donationId]);

    res.json({ message: 'Donation deleted successfully' });

  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({ message: 'Server error deleting donation' });
  }
});

module.exports = router;