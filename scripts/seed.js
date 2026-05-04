const bcrypt = require('bcryptjs');
const { connect, getCollection } = require('../config/database');

async function seedDatabase() {
  try {
    console.log('🌱 Seeding MongoDB database...');

    // Connect to MongoDB
    const db = await connect();

    // Clear existing data
    const collections = ['users', 'donations', 'requests', 'notifications'];
    for (const collName of collections) {
      try {
        await db.collection(collName).deleteMany({});
      } catch (error) {
        // Collection might not exist yet, that's okay
      }
    }

    // Hash passwords
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedDonorPassword = await bcrypt.hash('donor123', 10);
    const hashedReceiverPassword = await bcrypt.hash('receiver123', 10);

    // Insert default users
    const usersCollection = await getCollection('users');
    const userResults = await usersCollection.insertMany([
      {
        name: 'System Admin',
        email: 'admin@fooddonation.com',
        password: hashedAdminPassword,
        role: 'admin',
        phone: '+1-555-0100',
        address: '123 Admin Street',
        city: 'Admin City',
        state: 'Admin State',
        zip_code: '12345',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'John Donor',
        email: 'donor@example.com',
        password: hashedDonorPassword,
        role: 'donor',
        phone: '+1-555-0200',
        address: '456 Donor Avenue',
        city: 'Donor City',
        state: 'Donor State',
        zip_code: '12346',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Jane Receiver',
        email: 'receiver@example.com',
        password: hashedReceiverPassword,
        role: 'receiver',
        phone: '+1-555-0300',
        address: '789 Receiver Boulevard',
        city: 'Receiver City',
        state: 'Receiver State',
        zip_code: '12347',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Mike Restaurant',
        email: 'restaurant@example.com',
        password: await bcrypt.hash('restaurant123', 10),
        role: 'donor',
        phone: '+1-555-0400',
        address: '321 Restaurant Row',
        city: 'Food City',
        state: 'Food State',
        zip_code: '12348',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Sarah Community',
        email: 'community@example.com',
        password: await bcrypt.hash('community123', 10),
        role: 'receiver',
        phone: '+1-555-0500',
        address: '654 Community Center',
        city: 'Helper City',
        state: 'Helper State',
        zip_code: '12349',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Default users created');
    const userIds = userResults.insertedIds;

    // Insert sample donations
    const donationsCollection = await getCollection('donations');
    const donationResults = await donationsCollection.insertMany([
      {
        donor_id: userIds[1].toString(), // John Donor
        title: 'Fresh Vegetables from Garden',
        description: 'Fresh organic vegetables including tomatoes, lettuce, carrots, and bell peppers. Perfect for families in need.',
        food_type: 'Vegetables',
        quantity: '10 lbs mixed vegetables',
        expiry_date: new Date('2024-01-15'),
        pickup_location: '456 Donor Avenue, Donor City, Donor State',
        contact_info: 'Call: +1-555-0200 or Email: donor@example.com',
        status: 'available',
        image_url: 'https://images.pexels.com/photos/1400172/pexels-photo-1400172.jpeg',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        donor_id: userIds[3].toString(), // Mike Restaurant
        title: 'Surplus Restaurant Meals',
        description: 'Freshly prepared meals from our restaurant. Includes pasta, salads, and bread. Must be picked up today.',
        food_type: 'Prepared Meals',
        quantity: '20 individual meals',
        expiry_date: new Date('2024-01-10'),
        pickup_location: '321 Restaurant Row, Food City, Food State',
        contact_info: 'Call: +1-555-0400 (Ask for Manager)',
        status: 'available',
        image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        donor_id: userIds[1].toString(), // John Donor
        title: 'Canned Goods Collection',
        description: 'Various canned goods including beans, soup, vegetables, and fruits. All items are well within expiry dates.',
        food_type: 'Canned Goods',
        quantity: '50+ canned items',
        expiry_date: new Date('2024-03-01'),
        pickup_location: 'Community Center Parking - 456 Donor Avenue',
        contact_info: 'Text: +1-555-0200 for pickup coordination',
        status: 'available',
        image_url: 'https://images.pexels.com/photos/6943520/pexels-photo-6943520.jpeg',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        donor_id: userIds[3].toString(), // Mike Restaurant
        title: 'Bakery Items - End of Day',
        description: 'Fresh bread, pastries, and baked goods from today. Great for families or shelters.',
        food_type: 'Bakery Items',
        quantity: '30+ assorted items',
        expiry_date: new Date('2024-01-09'),
        pickup_location: '321 Restaurant Row - Back entrance',
        contact_info: 'Available after 8 PM - Call +1-555-0400',
        status: 'available',
        image_url: 'https://images.pexels.com/photos/264939/pexels-photo-264939.jpeg',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Sample donations created');
    const donationIds = donationResults.insertedIds;

    // Insert sample requests
    const requestsCollection = await getCollection('requests');
    await requestsCollection.insertMany([
      {
        donation_id: donationIds[0].toString(),
        receiver_id: userIds[2].toString(), // Jane Receiver
        status: 'pending',
        message: 'Hi, I would like to request these vegetables for my family. Can pick up anytime today.',
        requested_at: new Date(),
        updated_at: new Date()
      },
      {
        donation_id: donationIds[1].toString(),
        receiver_id: userIds[4].toString(), // Sarah Community
        status: 'pending',
        message: 'Our community center would greatly benefit from these meals. We can arrange pickup immediately.',
        requested_at: new Date(),
        updated_at: new Date()
      },
      {
        donation_id: donationIds[2].toString(),
        receiver_id: userIds[2].toString(), // Jane Receiver
        status: 'accepted',
        message: 'Thank you for considering our request. We have transportation available.',
        requested_at: new Date(),
        updated_at: new Date()
      },
      {
        donation_id: donationIds[3].toString(),
        receiver_id: userIds[4].toString(), // Sarah Community
        status: 'pending',
        message: 'These bakery items would be perfect for our food drive. Please let us know pickup details.',
        requested_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Sample requests created');

    // Insert sample notifications
    const notificationsCollection = await getCollection('notifications');
    await notificationsCollection.insertMany([
      {
        user_id: userIds[1].toString(), // John Donor
        title: 'New Donation Request',
        message: 'Jane Receiver has requested your "Fresh Vegetables from Garden" donation.',
        type: 'request',
        is_read: false,
        created_at: new Date()
      },
      {
        user_id: userIds[3].toString(), // Mike Restaurant
        title: 'New Donation Request',
        message: 'Sarah Community has requested your "Surplus Restaurant Meals" donation.',
        type: 'request',
        is_read: false,
        created_at: new Date()
      },
      {
        user_id: userIds[2].toString(), // Jane Receiver
        title: 'Request Accepted',
        message: 'Your request for "Canned Goods Collection" has been accepted by the donor.',
        type: 'approval',
        is_read: false,
        created_at: new Date()
      },
      {
        user_id: userIds[4].toString(), // Sarah Community
        title: 'New Donation Request',
        message: 'Sarah Community has requested "Bakery Items - End of Day".',
        type: 'request',
        is_read: false,
        created_at: new Date()
      },
      {
        user_id: userIds[0].toString(), // Admin
        title: 'System Update',
        message: 'Welcome to the Food Donation System! Thank you for helping reduce food waste.',
        type: 'system',
        is_read: false,
        created_at: new Date()
      }
    ]);

    console.log('✅ Sample notifications created');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Default login credentials:');
    console.log('Admin: admin@fooddonation.com / admin123');
    console.log('Donor: donor@example.com / donor123');
    console.log('Receiver: receiver@example.com / receiver123');
    console.log('\n📦 MongoDB Database: food_donation_db');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();