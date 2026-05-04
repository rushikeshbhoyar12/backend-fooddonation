const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/food_donation_db';
let client;
let db;

async function connect() {
  try {
    if (!client) {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db();
      console.log('✅ Connected to MongoDB');

      // Create indexes for better performance
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('donations').createIndex({ donor_id: 1 });
      await db.collection('requests').createIndex({ donation_id: 1, receiver_id: 1 });
      await db.collection('notifications').createIndex({ user_id: 1 });
    }
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

async function getCollection(collectionName) {
  if (!db) {
    await connect();
  }
  return db.collection(collectionName);
}

async function closeConnection() {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Helper functions for common operations
const dbHelpers = {
  // Convert string ID to ObjectId
  toObjectId: (id) => {
    return typeof id === 'string' ? new ObjectId(id) : id;
  },

  // Insert one document
  insertOne: async (collection, document) => {
    const col = await getCollection(collection);
    return col.insertOne(document);
  },

  // Find one document
  findOne: async (collection, query) => {
    const col = await getCollection(collection);
    return col.findOne(query);
  },

  // Find many documents
  find: async (collection, query = {}, options = {}) => {
    const col = await getCollection(collection);
    return col.find(query).toArray();
  },

  // Update one document
  updateOne: async (collection, query, update) => {
    const col = await getCollection(collection);
    return col.updateOne(query, { $set: update });
  },

  // Delete one document
  deleteOne: async (collection, query) => {
    const col = await getCollection(collection);
    return col.deleteOne(query);
  },

  // Count documents
  countDocuments: async (collection, query = {}) => {
    const col = await getCollection(collection);
    return col.countDocuments(query);
  }
};

module.exports = {
  connect,
  getCollection,
  closeConnection,
  ObjectId,
  ...dbHelpers
};