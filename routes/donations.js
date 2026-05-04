const express = require('express');
const { find, findOne, insertOne, updateOne, deleteOne, toObjectId, countDocuments } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all donations (with filtering)
router.get('/', async (req, res) => {
  try {
    const { status, food_type, city } = req.query;
    const filter = {};

    // Only show available and reserved donations (not completed/received)
    filter.status = { $in: ['available', 'reserved'] };

    if (status && ['available', 'reserved'].includes(status)) {
      filter.status = status;
    }

    if (food_type) {
      filter.food_type = food_type;
    }

    if (city) {
      filter['donor_city'] = { $regex: city, $options: 'i' };
    }

    const donations = await find('donations', filter, { sort: { created_at: -1 } });

    // Enrich donations with donor info
    const enrichedDonations = await Promise.all(donations.map(async (donation) => {
      const donor = await findOne('users', { _id: toObjectId(donation.donor_id) });
      return {
        ...donation,
        donor_name: donor?.name,
        donor_phone: donor?.phone,
        donor_city: donor?.city
      };
    }));

    res.json({ donations: enrichedDonations });

  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ message: 'Server error fetching donations' });
  }
});

// Get donations by donor (authenticated donor) - MUST BE BEFORE /:id route
router.get('/donor/my-donations', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const donations = await find('donations', { donor_id: req.userId }, { sort: { created_at: -1 } });

    // Add request counts
    const enrichedDonations = await Promise.all(donations.map(async (donation) => {
      const request_count = await countDocuments('requests', { donation_id: donation._id.toString() });
      const pending_requests = await countDocuments('requests', { donation_id: donation._id.toString(), status: 'pending' });
      return {
        ...donation,
        request_count,
        pending_requests
      };
    }));

    res.json({ donations: enrichedDonations });

  } catch (error) {
    console.error('Error fetching donor donations:', error);
    res.status(500).json({ message: 'Server error fetching donations' });
  }
});

// Get donation by ID
router.get('/:id', async (req, res) => {
  try {
    const donation = await findOne('donations', { _id: toObjectId(req.params.id) });

    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    const donor = await findOne('users', { _id: toObjectId(donation.donor_id) });
    const enrichedDonation = {
      ...donation,
      donor_name: donor?.name,
      donor_phone: donor?.phone,
      donor_email: donor?.email,
      donor_city: donor?.city
    };

    res.json({ donation: enrichedDonation });

  } catch (error) {
    console.error('Error fetching donation:', error);
    res.status(500).json({ message: 'Server error fetching donation' });
  }
});

// Create donation (donors only)
router.post('/', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const { title, description, food_type, quantity, expiry_date, pickup_location, contact_info, image_url } = req.body;

    if (!title || !food_type || !quantity || !pickup_location || !contact_info) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await insertOne('donations', {
      donor_id: req.userId,
      title,
      description: description || null,
      food_type,
      quantity,
      expiry_date: expiry_date || null,
      pickup_location,
      contact_info,
      image_url: image_url || null,
      status: 'available',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Get donor info
    const donor = await findOne('users', { _id: toObjectId(req.userId) });

    // Send notifications to all receivers
    const receivers = await find('users', { role: 'receiver' });
    for (const receiver of receivers) {
      await insertOne('notifications', {
        user_id: receiver._id.toString(),
        title: 'New Donation Available',
        message: `${donor?.name || 'A donor'} has posted a new ${food_type} donation: "${title}"`,
        type: 'new_donation',
        is_read: false,
        created_at: new Date()
      });
    }

    res.status(201).json({
      message: 'Donation created successfully',
      donationId: result.insertedId.toString()
    });

  } catch (error) {
    console.error('Error creating donation:', error);
    res.status(500).json({ message: 'Server error creating donation' });
  }
});

// Update donation (donor only, own donations)
router.put('/:id', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const { title, description, food_type, quantity, expiry_date, pickup_location, contact_info, status, image_url } = req.body;
    const donationId = toObjectId(req.params.id);

    // Check if donation belongs to the donor
    const donation = await findOne('donations', { _id: donationId, donor_id: req.userId });

    if (!donation) {
      return res.status(404).json({ message: 'Donation not found or not authorized' });
    }

    await updateOne('donations',
      { _id: donationId, donor_id: req.userId },
      {
        title,
        description,
        food_type,
        quantity,
        expiry_date,
        pickup_location,
        contact_info,
        status: status || 'available',
        image_url,
        updated_at: new Date()
      }
    );

    res.json({ message: 'Donation updated successfully' });

  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).json({ message: 'Server error updating donation' });
  }
});

// Delete donation (donor only, own donations)
router.delete('/:id', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const donationId = toObjectId(req.params.id);

    // Check if donation belongs to the donor
    const donation = await findOne('donations', { _id: donationId, donor_id: req.userId });

    if (!donation) {
      return res.status(404).json({ message: 'Donation not found or not authorized' });
    }

    await deleteOne('donations', { _id: donationId, donor_id: req.userId });

    res.json({ message: 'Donation deleted successfully' });

  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({ message: 'Server error deleting donation' });
  }
});

// Get received donations for a receiver
router.get('/received/my-received', authenticateToken, requireRole(['receiver']), async (req, res) => {
  try {
    // Get all completed requests for this receiver
    const completedRequests = await find('requests', { receiver_id: req.userId, status: 'completed' });

    if (completedRequests.length === 0) {
      return res.json({ donations: [] });
    }

    // Get all donations for those requests
    const donationIds = completedRequests.map(r => r.donation_id);
    const donations = await find('donations', { _id: { $in: donationIds.map(id => toObjectId(id)) } });

    // Enrich with donor info
    const enrichedDonations = await Promise.all(donations.map(async (donation) => {
      const donor = await findOne('users', { _id: toObjectId(donation.donor_id) });
      return {
        ...donation,
        donor_name: donor?.name,
        donor_phone: donor?.phone,
        donor_city: donor?.city
      };
    }));

    res.json({ donations: enrichedDonations });

  } catch (error) {
    console.error('Error fetching received donations:', error);
    res.status(500).json({ message: 'Server error fetching received donations' });
  }
});

module.exports = router;