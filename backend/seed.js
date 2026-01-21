// backend/seed.js
const bcrypt = require('bcrypt'); // Changed from 'bcryptjs' to match your npm install
const db = require('./db'); 
require('dotenv').config({ path: '../.env' }); // Adjust path to find .env in root

async function seedDatabase() {
    console.log('Seeding database...');
    try {
        // 1. Hash passwords
        const adminPass = await bcrypt.hash('admin123', 10); // Password: admin123
        const lilyPass = await bcrypt.hash('lily123', 10);   // Password: lily123

        // 2. Insert Admin (Using first_name/last_name instead of username)
        await db.query(
            `INSERT INTO users (first_name, last_name, email, password, role) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE email=email`,
            ['Super', 'Admin', 'admin@inventory.com', adminPass, 'admin']
        );
        console.log('Admin user created (Email: admin@inventory.com / Pass: admin123)');

        // 3. Insert Customer 'Lily'
        await db.query(
            `INSERT INTO users (first_name, last_name, email, password, role) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE email=email`,
            ['Lily', 'Customer', 'lily@example.com', lilyPass, 'customer']
        );
        console.log('Customer "Lily" created (Email: lily@example.com / Pass: lily123)');

        console.log('Database seeding complete!');
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        // Close the connection pool so the script stops
        // Note: db.js uses a pool, usually we use pool.end() but db.js exports pool.promise()
        // If the script hangs at the end, press Ctrl + C.
        process.exit(0); 
    }
}

seedDatabase();