const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');

    // Hash passwords
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedDonorPassword = await bcrypt.hash('donor123', 10);
    const hashedReceiverPassword = await bcrypt.hash('receiver123', 10);

    // Insert default users
    const users = [
      [
        'System Admin',
        'admin@fooddonation.com',
        hashedAdminPassword,
        'admin',
        '+1-555-0100',
        '123 Admin Street',
        'Admin City',
        'Admin State',
        '12345'
      ],
      [
        'John Donor',
        'donor@example.com',
        hashedDonorPassword,
        'donor',
        '+1-555-0200',
        '456 Donor Avenue',
        'Donor City',
        'Donor State',
        '12346'
      ],
      [
        'Jane Receiver',
        'receiver@example.com',
        hashedReceiverPassword,
        'receiver',
        '+1-555-0300',
        '789 Receiver Boulevard',
        'Receiver City',
        'Receiver State',
        '12347'
      ],
      [
        'Mike Restaurant',
        'restaurant@example.com',
        await bcrypt.hash('restaurant123', 10),
        'donor',
        '+1-555-0400',
        '321 Restaurant Row',
        'Food City',
        'Food State',
        '12348'
      ],
      [
        'Sarah Community',
        'community@example.com',
        await bcrypt.hash('community123', 10),
        'receiver',
        '+1-555-0500',
        '654 Community Center',
        'Helper City',
        'Helper State',
        '12349'
      ]
    ];

    // Insert users one by one to handle duplicates properly
    for (const user of users) {
      await executeQuery(`
        INSERT INTO users (name, email, password, role, phone, address, city, state, zip_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          phone = VALUES(phone),
          address = VALUES(address),
          city = VALUES(city),
          state = VALUES(state),
          zip_code = VALUES(zip_code)
      `, user);
    }

    console.log('✅ Default users created');

    // Insert sample donations
    const sampleDonations = [
      [
        2, // donor_id (John Donor)
        'Fresh Vegetables from Garden',
        'Fresh organic vegetables including tomatoes, lettuce, carrots, and bell peppers. Perfect for families in need.',
        'Vegetables',
        '10 lbs mixed vegetables',
        '2024-01-15',
        '456 Donor Avenue, Donor City, Donor State',
        'Call: +1-555-0200 or Email: donor@example.com',
        'available',
        'https://images.pexels.com/photos/1400172/pexels-photo-1400172.jpeg'
      ],
      [
        4, // donor_id (Mike Restaurant)
        'Surplus Restaurant Meals',
        'Freshly prepared meals from our restaurant. Includes pasta, salads, and bread. Must be picked up today.',
        'Prepared Meals',
        '20 individual meals',
        '2024-01-10',
        '321 Restaurant Row, Food City, Food State',
        'Call: +1-555-0400 (Ask for Manager)',
        'available',
        'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'
      ],
      [
        2, // donor_id (John Donor)
        'Canned Goods Collection',
        'Various canned goods including beans, soup, vegetables, and fruits. All items are well within expiry dates.',
        'Canned Goods',
        '50+ canned items',
        '2024-03-01',
        'Community Center Parking - 456 Donor Avenue',
        'Text: +1-555-0200 for pickup coordination',
        'available',
        'https://images.pexels.com/photos/6943520/pexels-photo-6943520.jpeg'
      ],
      [
        4, // donor_id (Mike Restaurant)
        'Bakery Items - End of Day',
        'Fresh bread, pastries, and baked goods from today. Great for families or shelters.',
        'Bakery Items',
        '30+ assorted items',
        '2024-01-09',
        '321 Restaurant Row - Back entrance',
        'Available after 8 PM - Call +1-555-0400',
        'available',
        'https://images.pexels.com/photos/264939/pexels-photo-264939.jpeg'
      ]
    ];

    // Insert donations one by one (ignore duplicates)
    for (const donation of sampleDonations) {
      try {
        await executeQuery(`
          INSERT INTO donations (donor_id, title, description, food_type, quantity, expiry_date, pickup_location, contact_info, status, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, donation);
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') {
          throw error;
        }
        // Silently ignore duplicate entries
      }
    }

    console.log('✅ Sample donations created');

    // Insert sample requests
    const sampleRequests = [
      [1, 3, 'pending', 'Hi, I would like to request these vegetables for my family. Can pick up anytime today.'],
      [2, 5, 'pending', 'Our community center would greatly benefit from these meals. We can arrange pickup immediately.'],
      [3, 3, 'accepted', 'Thank you for considering our request. We have transportation available.'],
      [4, 5, 'pending', 'These bakery items would be perfect for our food drive. Please let us know pickup details.']
    ];

    // Insert requests one by one (ignore duplicates)
    for (const request of sampleRequests) {
      try {
        await executeQuery(`
          INSERT IGNORE INTO requests (donation_id, receiver_id, status, message)
          VALUES (?, ?, ?, ?)
        `, request);
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') {
          throw error;
        }
        // Silently ignore duplicate entries
      }
    }

    console.log('✅ Sample requests created');

    // Insert sample notifications
    const sampleNotifications = [
      [2, 'New Donation Request', 'Jane Receiver has requested your "Fresh Vegetables from Garden" donation.', 'request', false],
      [4, 'New Donation Request', 'Sarah Community has requested your "Surplus Restaurant Meals" donation.', 'request', false],
      [3, 'Request Accepted', 'Your request for "Canned Goods Collection" has been accepted by the donor.', 'approval', false],
      [5, 'New Donation Request', 'Sarah Community has requested "Bakery Items - End of Day".', 'request', false],
      [1, 'System Update', 'Welcome to the Food Donation System! Thank you for helping reduce food waste.', 'system', false]
    ];

    // Insert notifications one by one (ignore duplicates)
    for (const notification of sampleNotifications) {
      try {
        await executeQuery(`
          INSERT INTO notifications (user_id, title, message, type, is_read)
          VALUES (?, ?, ?, ?, ?)
        `, notification);
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') {
          throw error;
        }
        // Silently ignore duplicate entries
      }
    }

    console.log('✅ Sample notifications created');

    console.log('🎉 Database seeded successfully!');
    console.log('\n📋 Default login credentials:');
    console.log('Admin: admin@fooddonation.com / admin123');
    console.log('Donor: donor@example.com / donor123');
    console.log('Receiver: receiver@example.com / receiver123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();