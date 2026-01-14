-- 1. Create and Use the Database
CREATE DATABASE IF NOT EXISTS inventory_pro;
USE inventory_pro;

-- 2. Drop Existing Tables (in reverse order of creation)
-- This allows the script to be re-run by dropping old tables first.
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;


-- 3. Create New Tables with "Dummy-Proof" Constraints

-- Users Table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
    phone VARCHAR(25),
    reset_token VARCHAR(255) NULL,
    reset_token_expires DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_username_no_spaces CHECK (TRIM(username) <> ''),
    CONSTRAINT chk_user_phone CHECK (phone IS NULL OR phone REGEXP '^[0-9()+\\- ]+$')
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
    CONSTRAINT chk_supplier_name_no_spaces CHECK (TRIM(supplier_name) <> ''),
    CONSTRAINT chk_supplier_phone CHECK (contact_phone IS NULL OR contact_phone REGEXP '^[0-9()+\\- ]+$')
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
    CONSTRAINT chk_stock_max CHECK (stock <= 1000000),
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

-- Orders Table
CREATE TABLE orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- *** UPDATED ENUM AS REQUESTED ***
    status ENUM('Pending Payment', 'Paid', 'Cancelled', 'Out of Stock') NOT NULL DEFAULT 'Pending Payment',
    
    total_amount DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES users(user_id)
);

-- Order Items Table (The "Snapshot" Table)
CREATE TABLE order_items (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT NULL, 
    product_name_snapshot VARCHAR(255) NOT NULL, 
    price_snapshot DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_quantity_max CHECK (quantity <= 10000),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

-- Cart Items Table
CREATE TABLE cart_items (
    cart_item_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_product (user_id, product_id),
    CONSTRAINT chk_cart_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_cart_quantity_max CHECK (quantity <= 10000),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

USE inventory_pro;
SELECT * FROM products;
SELECT * FROM categories;
SELECT * FROM suppliers;
SELECT * FROM users;
SELECT * FROM orders;
SELECT * FROM order_items;
SELECT * FROM cart_items;