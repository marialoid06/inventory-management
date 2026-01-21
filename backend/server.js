// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Look for .env in root

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- CRITICAL CHANGE: Serving Static Files ---
// Since server.js is in 'backend', we use '../public' to go up one level
app.use(express.static(path.join(__dirname, '../public')));

// Database & Routes
// We assume db.js is now next to server.js in the 'backend' folder
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const customerRoutes = require('./routes/customerRoutes');

app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);

// --- CRITICAL CHANGE: Default Route ---
// Pointing to login.html which is one folder up
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});