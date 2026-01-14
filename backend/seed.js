// backend/seed.js
const bcrypt = require('bcryptjs');
const db = require('./db'); // This imports your db.js file!
require('dotenv').config();

async function seedDatabase() {
    console.log('Seeding database...');
    try {
        // Hash passwords
        const adminPass = await bcrypt.hash('admin_password123', 10);
        const lilyPass = await bcrypt.hash('lily_password123', 10);

        // Insert Admin
        await db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=email',
            ['admin', 'admin@inventory.com', adminPass, 'admin']
        );
        console.log('Admin user created/verified.');

        // Insert Customer 'lily'
        await db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=email',
            ['lily', 'lily@example.com', lilyPass, 'customer']
        );
        console.log('Customer "lily" created/verified.');

        console.log('Database seeding complete!');
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        // Close the connection pool
        db.end();
    }
}

seedDatabase();