// routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware: Verify Customer
const verifyCustomer = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ message: 'No token' });
    jwt.verify(token, process.env.JWT_SECRET || 'secretkey123', (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Unauthorized' });
        req.user = decoded;
        next();
    });
};

router.use(verifyCustomer);

// 1. SHOP
router.get('/products', async (req, res) => {
    const { search, category } = req.query;
    let sql = `SELECT p.*, c.category_name FROM products p LEFT JOIN categories c ON p.category_id = c.category_id WHERE 1=1`;
    const params = [];
    
    if (search) {
        sql += ` AND p.product_name LIKE ?`;
        params.push(`%${search}%`);
    }
    if (category) {
        sql += ` AND p.category_id = ?`;
        params.push(category);
    }
    const [rows] = await db.query(sql, params);
    res.json(rows);
});

router.get('/categories', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM categories');
    res.json(rows);
});

// 2. CART
router.get('/cart', async (req, res) => {
    const sql = `
        SELECT c.id, c.quantity, p.product_name, p.selling_price as price, p.product_id
        FROM cart c
        JOIN products p ON c.product_id = p.product_id
        WHERE c.user_id = ?`;
    const [rows] = await db.query(sql, [req.user.id]);
    res.json(rows);
});

router.post('/cart', async (req, res) => {
    const { product_id, quantity } = req.body;
    // Check if item exists in cart
    const [existing] = await db.query('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', [req.user.id, product_id]);
    
    if (existing.length > 0) {
        await db.query('UPDATE cart SET quantity = quantity + ? WHERE id = ?', [quantity, existing[0].id]);
    } else {
        await db.query('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)', [req.user.id, product_id, quantity]);
    }
    res.json({ message: 'Added to cart' });
});

router.put('/cart/:id', async (req, res) => {
    await db.query('UPDATE cart SET quantity = ? WHERE id = ?', [req.body.quantity, req.params.id]);
    res.json({ message: 'Updated' });
});

router.delete('/cart/:id', async (req, res) => {
    await db.query('DELETE FROM cart WHERE id = ?', [req.params.id]);
    res.json({ message: 'Removed' });
});

// 3. CHECKOUT (TRANSACTION)
router.post('/checkout', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Get Cart Items
        const [cartItems] = await conn.query(
            `SELECT c.*, p.selling_price, p.stock FROM cart c JOIN products p ON c.product_id = p.product_id WHERE user_id = ? FOR UPDATE`, 
            [req.user.id]
        );

        if (cartItems.length === 0) throw new Error("Cart is empty");

        // 2. Calculate Total & Check Stock
        let total = 0;
        for (const item of cartItems) {
            if (item.stock < item.quantity) throw new Error(`Not enough stock for product ID ${item.product_id}`);
            total += item.selling_price * item.quantity;
        }

        // 3. Create Order
        const [orderResult] = await conn.query(
            'INSERT INTO orders (user_id, total_amount) VALUES (?, ?)', 
            [req.user.id, total]
        );
        const orderId = orderResult.insertId;

        // 4. Move Cart to Order Items & Reduce Stock
        for (const item of cartItems) {
            await conn.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price_snapshot) VALUES (?, ?, ?, ?)',
                [orderId, item.product_id, item.quantity, item.selling_price]
            );
            await conn.query(
                'UPDATE products SET stock = stock - ? WHERE product_id = ?',
                [item.quantity, item.product_id]
            );
        }

        // 5. Clear Cart
        await conn.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

        await conn.commit();
        res.json({ message: 'Order placed successfully', orderId });

    } catch (err) {
        await conn.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// 4. MY ORDERS
router.get('/orders', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC', [req.user.id]);
    res.json(rows);
});

router.put('/orders/:id/cancel', async (req, res) => {
    // In a real app, you would verify the order belongs to the user and restore stock
    await db.query('UPDATE orders SET status = "Cancelled" WHERE order_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Cancelled' });
});

// 5. PROFILE
router.get('/profile', async (req, res) => {
    const [rows] = await db.query('SELECT first_name, last_name, email, phone FROM users WHERE id = ?', [req.user.id]);
    res.json(rows[0]);
});

router.put('/profile', async (req, res) => {
    const { first_name, last_name, email } = req.body;
    await db.query('UPDATE users SET first_name=?, last_name=?, email=? WHERE id=?', [first_name, last_name, email, req.user.id]);
    res.json({ message: 'Updated' });
});

module.exports = router;