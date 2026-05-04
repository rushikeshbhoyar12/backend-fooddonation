const express = require('express');
const { find, findOne, updateOne, deleteOne, countDocuments, toObjectId } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get dashboard stats
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = {};

    // Total users by role
    const allUsers = await find('users', {});
    stats.users = {};
    allUsers.forEach(user => {
      stats.users[user.role] = (stats.users[user.role] || 0) + 1;
    });
    stats.users.total = allUsers.length;

    // Total donations by status
    const allDonations = await find('donations', {});
    stats.donations = {};
    allDonations.forEach(donation => {
      stats.donations[donation.status] = (stats.donations[donation.status] || 0) + 1;
    });
    stats.donations.total = allDonations.length;

    // Total requests by status
    const allRequests = await find('requests', {});
    stats.requests = {};
    allRequests.forEach(request => {
      stats.requests[request.status] = (stats.requests[request.status] || 0) + 1;
    });
    stats.requests.total = allRequests.length;

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentDonationsCount = await countDocuments('donations', { created_at: { $gte: thirtyDaysAgo } });

    stats.recentActivity = {
      donations: recentDonationsCount
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
    const users = await find('users', {}, { sort: { created_at: -1 } });

    res.json(users);

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// Get all donations (admin view)
router.get('/donations', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const donations = await find('donations', {}, { sort: { created_at: -1 } });

    // Enrich with donor info
    const enrichedDonations = await Promise.all(donations.map(async (donation) => {
      const donor = await findOne('users', { _id: toObjectId(donation.donor_id) });
      return {
        ...donation,
        donor_name: donor?.name,
        donor_email: donor?.email,
        donor_phone: donor?.phone
      };
    }));

    res.json(enrichedDonations);

  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ message: 'Server error fetching donations' });
  }
});

// Get all requests (admin view)
router.get('/requests', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const requests = await find('requests', {}, { sort: { requested_at: -1 } });

    // Enrich with donation and user info
    const enrichedRequests = await Promise.all(requests.map(async (request) => {
      const donation = await findOne('donations', { _id: toObjectId(request.donation_id) });
      const donor = await findOne('users', { _id: toObjectId(donation.donor_id) });
      const receiver = await findOne('users', { _id: toObjectId(request.receiver_id) });
      return {
        ...request,
        donation_title: donation?.title,
        food_type: donation?.food_type,
        donor_name: donor?.name,
        donor_email: donor?.email,
        receiver_name: receiver?.name,
        receiver_email: receiver?.email
      };
    }));

    res.json(enrichedRequests);

  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
});

// Update user role or status
router.put('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { role } = req.body;
    const userId = toObjectId(req.params.id);

    if (!['donor', 'receiver', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    await updateOne('users', { _id: userId }, { role });

    res.json({ message: 'User updated successfully' });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// Delete donation (admin)
router.delete('/donations/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const donationId = toObjectId(req.params.id);

    await deleteOne('donations', { _id: donationId });

    res.json({ message: 'Donation deleted successfully' });

  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({ message: 'Server error deleting donation' });
  }
});

module.exports = router;