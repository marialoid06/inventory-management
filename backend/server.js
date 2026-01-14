const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3001; // Use the port Render gives us, or 3001 locally
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// --- Database Connection (Dynamic) ---
// This configuration works for both LOCAL (using your .env file)
// and DEPLOYMENT (using Render's environment variables).
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// Test the connection when the server starts
db.getConnection()
    .then(connection => {
        console.log('✅ Successfully connected to the database!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err);
    });
// START SERVER (MANDATORY)
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
// Middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token.' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access forbidden. Admins only.' });
    }
    next();
};

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ... (imports and db connection setup as previously defined)

// --- API AUTHENTICATION ROUTES ---
app.post('/api/register', async (req, res) => {
    try {
        // CHANGED: Expect firstName and lastName to match frontend
        const { firstName, lastName, email, password } = req.body;
        
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        
        const [userExists] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (userExists.length > 0) {
            return res.status(409).json({ message: 'Email already in use.' }); // 409 Conflict is better for duplicates
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // CHANGED: Insert into first_name and last_name columns
        await db.query(
            'INSERT INTO Users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [firstName, lastName, email, hashedPassword, 'customer'] // Default role is customer
        );
        
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
        
        if (users.length === 0) return res.status(401).json({ message: 'Invalid email or password.' });
        
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) return res.status(401).json({ message: 'Invalid email or password.' });
        
        const token = jwt.sign(
            { userId: user.user_id, role: user.role, firstName: user.first_name }, 
            process.env.JWT_SECRET || 'fallback-secret', 
            { expiresIn: '1h' }
        );
        
        res.json({ message: 'Login successful!', token, user: { role: user.role, firstName: user.first_name } });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(200).json({ message: 'If your email is registered, you will receive a reset link.' });
        }
        const user = users[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000);
        await db.query('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?', [token, expires, user.user_id]);
        await sendPasswordResetEmail(user.email, token);
        res.status(200).json({ message: 'If your email is registered, you will receive a reset link.' });
    } catch (error) {
        console.error("Forgot PW Error:", error);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        const [users] = await db.query('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
        if (users.length === 0) return res.status(400).json({ message: 'Invalid or expired password reset token.' });
        const user = users[0];
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?', [hashedPassword, user.user_id]);
        res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error("Reset PW Error:", error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// --- API ADMIN ROUTES ---
const adminRoutes = express.Router();
adminRoutes.use(authMiddleware, adminMiddleware);

adminRoutes.get('/profile/basic', async (req, res) => {
    try {
        res.json({ username: req.user.username });
    } catch (error) { res.status(500).json({ message: 'Server error fetching user.' }); }
});

adminRoutes.get('/stats', async (req, res) => {
    try {
        const [productCount] = await db.query('SELECT COUNT(*) as totalProducts FROM products');
        const [supplierCount] = await db.query('SELECT COUNT(*) as totalSuppliers FROM suppliers');
        const [inventoryValue] = await db.query('SELECT SUM(stock * cost_price) as totalValue FROM products');
        
        res.json({
            totalProducts: productCount[0].totalProducts,
            totalSuppliers: supplierCount[0].totalSuppliers,
            inventoryValue: inventoryValue[0].totalValue || 0
        });
    } catch (error) { res.status(500).json({ message: 'Server error fetching stats.' }); }
});

adminRoutes.get('/low-stock', async (req, res) => {
    try {
        const [items] = await db.query('SELECT product_id, product_name, stock FROM products WHERE stock <= 15 ORDER BY product_id ASC');
        res.json(items);
    } catch (error) { res.status(500).json({ message: 'Server error fetching low stock items.' }); }
});

// ... (Product, Category, Supplier CRUD routes remain the same) ...
// --- PRODUCTS (CRUD) ---
adminRoutes.get('/products', async (req, res) => {
    const { search } = req.query;
    let query = `
        SELECT p.*, c.category_name, s.supplier_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
    `;
    const params = [];
    if (search) {
        query += ' WHERE p.product_name LIKE ? OR p.product_id LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
    }
    try {
        const [products] = await db.query(query, params);
        res.json(products);
    } catch (error) { res.status(500).json({ message: 'Server error fetching products.' }); }
});

adminRoutes.post('/products', async (req, res) => {
    try {
        const { product_name, category_id, supplier_id, stock, cost_price, selling_price } = req.body;
        if (!product_name) return res.status(400).json({ message: 'Product Name is compulsory.' });
        if (stock < 0) return res.status(400).json({ message: 'Stock can never be less than 0.'});

        await db.query(
            'INSERT INTO products (product_name, category_id, supplier_id, stock, cost_price, selling_price) VALUES (?, ?, ?, ?, ?, ?)',
            [product_name, category_id || null, supplier_id || null, stock, cost_price || 0.00, selling_price || 0.00]
        );
        res.status(201).json({ message: 'Product added successfully' });
    } catch (error) { 
        console.error("Add Product Error:", error);
        res.status(500).json({ message: 'Server error adding product.' }); 
    }
});

adminRoutes.put('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { product_name, category_id, supplier_id, stock, cost_price, selling_price } = req.body;
        if (!product_name) return res.status(400).json({ message: 'Product Name is compulsory.' });
        if (stock < 0) return res.status(400).json({ message: 'Stock can never be less than 0.'});

        await db.query(
            'UPDATE products SET product_name = ?, category_id = ?, supplier_id = ?, stock = ?, cost_price = ?, selling_price = ? WHERE product_id = ?',
            [product_name, category_id || null, supplier_id || null, stock, cost_price || 0.00, selling_price || 0.00, id]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (error) { 
        console.error("Update Product Error:", error);
        res.status(500).json({ message: 'Server error updating product.' }); 
    }
});

adminRoutes.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [orderItems] = await db.query('SELECT * FROM order_items WHERE product_id = ?', [id]);
        if (orderItems.length > 0) {
            return res.status(400).json({ message: 'Cannot delete. Product is part of existing orders. Set stock to 0 instead.' });
        }
        await db.query('DELETE FROM products WHERE product_id = ?', [id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) { res.status(500).json({ message: 'Server error deleting product.' }); }
});


// --- CATEGORIES (CRUD) ---
adminRoutes.get('/categories', async (req, res) => {
    const { search } = req.query;
    let query = 'SELECT * FROM categories';
    const params = [];
    if (search) {
        query += ' WHERE category_name LIKE ?';
        params.push(`%${search}%`);
    }
    try {
        const [categories] = await db.query(query, params);
        res.json(categories);
    } catch (error) { res.status(500).json({ message: 'Server error fetching categories.' }); }
});

adminRoutes.post('/categories', async (req, res) => {
    try {
        const { category_name } = req.body;
        if (!category_name) return res.status(400).json({ message: 'Category name is required.' });
        await db.query('INSERT INTO categories (category_name) VALUES (?)', [category_name]);
        res.status(201).json({ message: 'Category added successfully' });
    } catch (error) { res.status(500).json({ message: 'Server error adding category.' }); }
});

adminRoutes.put('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category_name } = req.body;
        if (!category_name) return res.status(400).json({ message: 'Category name is required.' });
        await db.query('UPDATE categories SET category_name = ? WHERE category_id = ?', [category_name, id]);
        res.json({ message: 'Category updated successfully' });
    } catch (error) { res.status(500).json({ message: 'Server error updating category.' }); }
});

adminRoutes.delete('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [products] = await db.query('SELECT * FROM products WHERE category_id = ?', [id]);
        if (products.length > 0) {
            return res.status(400).json({ message: 'Cannot delete. Category is in use by products.'});
        }
        await db.query('DELETE FROM categories WHERE category_id = ?', [id]);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) { res.status(500).json({ message: 'Server error deleting category.' }); }
});


