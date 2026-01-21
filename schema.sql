-- 1. Create and Use the Database
DROP DATABASE IF EXISTS inventory_pro;
CREATE DATABASE IF NOT EXISTS inventory_pro;
USE inventory_pro;

-- 2. Drop Existing Tables (Order matters to avoid FK errors)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS cart;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 3. Create Tables

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'customer') DEFAULT 'customer',
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    CONSTRAINT chk_category_name_no_spaces CHECK (TRIM(category_name) <> '')
);

-- Suppliers Table
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(150) NOT NULL,
    contact_email VARCHAR(100) UNIQUE,
    contact_phone VARCHAR(25),
    CONSTRAINT chk_supplier_name_no_spaces CHECK (TRIM(supplier_name) <> '')
);

-- Products Table
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category_id INT,
    supplier_id INT,
    stock INT NOT NULL DEFAULT 0,
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_product_name_no_spaces CHECK (TRIM(product_name) <> ''), 
    CONSTRAINT chk_stock_non_negative CHECK (stock >= 0),
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL
);

-- Orders Table
-- CHANGED: customer_id -> user_id (To match Backend Code)
-- CHANGED: FK references users(id) (To match Users table PK)
CREATE TABLE orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT, 
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Pending Payment', 'Paid', 'Cancelled', 'Out of Stock') NOT NULL DEFAULT 'Pending Payment',
    total_amount DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Order Items Table
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY, -- Renamed to simple 'id' for consistency
    order_id INT,
    product_id INT NULL, 
    price_snapshot DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

-- Cart Table
-- CHANGED: Table name 'cart_items' -> 'cart' (To match Backend Code)
-- CHANGED: FK references users(id)
CREATE TABLE cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_product (user_id, product_id),
    CONSTRAINT chk_cart_quantity_positive CHECK (quantity > 0),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- Check Data
SELECT * FROM users;
SELECT * FROM products;
SELECT * FROM categories;
SELECT * FROM suppliers;
SELECT * FROM orders;
SELECT * FROM order_items;
SELECT * FROM cart;
