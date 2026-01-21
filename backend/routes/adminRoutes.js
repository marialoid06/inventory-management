// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware: Verify Admin
const verifyAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ message: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET || 'secretkey123', (err, decoded) => {
        if (err || decoded.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });
        req.user = decoded;
        next();
    });
};

router.use(verifyAdmin); // Apply to all routes below

// 1. DASHBOARD STATS
router.get('/stats', async (req, res) => {
    try {
        const [prodCount] = await db.query('SELECT COUNT(*) as count FROM products');
        const [supCount] = await db.query('SELECT COUNT(*) as count FROM suppliers');
        const [valCount] = await db.query('SELECT SUM(stock * cost_price) as value FROM products');
        
        res.json({
            totalProducts: prodCount[0].count,
            totalSuppliers: supCount[0].count,
            inventoryValue: valCount[0].value || 0
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/low-stock', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM products WHERE stock < 10');
    res.json(rows);
});

// 2. PRODUCTS CRUD
router.get('/products', async (req, res) => {
    const search = req.query.search || '';
    const query = `
        SELECT p.*, c.category_name, s.supplier_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
        WHERE p.product_name LIKE ?`;
    const [rows] = await db.query(query, [`%${search}%`]);
    res.json(rows);
});

router.post('/products', async (req, res) => {
    const { product_name, category_id, supplier_id, stock, cost_price, selling_price } = req.body;
    await db.query('INSERT INTO products (product_name, category_id, supplier_id, stock, cost_price, selling_price) VALUES (?, ?, ?, ?, ?, ?)', 
        [product_name, category_id, supplier_id, stock, cost_price, selling_price]);
    res.json({ message: 'Product added' });
});

router.put('/products/:id', async (req, res) => {
    const { product_name, category_id, supplier_id, stock, cost_price, selling_price } = req.body;
    await db.query('UPDATE products SET product_name=?, category_id=?, supplier_id=?, stock=?, cost_price=?, selling_price=? WHERE product_id=?', 
        [product_name, category_id, supplier_id, stock, cost_price, selling_price, req.params.id]);
    res.json({ message: 'Product updated' });
});

router.delete('/products/:id', async (req, res) => {
    await db.query('DELETE FROM products WHERE product_id = ?', [req.params.id]);
    res.json({ message: 'Product deleted' });
});

// 3. CATEGORIES & SUPPLIERS (Simple Get/Post)
router.get('/categories', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM categories');
    res.json(rows);
});
router.get('/suppliers', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM suppliers');
    res.json(rows);
});

// 4. ORDERS
router.get('/orders', async (req, res) => {
    const search = req.query.search || '';
    const sql = `
        SELECT o.*, CONCAT(u.first_name, ' ', u.last_name) as customer_name 
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.order_id LIKE ? OR u.first_name LIKE ?
        ORDER BY o.order_date DESC`;
    const [rows] = await db.query(sql, [`%${search}%`, `%${search}%`]);
    res.json(rows);
});

router.get('/orders/:id', async (req, res) => {
    const [order] = await db.query(`SELECT o.*, CONCAT(u.first_name, ' ', u.last_name) as customer_name FROM orders o JOIN users u ON o.user_id = u.id WHERE order_id = ?`, [req.params.id]);
    const [items] = await db.query(`SELECT oi.*, p.product_name as product_name_snapshot FROM order_items oi JOIN products p ON oi.product_id = p.product_id WHERE order_id = ?`, [req.params.id]);
    res.json({ order: order[0], items });
});

router.put('/orders/:id/cancel', async (req, res) => {
    // Logic: If cancelled, you should ideally return stock. For now, simple status update.
    await db.query('UPDATE orders SET status = "Cancelled" WHERE order_id = ?', [req.params.id]);
    res.json({ message: 'Order Cancelled' });
});

module.exports = router;