// --- SUPPLIERS (CRUD) ---
adminRoutes.get('/suppliers', async (req, res) => {
    const { search } = req.query;
    let query = 'SELECT * FROM suppliers';
    const params = [];
    if (search) {
        query += ' WHERE supplier_name LIKE ?';
        params.push(`%${search}%`);
    }
    try {
        const [suppliers] = await db.query(query, params);
        res.json(suppliers);
    } catch (error) { res.status(500).json({ message: 'Server error fetching suppliers.' }); }
});

adminRoutes.post('/suppliers', async (req, res) => {
    try {
        const { supplier_name, contact_email, contact_phone } = req.body;
        if (!supplier_name) return res.status(400).json({ message: 'Supplier name is required.' });
        await db.query('INSERT INTO suppliers (supplier_name, contact_email, contact_phone) VALUES (?, ?, ?)', 
            [supplier_name, contact_email || null, contact_phone || null]);
        res.status(201).json({ message: 'Supplier added successfully' });
    } catch (error) { res.status(500).json({ message: 'Server error adding supplier.' }); }
});

adminRoutes.put('/suppliers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { supplier_name, contact_email, contact_phone } = req.body;
        if (!supplier_name) return res.status(400).json({ message: 'Supplier name is required.' });
        await db.query('UPDATE suppliers SET supplier_name = ?, contact_email = ?, contact_phone = ? WHERE supplier_id = ?', 
            [supplier_name, contact_email || null, contact_phone || null, id]);
        res.json({ message: 'Supplier updated successfully' });
    } catch (error) { res.status(500).json({ message: 'Server error updating supplier.' }); }
});

