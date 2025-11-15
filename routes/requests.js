const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Create request (receivers only)
router.post('/', authenticateToken, requireRole(['receiver']), async (req, res) => {
  try {
    const { donationId, message } = req.body;
    const receiverId = req.user.id;

    if (!donationId) {
      return res.status(400).json({ message: 'Donation ID is required' });
    }

    // Check if donation exists and is available
    const donations = await executeQuery('SELECT * FROM donations WHERE id = ? AND status = "available"', [donationId]);

    if (donations.length === 0) {
      return res.status(404).json({ message: 'Donation not found or not available' });
    }

    // Check if user already requested this donation
    const existingRequests = await executeQuery('SELECT * FROM requests WHERE donation_id = ? AND receiver_id = ?', [donationId, receiverId]);

    if (existingRequests.length > 0) {
      return res.status(400).json({ message: 'You have already requested this donation' });
    }

    // Create request
    const result = await executeQuery(`
      INSERT INTO requests (donation_id, receiver_id, message)
      VALUES (?, ?, ?)
    `, [donationId, receiverId, message || null]);

    // Create notification for donor
    const donation = donations[0];
    await executeQuery(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [
      donation.donor_id,
      'New Donation Request',
      `${req.user.name} has requested your donation: "${donation.title}"`,
      'request'
    ]);

    res.status(201).json({
      message: 'Request submitted successfully',
      requestId: result.insertId
    });

  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Server error creating request' });
  }
});

// Get user's requests (receivers)
router.get('/my-requests', authenticateToken, requireRole(['receiver']), async (req, res) => {
  try {
    const requests = await executeQuery(`
      SELECT r.*, d.title, d.food_type, d.quantity, d.pickup_location, d.status as donation_status,
             u.name as donor_name, u.phone as donor_phone
      FROM requests r
      JOIN donations d ON r.donation_id = d.id
      JOIN users u ON d.donor_id = u.id
      WHERE r.receiver_id = ?
      ORDER BY r.requested_at DESC
    `, [req.user.id]);

    res.json(requests);

  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
});

// Get requests for donor's donations
router.get('/for-my-donations', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const requests = await executeQuery(`
      SELECT r.*, d.title, d.food_type, d.quantity,
             u.name as receiver_name, u.phone as receiver_phone, u.email as receiver_email
      FROM requests r
      JOIN donations d ON r.donation_id = d.id
      JOIN users u ON r.receiver_id = u.id
      WHERE d.donor_id = ?
      ORDER BY r.requested_at DESC
    `, [req.user.id]);

    res.json(requests);

  } catch (error) {
    console.error('Error fetching donation requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
});

// Update request status (donors only, for their donations)
router.put('/:id/status', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const { status } = req.body;
    const requestId = req.params.id;

    if (!['accepted', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if request exists and belongs to donor's donation
    const requests = await executeQuery(`
      SELECT r.*, d.donor_id, d.title, u.name as receiver_name
      FROM requests r
      JOIN donations d ON r.donation_id = d.id
      JOIN users u ON r.receiver_id = u.id
      WHERE r.id = ? AND d.donor_id = ?
    `, [requestId, req.user.id]);

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Request not found or not authorized' });
    }

    const request = requests[0];

    // Update request status
    await executeQuery('UPDATE requests SET status = ? WHERE id = ?', [status, requestId]);

    // If accepted, update donation status to reserved
    if (status === 'accepted') {
      await executeQuery('UPDATE donations SET status = ? WHERE id = ?', ['reserved', request.donation_id]);

      // Reject other pending requests for this donation
      await executeQuery(`
        UPDATE requests SET status = 'rejected' 
        WHERE donation_id = ? AND id != ? AND status = 'pending'
      `, [request.donation_id, requestId]);
    }

    // If completed, update donation status to completed
    if (status === 'completed') {
      await executeQuery('UPDATE donations SET status = ? WHERE id = ?', ['completed', request.donation_id]);
    }

    // Create notification for receiver
    let notificationMessage = '';
    let notificationType = '';

    if (status === 'accepted') {
      notificationMessage = `Your request for "${request.title}" has been accepted! Please contact the donor for pickup details.`;
      notificationType = 'approval';
    } else if (status === 'rejected') {
      notificationMessage = `Your request for "${request.title}" has been declined.`;
      notificationType = 'rejection';
    } else if (status === 'completed') {
      notificationMessage = `The donation "${request.title}" has been completed. Thank you!`;
      notificationType = 'completion';
    }

    await executeQuery(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [request.receiver_id, `Request ${status.charAt(0).toUpperCase() + status.slice(1)}`, notificationMessage, notificationType]);

    res.json({ message: 'Request status updated successfully' });

  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ message: 'Server error updating request status' });
  }
});

// Get requests for specific donation (donors only)
router.get('/donation/:donationId', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const donationId = req.params.donationId;

    // Verify donation belongs to the donor
    const donations = await executeQuery('SELECT * FROM donations WHERE id = ? AND donor_id = ?', [donationId, req.user.id]);

    if (donations.length === 0) {
      return res.status(404).json({ message: 'Donation not found or not authorized' });
    }

    const requests = await executeQuery(`
      SELECT r.*, u.name as receiver_name, u.phone as receiver_phone, u.email as receiver_email,
             u.address, u.city, u.state
      FROM requests r
      JOIN users u ON r.receiver_id = u.id
      WHERE r.donation_id = ?
      ORDER BY r.requested_at DESC
    `, [donationId]);

    res.json(requests);

  } catch (error) {
    console.error('Error fetching donation requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
});

// Complete request (receivers only, for accepted requests)
router.put('/:id/complete', authenticateToken, requireRole(['receiver']), async (req, res) => {
  try {
    const requestId = req.params.id;

    // Check if request exists and belongs to the receiver and is accepted
    const requests = await executeQuery(`
      SELECT r.*, d.title, d.donor_id, u.name as donor_name
      FROM requests r
      JOIN donations d ON r.donation_id = d.id
      JOIN users u ON d.donor_id = u.id
      WHERE r.id = ? AND r.receiver_id = ? AND r.status = 'accepted'
    `, [requestId, req.user.id]);

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Request not found, not authorized, or not accepted' });
    }

    const request = requests[0];

    // Update request status to completed
    await executeQuery('UPDATE requests SET status = ? WHERE id = ?', ['completed', requestId]);

    // Update donation status to completed
    await executeQuery('UPDATE donations SET status = ? WHERE id = ?', ['completed', request.donation_id]);

    // Create notification for donor
    await executeQuery(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [
      request.donor_id,
      'Donation Completed',
      `${req.user.name} has confirmed pickup completion for "${request.title}". Thank you for your donation!`,
      'completion'
    ]);

    res.json({ message: 'Request marked as completed successfully' });

  } catch (error) {
    console.error('Error completing request:', error);
    res.status(500).json({ message: 'Server error completing request' });
  }
});

module.exports = router;