const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connect } = require('./config/database');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'Food Donation System API is running!', timestamp: new Date() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// Start server with MongoDB connection
async function startServer() {
  try {
    // Initialize MongoDB connection
    await connect();

    app.listen(PORT, () => {
      console.log(`🚀 Food Donation System API running on port ${PORT}`);
      console.log(`📦 MongoDB URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/food_donation_db'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