adminRoutes.delete('/suppliers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [products] = await db.query('SELECT * FROM products WHERE supplier_id = ?', [id]);
        if (products.length > 0) {
            return res.status(400).json({ message: 'Cannot delete. Supplier is in use by products.'});
        }
        await db.query('DELETE FROM suppliers WHERE supplier_id = ?', [id]);
        res.json({ message: 'Supplier deleted successfully' });
    } catch (error) { res.status(500).json({ message: 'Server error deleting supplier.' }); }
});


// --- ORDERS ---
adminRoutes.get('/orders', async (req, res) => {
    const { search } = req.query;
    let query = `
        SELECT o.*, u.username as customer_name 
        FROM orders o
        JOIN users u ON o.customer_id = u.user_id
    `;
    const params = [];
    if (search) {
        query += ' WHERE u.username LIKE ? OR o.order_id LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY o.order_date DESC';
    try {
        const [orders] = await db.query(query, params);
        res.json(orders);
    } catch (error) { res.status(500).json({ message: 'Server error fetching orders.' }); }
});

// *** NEW: ADMIN GET DETAILS FOR A SINGLE ORDER (INVOICE) ***
adminRoutes.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Admin can see any order, so no customer_id check
        const [orderResult] = await db.query(
            "SELECT o.*, u.username as customer_name FROM orders o JOIN users u ON o.customer_id = u.user_id WHERE o.order_id = ?",
            [id]
        );

        if (orderResult.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const [items] = await db.query(
            "SELECT * FROM order_items WHERE order_id = ?",
            [id]
        );

        res.json({
            order: orderResult[0],
            items: items
        });

    } catch (error) {
        console.error("Admin Get Order Details Error:", error);
        res.status(500).json({ message: 'Server error fetching order details.' });
    }
});

adminRoutes.put('/orders/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            "UPDATE orders SET status = 'Cancelled' WHERE order_id = ? AND status = 'Pending Payment'",
            [id]
        );
        res.json({ message: 'Order cancelled.' });
    } catch (error) {
        console.error("Admin Cancel Order Error:", error);
        res.status(500).json({ message: 'Server error cancelling order.' });
    }
});

// --- PROFILE ---
adminRoutes.get('/profile', async (req, res) => {
    try {
        const [adminUser] = await db.query('SELECT user_id, username, email, phone FROM users WHERE user_id = ?', [req.user.userId]);
        res.json(adminUser[0]);
    } catch (error) { res.status(500).json({ message: 'Server error fetching profile.' }); }
});

adminRoutes.put('/profile', async (req, res) => {
    try {
        const { email, phone } = req.body;
        await db.query('UPDATE users SET email = ?, phone = ? WHERE user_id = ?', [email, phone, req.user.userId]);
        res.json({ message: 'Profile updated!' });
    } catch (error) { res.status(500).json({ message: 'Server error updating profile.' }); }
});

