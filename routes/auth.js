const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, address, city, state, zipCode } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUsers = await executeQuery('SELECT * FROM users WHERE email = ?', [email]);
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await executeQuery(`
      INSERT INTO users (name, email, password, role, phone, address, city, state, zip_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, email, hashedPassword, role || 'receiver', phone || null, address || null, city || null, state || null, zipCode || null]);

    // Create token
    const token = jwt.sign(
      { userId: result.insertId, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: role || 'receiver'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const users = await executeQuery('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        city: user.city,
        state: user.state,
        zip_code: user.zip_code
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { password, ...userProfile } = req.user;
    res.json({ user: userProfile });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, address, city, state, zipCode } = req.body;
    const userId = req.user.id;

    await executeQuery(`
      UPDATE users 
      SET name = ?, phone = ?, address = ?, city = ?, state = ?, zip_code = ?
      WHERE id = ?
    `, [name, phone || null, address || null, city || null, state || null, zipCode || null, userId]);

    res.json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

module.exports = router;