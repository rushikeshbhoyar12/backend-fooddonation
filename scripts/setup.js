const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  try {
    // Connect to MySQL without specifying database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'food_donation_db'}`);
    console.log('✅ Database created successfully');

    await connection.end();

    // Connect to the specific database
    const dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'food_donation_db'
    });

    // Create tables one by one
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('donor', 'receiver', 'admin') NOT NULL DEFAULT 'receiver',
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        zip_code VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS donations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        donor_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        food_type VARCHAR(100) NOT NULL,
        quantity VARCHAR(100) NOT NULL,
        expiry_date DATE,
        pickup_location TEXT NOT NULL,
        contact_info VARCHAR(255) NOT NULL,
        status ENUM('available', 'reserved', 'completed', 'expired') DEFAULT 'available',
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        donation_id INT NOT NULL,
        receiver_id INT NOT NULL,
        status ENUM('pending', 'accepted', 'rejected', 'completed') DEFAULT 'pending',
        message TEXT,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_request (donation_id, receiver_id)
      )`,

      `CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('request', 'approval', 'rejection', 'completion', 'system') NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ];

    // Execute table creation queries
    for (const tableQuery of tables) {
      await dbConnection.execute(tableQuery);
    }
    console.log('✅ All tables created successfully');

    // Create indexes with error handling for duplicates
    const indexes = [
      'CREATE INDEX idx_donations_donor_id ON donations(donor_id)',
      'CREATE INDEX idx_donations_status ON donations(status)',
      'CREATE INDEX idx_requests_donation_id ON requests(donation_id)',
      'CREATE INDEX idx_requests_receiver_id ON requests(receiver_id)',
      'CREATE INDEX idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX idx_notifications_is_read ON notifications(is_read)'
    ];

    // Execute index creation queries with individual error handling
    for (const indexQuery of indexes) {
      try {
        await dbConnection.execute(indexQuery);
      } catch (error) {
        // Ignore duplicate index errors (error code 1061)
        if (error.errno !== 1061) {
          throw error;
        }
      }
    }
    console.log('✅ All indexes created successfully');

    await dbConnection.end();

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();