// --- PASSWORD CHANGE ---
adminRoutes.put('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [req.user.userId]);
        const user = users[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, req.user.userId]);
        res.json({ message: 'Password changed successfully.' });
    } catch (error) { res.status(500).json({ message: 'Server error changing password.' }); }
});

app.use('/api/admin', adminRoutes);

// -----------------------------------------------------------------
// API CUSTOMER ROUTES (Protected)
// -----------------------------------------------------------------
const customerRoutes = express.Router();
customerRoutes.use(authMiddleware);

customerRoutes.get('/profile/basic', async (req, res) => {
    try {
        res.json({ username: req.user.username });
    } catch (error) { res.status(500).json({ message: 'Server error fetching user.' }); }
});

customerRoutes.get('/products', async (req, res) => {
    const { search } = req.query;
    let query = 'SELECT product_id, product_name, selling_price, stock FROM products WHERE stock > 0';
    const params = [];
    if (search) {
        query += ' AND product_name LIKE ?';
        params.push(`%${search}%`);
    }
    try {
        const [products] = await db.query(query, params);
        res.json(products);
    } catch (error) { res.status(500).json({ message: 'Server error fetching products.' }); }
});

customerRoutes.get('/my-orders', async (req, res) => {
    try {
        const [orders] = await db.query('SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC', [req.user.userId]);
        res.json(orders);
    } catch (error) { res.status(500).json({ message: 'Server error fetching orders.' }); }
});

customerRoutes.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const customer_id = req.user.userId;

        const [orderResult] = await db.query(
            "SELECT * FROM orders WHERE order_id = ? AND customer_id = ?",
            [id, customer_id]
        );

        if (orderResult.length === 0) {
            return res.status(404).json({ message: 'Order not found or access denied.' });
        }

        const [items] = await db.query(
            "SELECT * FROM order_items WHERE order_id = ?",
            [id]
        );

        res.json({
            order: orderResult[0],
            items: items
        });

    } catch (error) {
        console.error("Get Order Details Error:", error);
        res.status(500).json({ message: 'Server error fetching order details.' });
    }
});

customerRoutes.put('/orders/:id/pay', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            "UPDATE orders SET status = 'Paid' WHERE order_id = ? AND customer_id = ? AND status = 'Pending Payment'",
            [id, req.user.userId]
        );
        res.json({ message: 'Payment successful!' });
    } catch (error) {
        console.error("Customer Pay Error:", error);
        res.status(500).json({ message: 'Server error processing payment.' });
    }
});

customerRoutes.put('/orders/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            "UPDATE orders SET status = 'Cancelled' WHERE order_id = ? AND customer_id = ? AND status = 'Pending Payment'",
            [id, req.user.userId]
        );
        res.json({ message: 'Order cancelled.' });
    } catch (error) {
        console.error("Customer Cancel Error:", error);
        res.status(500).json({ message: 'Server error cancelling order.' });
    }
});

customerRoutes.get('/profile', async (req, res) => {
    try {
        const [user] = await db.query('SELECT user_id, username, email, phone FROM users WHERE user_id = ?', [req.user.userId]);
        res.json(user[0]);
    } catch (error) { res.status(500).json({ message: 'Server error fetching profile.' }); }
});

customerRoutes.put('/profile', async (req, res) => {
    try {
        const { email, phone } = req.body;
        const [existing] = await db.query('SELECT * FROM users WHERE email = ? AND user_id != ?', [email, req.user.userId]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email is already in use by another account.'});
        }
        await db.query('UPDATE users SET email = ?, phone = ? WHERE user_id = ?', [email, phone, req.user.userId]);
        res.json({ message: 'Profile updated!' });
    } catch (error) { res.status(500).json({ message: 'Server error updating profile.' }); }
});

customerRoutes.put('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [req.user.userId]);
        const user = users[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, req.user.userId]);
        res.json({ message: 'Password changed successfully.' });
    } catch (error) { res.status(500).json({ message: 'Server error changing password.' }); }
});

