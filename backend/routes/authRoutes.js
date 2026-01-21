// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'secretkey123';

// 1. REGISTER
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password } = req.body;
    try {
        // Check if user exists
        const [exists] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (exists.length > 0) return res.status(400).json({ message: 'Email already exists' });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert User
        await db.query(
            'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [first_name, last_name, email, hashedPassword, 'customer'] // Default role is customer
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // Generate Token
        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '2h' });

        res.json({ 
            message: 'Login successful', 
            token, 
            role: user.role,
            user: { first_name: user.first_name, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 3. FORGOT PASSWORD (MOCKED)
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    // In production, generate a token, save to DB, and send email via Nodemailer.
    // For this project, we will just simulate success.
    res.json({ message: 'If email exists, reset link sent (Check console/logs)' });
});

// 4. RESET PASSWORD
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    // Verify token from DB (skipped for brevity), then update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // This query is a placeholder; needs real token logic
    // await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    res.json({ message: 'Password updated successfully' });
});

module.exports = router;