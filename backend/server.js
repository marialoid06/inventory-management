const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===== ENV VALIDATION =====
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not defined');
}

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ===== DATABASE =====
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10
}).promise();

db.getConnection()
    .then(conn => {
        console.log('✅ DB connected');
        conn.release();
    })
    .catch(err => console.error('❌ DB error', err));

// ===== AUTH MIDDLEWARE =====
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ message: 'Admins only' });
    next();
};

// ==================================================
// AUTH ROUTES
// ==================================================
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        if (!firstName || !lastName || !email || !password)
            return res.status(400).json({ message: 'All fields required' });

        const [exists] = await db.query(
            'SELECT user_id FROM users WHERE email=?', [email]
        );
        if (exists.length) return res.status(409).json({ message: 'Email exists' });

        const hashed = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (first_name,last_name,email,password,role) VALUES (?,?,?,?,?)',
            [firstName, lastName, email, hashed, 'customer']
        );

        res.status(201).json({ message: 'Registered successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Register error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await db.query(
            'SELECT * FROM users WHERE email=?', [email]
        );

        if (!users.length) return res.status(401).json({ message: 'Invalid credentials' });

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { userId: user.user_id, role: user.role, firstName: user.first_name },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            token,
            user: { role: user.role, firstName: user.first_name }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Login error' });
    }
});

// ==================================================
// ADMIN ROUTES
// ==================================================
const adminRoutes = express.Router();
adminRoutes.use(authMiddleware, adminMiddleware);

adminRoutes.get('/stats', async (_, res) => {
    try {
        const [[p]] = await db.query('SELECT COUNT(*) total FROM products');
        res.json({ totalProducts: p.total });
    } catch {
        res.status(500).json({ message: 'Stats error' });
    }
});

app.use('/api/admin', adminRoutes);

// ==================================================
// CUSTOMER ROUTES
// ==================================================
const customerRoutes = express.Router();
customerRoutes.use(authMiddleware);

customerRoutes.get('/products', async (_, res) => {
    const [products] = await db.query(
        'SELECT product_id, product_name, selling_price, stock FROM products WHERE stock>0'
    );
    res.json(products);
});

app.use('/api/customer', customerRoutes);

// ==================================================
// FRONTEND ENTRY
// ==================================================
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// ===== START SERVER (ONLY ONCE) =====
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