// --- CUSTOMER CART API ---
customerRoutes.get('/cart', async (req, res) => {
    try {
        const [cartItems] = await db.query(
            `SELECT c.product_id, c.quantity, p.product_name, p.selling_price, p.stock 
             FROM cart_items c
             JOIN products p ON c.product_id = p.product_id
             WHERE c.user_id = ?`,
            [req.user.userId]
        );
        res.json(cartItems);
    } catch (error) {
        console.error("Get Cart Error:", error);
        res.status(500).json({ message: 'Server error fetching cart.' });
    }
});

customerRoutes.post('/cart', async (req, res) => {
    const { product_id, quantity } = req.body;
    try {
        await db.query(
            `INSERT INTO cart_items (user_id, product_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
            [req.user.userId, product_id, quantity, quantity]
        );
        res.status(201).json({ message: 'Item added to cart.' });
    } catch (error) {
        console.error("Add Cart Error:", error);
        res.status(500).json({ message: 'Server error adding to cart.' });
    }
});

customerRoutes.put('/cart/:product_id', async (req, res) => {
    const { product_id } = req.params;
    const { quantity } = req.body;
    if (quantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be greater than 0.' });
    }
    try {
        await db.query(
            'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
            [quantity, req.user.userId, product_id]
        );
        res.json({ message: 'Cart updated.' });
    } catch (error) {
        console.error("Update Cart Error:", error);
        res.status(500).json({ message: 'Server error updating cart.' });
    }
});

customerRoutes.delete('/cart/:product_id', async (req, res) => {
    const { product_id } = req.params;
    try {
        await db.query(
            'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
            [req.user.userId, product_id]
        );
        res.json({ message: 'Item removed from cart.' });
    } catch (error) {
        console.error("Delete Cart Error:", error);
        res.status(500).json({ message: 'Server error removing from cart.' });
    }
});


// --- CUSTOMER CHECKOUT (TRANSACTION) ---
customerRoutes.post('/create-order', async (req, res) => {
    const customer_id = req.user.userId;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [cartItems] = await connection.query(
            `SELECT c.product_id, c.quantity, p.product_name, p.selling_price, p.stock 
             FROM cart_items c
             JOIN products p ON c.product_id = p.product_id
             WHERE c.user_id = ? FOR UPDATE`,
            [customer_id]
        );

        if (!cartItems || cartItems.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Cart is empty.' });
        }

        for (const item of cartItems) {
            if (item.stock < item.quantity) {
                await connection.rollback();
                return res.status(400).json({ message: `Not enough stock for ${item.product_name}.` });
            }
        }

        const [orderResult] = await connection.query(
            'INSERT INTO orders (customer_id, status, total_amount) VALUES (?, ?, ?)',
            [customer_id, 'Pending Payment', 0.00]
        );
        const order_id = orderResult.insertId;
        let grandTotal = 0;

        for (const item of cartItems) {
            const itemTotal = item.selling_price * item.quantity;
            grandTotal += itemTotal;

            await connection.query(
                `INSERT INTO order_items (order_id, product_id, product_name_snapshot, price_snapshot, quantity) 
                 VALUES (?, ?, ?, ?, ?)`,
                [order_id, item.product_id, item.product_name, item.selling_price, item.quantity]
            );

            await connection.query(
                'UPDATE products SET stock = stock - ? WHERE product_id = ?',
                [item.quantity, item.product_id]
            );
        }

        await connection.query(
            'UPDATE orders SET total_amount = ? WHERE order_id = ?',
            [grandTotal, order_id]
        );

        await connection.query('DELETE FROM cart_items WHERE user_id = ?', [customer_id]);
        await connection.commit();
        
        res.status(201).json({ message: 'Order placed successfully! Please proceed to payment.', orderId: order_id });

    } catch (error) {
        await connection.rollback();
        console.error('Checkout error:', error);
        res.status(500).json({ message: 'Server error during checkout.' });
    } finally {
        connection.release();
    }
});

app.use('/api/customer', customerRoutes);

// --- FINAL SERVER SETUP ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Serving frontend from: ' + path.join(__dirname, '..', 'public'));
});