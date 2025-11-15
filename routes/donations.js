const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all donations (with filtering)
router.get('/', async (req, res) => {
  try {
    const { status, food_type, city } = req.query;

    let query = `
      SELECT d.*, u.name as donor_name, u.phone as donor_phone, u.city as donor_city
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND d.status = ?';
      params.push(status);
    }

    if (food_type) {
      query += ' AND d.food_type = ?';
      params.push(food_type);
    }

    if (city) {
      query += ' AND u.city LIKE ?';
      params.push(`%${city}%`);
    }

    query += ' ORDER BY d.created_at DESC';

    const donations = await executeQuery(query, params);
    res.json({ donations });

  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ message: 'Server error fetching donations' });
  }
});

// Get donation by ID
router.get('/:id', async (req, res) => {
  try {
    const donations = await executeQuery(`
      SELECT d.*, u.name as donor_name, u.phone as donor_phone, u.email as donor_email, u.city as donor_city
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      WHERE d.id = ?
    `, [req.params.id]);

    if (donations.length === 0) {
      return res.status(404).json({ message: 'Donation not found' });
    }

    res.json({ donation: donations[0] });

  } catch (error) {
    console.error('Error fetching donation:', error);
    res.status(500).json({ message: 'Server error fetching donation' });
  }
});

// Create donation (donors only)
router.post('/', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const { title, description, food_type, quantity, expiry_date, pickup_location, contact_info, image_url } = req.body;
    const donorId = req.user.id;

    if (!title || !food_type || !quantity || !pickup_location || !contact_info) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await executeQuery(`
      INSERT INTO donations (donor_id, title, description, food_type, quantity, expiry_date, pickup_location, contact_info, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [donorId, title, description || null, food_type, quantity, expiry_date || null, pickup_location, contact_info, image_url || null]);

    res.status(201).json({
      message: 'Donation created successfully',
      donationId: result.insertId
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
    const donationId = req.params.id;
    const donorId = req.user.id;

    // Check if donation belongs to the donor
    const donations = await executeQuery('SELECT * FROM donations WHERE id = ? AND donor_id = ?', [donationId, donorId]);

    if (donations.length === 0) {
      return res.status(404).json({ message: 'Donation not found or not authorized' });
    }

    await executeQuery(`
      UPDATE donations 
      SET title = ?, description = ?, food_type = ?, quantity = ?, expiry_date = ?, 
          pickup_location = ?, contact_info = ?, status = ?, image_url = ?
      WHERE id = ? AND donor_id = ?
    `, [title, description, food_type, quantity, expiry_date, pickup_location, contact_info, status || 'available', image_url, donationId, donorId]);

    res.json({ message: 'Donation updated successfully' });

  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).json({ message: 'Server error updating donation' });
  }
});

// Delete donation (donor only, own donations)
router.delete('/:id', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const donationId = req.params.id;
    const donorId = req.user.id;

    // Check if donation belongs to the donor
    const donations = await executeQuery('SELECT * FROM donations WHERE id = ? AND donor_id = ?', [donationId, donorId]);

    if (donations.length === 0) {
      return res.status(404).json({ message: 'Donation not found or not authorized' });
    }

    await executeQuery('DELETE FROM donations WHERE id = ? AND donor_id = ?', [donationId, donorId]);

    res.json({ message: 'Donation deleted successfully' });

  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({ message: 'Server error deleting donation' });
  }
});

// Get donations by donor (authenticated donor)
router.get('/donor/my-donations', authenticateToken, requireRole(['donor']), async (req, res) => {
  try {
    const donations = await executeQuery(`
      SELECT d.*, 
             COUNT(r.id) as request_count,
             COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_requests
      FROM donations d
      LEFT JOIN requests r ON d.id = r.donation_id
      WHERE d.donor_id = ?
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `, [req.user.id]);

    res.json({ donations });

  } catch (error) {
    console.error('Error fetching donor donations:', error);
    res.status(500).json({ message: 'Server error fetching donations' });
  }
});

module.exports = router;