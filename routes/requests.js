const express = require('express');
const { find, findOne, insertOne, updateOne, countDocuments, toObjectId } = require('../config/database');
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
    const donation = await findOne('donations', { _id: toObjectId(donationId), status: 'available' });

    if (!donation) {
      return res.status(404).json({ message: 'Donation not found or not available' });
    }

    // Check if user already requested this donation
    const existingRequest = await findOne('requests', { donation_id: donationId, receiver_id: receiverId });

    if (existingRequest) {
      return res.status(400).json({ message: 'You have already requested this donation' });
    }

    // Create request
    const result = await insertOne('requests', {
      donation_id: donationId,
      receiver_id: receiverId,
      message: message || null,
      status: 'pending',
      requested_at: new Date()
    });

    // Create notification for donor
    await insertOne('notifications', {
      user_id: donation.donor_id,
      title: 'New Donation Request',
      message: `${req.user.name} has requested your donation: "${donation.title}"`,
      type: 'request',
      is_read: false,
      created_at: new Date()
    });

    res.status(201).json({
      message: 'Request submitted successfully',
      requestId: result.insertedId.toString()
    });

  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Server error creating request' });
  }
});

// Get user's requests (receivers)
router.get('/my-requests', authenticateToken, requireRole(['receiver']), async (req, res) => {
  try {
    const requests = await find('requests', { receiver_id: req.user.id }, { sort: { requested_at: -1 } });

    // Enrich requests with donation and donor info
    const enrichedRequests = await Promise.all(requests.map(async (request) => {
      const donation = await findOne('donations', { _id: toObjectId(request.donation_id) });
      const donor = await findOne('users', { _id: toObjectId(donation.donor_id) });
      return {
        ...request,
        title: donation?.title,
        food_type: donation?.food_type,
        quantity: donation?.quantity,
        pickup_location: donation?.pickup_location,
        donation_status: donation?.status,
        donor_name: donor?.name,
        donor_phone: donor?.phone
      };
    }));

    res.json(enrichedRequests);

  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
});

// Get requests for donor's donations
router.get('/for-my-donations', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const donations = await find('donations', { donor_id: req.user.id });
    const donationIds = donations.map(d => d._id.toString());

    const requests = await find('requests', { donation_id: { $in: donationIds } }, { sort: { requested_at: -1 } });

    // Enrich requests with donation and receiver info
    const enrichedRequests = await Promise.all(requests.map(async (request) => {
      const donation = await findOne('donations', { _id: toObjectId(request.donation_id) });
      const receiver = await findOne('users', { _id: toObjectId(request.receiver_id) });
      return {
        ...request,
        title: donation?.title,
        food_type: donation?.food_type,
        quantity: donation?.quantity,
        receiver_name: receiver?.name,
        receiver_phone: receiver?.phone,
        receiver_email: receiver?.email
      };
    }));

    res.json(enrichedRequests);

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
    const request = await findOne('requests', { _id: toObjectId(requestId) });

    if (!request) {
      return res.status(404).json({ message: 'Request not found or not authorized' });
    }

    const donation = await findOne('donations', { _id: toObjectId(request.donation_id) });
    const receiver = await findOne('users', { _id: toObjectId(request.receiver_id) });

    if (!donation || donation.donor_id !== req.user.id) {
      return res.status(404).json({ message: 'Request not found or not authorized' });
    }

    // Update request status
    await updateOne('requests',
      { _id: toObjectId(requestId) },
      { status, updated_at: new Date() }
    );

    // If accepted, update donation status to reserved
    if (status === 'accepted') {
      await updateOne('donations',
        { _id: toObjectId(request.donation_id) },
        { status: 'reserved', updated_at: new Date() }
      );

      // Reject other pending requests for this donation
      const otherRequests = await find('requests', {
        donation_id: request.donation_id,
        _id: { $ne: toObjectId(requestId) },
        status: 'pending'
      });

      for (const otherReq of otherRequests) {
        await updateOne('requests',
          { _id: otherReq._id },
          { status: 'rejected', updated_at: new Date() }
        );
      }
    }

    // If completed, update donation status to completed
    if (status === 'completed') {
      await updateOne('donations',
        { _id: toObjectId(request.donation_id) },
        { status: 'completed', updated_at: new Date() }
      );
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

    await insertOne('notifications', {
      user_id: request.receiver_id,
      title: `Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: notificationMessage,
      type: notificationType,
      is_read: false,
      created_at: new Date()
    });

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
    const donation = await findOne('donations', { _id: toObjectId(donationId), donor_id: req.user.id });

    if (!donation) {
      return res.status(404).json({ message: 'Donation not found or not authorized' });
    }

    const requests = await find('requests', { donation_id: donationId }, { sort: { requested_at: -1 } });

    // Enrich requests with receiver info
    const enrichedRequests = await Promise.all(requests.map(async (request) => {
      const receiver = await findOne('users', { _id: toObjectId(request.receiver_id) });
      return {
        ...request,
        receiver_name: receiver?.name,
        receiver_phone: receiver?.phone,
        receiver_email: receiver?.email,
        address: receiver?.address,
        city: receiver?.city,
        state: receiver?.state
      };
    }));

    res.json(enrichedRequests);

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
    const request = await findOne('requests', { _id: toObjectId(requestId), receiver_id: req.user.id, status: 'accepted' });

    if (!request) {
      return res.status(404).json({ message: 'Request not found, not authorized, or not accepted' });
    }

    const donation = await findOne('donations', { _id: toObjectId(request.donation_id) });
    const donor = await findOne('users', { _id: toObjectId(donation.donor_id) });

    // Update request status to completed
    await updateOne('requests',
      { _id: toObjectId(requestId) },
      { status: 'completed', updated_at: new Date() }
    );

    // Update donation status to completed
    await updateOne('donations',
      { _id: toObjectId(request.donation_id) },
      { status: 'completed', updated_at: new Date() }
    );

    // Create notification for donor
    await insertOne('notifications', {
      user_id: donation.donor_id,
      title: 'Donation Completed',
      message: `${req.user.name} has confirmed pickup completion for "${donation.title}". Thank you for your donation!`,
      type: 'completion',
      is_read: false,
      created_at: new Date()
    });

    res.json({ message: 'Request marked as completed successfully' });

  } catch (error) {
    console.error('Error completing request:', error);
    res.status(500).json({ message: 'Server error completing request' });
  }
});

module.exports = router;