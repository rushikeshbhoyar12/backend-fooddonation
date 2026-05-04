const { connect, getCollection } = require('../config/database');
require('dotenv').config();

async function setupDatabase() {
  try {
    console.log('🔧 Setting up MongoDB collections and indexes...');

    // Connect to MongoDB
    await connect();

    // Create collections with validation schemas
    const collections = ['users', 'donations', 'requests', 'notifications'];

    for (const collectionName of collections) {
      try {
        const col = await getCollection(collectionName);
        console.log(`✅ Collection '${collectionName}' ready`);
      } catch (error) {
        console.error(`❌ Error with collection '${collectionName}':`, error);
      }
    }

    // Create indexes for better performance
    const usersCollection = await getCollection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    console.log('✅ Index created: users.email (unique)');

    const donationsCollection = await getCollection('donations');
    await donationsCollection.createIndex({ donor_id: 1 });
    await donationsCollection.createIndex({ status: 1 });
    await donationsCollection.createIndex({ created_at: -1 });
    console.log('✅ Indexes created: donations (donor_id, status, created_at)');

    const requestsCollection = await getCollection('requests');
    await requestsCollection.createIndex({ donation_id: 1 });
    await requestsCollection.createIndex({ receiver_id: 1 });
    await requestsCollection.createIndex({ status: 1 });
    console.log('✅ Indexes created: requests (donation_id, receiver_id, status)');

    const notificationsCollection = await getCollection('notifications');
    await notificationsCollection.createIndex({ user_id: 1 });
    await notificationsCollection.createIndex({ is_read: 1 });
    await notificationsCollection.createIndex({ created_at: -1 });
    console.log('✅ Indexes created: notifications (user_id, is_read, created_at)');

    console.log('\n✅ Database setup completed successfully!');
    console.log('📦 MongoDB URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/food_donation_db');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();