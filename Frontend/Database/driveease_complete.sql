
-- =====================================================
-- DRIVE EASE: COMPLETE DATABASE + SAMPLE DATA
-- Database: driveease_complete
-- Run this script ONCE in MySQL Workbench.
-- =====================================================

CREATE DATABASE IF NOT EXISTS driveease_complete;
USE driveease_complete;

-- 1. ADMINS
CREATE TABLE IF NOT EXISTS admins (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

-- 2. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(25)
);

-- 3. VEHICLE TYPES
CREATE TABLE IF NOT EXISTS vehicle_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(80) NOT NULL UNIQUE
);

-- 4. VEHICLES: each row is one physical vehicle
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_name VARCHAR(120) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status ENUM('available','maintenance','inactive')
        NOT NULL DEFAULT 'available',
    type_id INT NOT NULL,
    admin_id INT NOT NULL,
    FOREIGN KEY (type_id) REFERENCES vehicle_types(type_id),
    FOREIGN KEY (admin_id) REFERENCES admins(admin_id),
    CHECK (price >= 0),
    INDEX idx_vehicle_type_status (type_id, status)
);

-- 5. DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    license_no VARCHAR(80) NOT NULL UNIQUE,
    phone VARCHAR(25),
    experience INT NOT NULL DEFAULT 0,
    CHECK (experience >= 0)
);

-- 6. DRIVER LANGUAGES
CREATE TABLE IF NOT EXISTS driver_languages (
    driver_id INT NOT NULL,
    language VARCHAR(60) NOT NULL,
    PRIMARY KEY (driver_id, language),
    FOREIGN KEY (driver_id)
        REFERENCES drivers(driver_id) ON DELETE CASCADE
);

-- 7. DRIVER REVIEWS
CREATE TABLE IF NOT EXISTS driver_reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    comment TEXT,
    rating TINYINT NOT NULL,
    review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
    CHECK (rating BETWEEN 1 AND 5)
);

-- 8. OFFERS
CREATE TABLE IF NOT EXISTS offers (
    offer_id INT AUTO_INCREMENT PRIMARY KEY,
    offer_code VARCHAR(60) NOT NULL UNIQUE,
    offer_name VARCHAR(120) NOT NULL,
    discount_type ENUM('percentage','fixed') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    admin_id INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (admin_id) REFERENCES admins(admin_id),
    CHECK (discount_value > 0),
    CHECK (valid_to >= valid_from)
);

-- 9. BOOKING GROUPS
-- One group represents the customer's complete selection.
-- The combined discount is stored only once here.
CREATE TABLE IF NOT EXISTS booking_groups (
    group_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    offer_id INT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    pickup_location VARCHAR(255) NOT NULL,
    dropoff_location VARCHAR(255) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('pending','confirmed','cancelled','completed')
        NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (offer_id) REFERENCES offers(offer_id)
        ON DELETE SET NULL,
    CHECK (end_date > start_date),
    CHECK (subtotal >= 0),
    CHECK (discount_amount >= 0),
    CHECK (total_amount >= 0),
    INDEX idx_group_customer (customer_id),
    INDEX idx_group_dates (start_date, end_date)
);

-- 10. BOOKINGS
-- One row per selected physical vehicle.
CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id BIGINT NOT NULL,
    vehicle_id INT NOT NULL,
    driver_id INT NULL,
    vehicle_price DECIMAL(10,2) NOT NULL,
    booking_status ENUM('pending','confirmed','cancelled','completed')
        NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES booking_groups(group_id)
        ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
        ON DELETE SET NULL,
    CHECK (vehicle_price >= 0),
    INDEX idx_booking_vehicle (vehicle_id),
    INDEX idx_booking_group (group_id)
);

-- 11. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_id BIGINT NOT NULL,
    payment_method ENUM('cash','card','upi','net_banking','other')
        NOT NULL,
    payment_date DATETIME NULL,
    amount DECIMAL(12,2) NOT NULL,
    status ENUM('pending','successful','failed','refunded')
        NOT NULL DEFAULT 'pending',
    transaction_reference VARCHAR(150) NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES booking_groups(group_id)
        ON DELETE CASCADE,
    CHECK (amount >= 0),
    INDEX idx_payment_group (group_id)
);

-- =====================================================
-- INSERT SAMPLE DATA
-- =====================================================

-- 1. ADMIN  (demo login: admin@driveease.com / Admin@123)
INSERT INTO admins
(admin_id, name, email, password_hash)
VALUES
(1, 'DriveEase Admin', 'admin@driveease.com',
 '$2b$10$GD/kQagD2aPIucJ6XkzUeOs8zY3/yPZEfeckccOAa7dObpO4/aWP2');

-- 2. CUSTOMERS  (demo logins: arun@example.com, priya@example.com, rahul@example.com / Customer@123)
INSERT INTO customers
(customer_id, name, email, password_hash, address, phone)
VALUES
(1, 'Arun Kumar', 'arun@example.com',
 '$2b$10$1WRc2xTIIp4QopavluKTmOoKSsec6EjHRwQWAw4ISMgLAQjsEgflG', 'Bengaluru', '9000000001'),
(2, 'Priya Sharma', 'priya@example.com',
 '$2b$10$1WRc2xTIIp4QopavluKTmOoKSsec6EjHRwQWAw4ISMgLAQjsEgflG', 'Mysuru', '9000000002'),
(3, 'Rahul Patil', 'rahul@example.com',
 '$2b$10$1WRc2xTIIp4QopavluKTmOoKSsec6EjHRwQWAw4ISMgLAQjsEgflG', 'Tumakuru', '9000000003');

-- 3. VEHICLE TYPES: all three types
INSERT INTO vehicle_types (type_id, type_name)
VALUES
(1, 'Bike'),
(2, 'Car'),
(3, 'Minibus');

-- 4. VEHICLES
-- Four separate Royal Enfield bikes, each with its own ID.
INSERT INTO vehicles
(vehicle_id, vehicle_name, price, status, type_id, admin_id)
VALUES
(1, 'Royal Enfield Classic 350', 1500, 'available', 1, 1),
(2, 'Royal Enfield Classic 350', 1500, 'available', 1, 1),
(3, 'Royal Enfield Classic 350', 1500, 'available', 1, 1),
(4, 'Royal Enfield Classic 350', 1500, 'available', 1, 1),
(5, 'Honda Activa 6G', 800, 'available', 1, 1),
(6, 'TVS Apache RTR 160', 1000, 'available', 1, 1),
(7, 'Hyundai i20', 2500, 'available', 2, 1),
(8, 'Maruti Swift', 2200, 'available', 2, 1),
(9, 'Tata Nexon', 3000, 'maintenance', 2, 1),
(10, 'Force Traveller', 5000, 'available', 3, 1),
(11, 'Tata Winger', 4000, 'available', 3, 1);

-- 5. DRIVERS
INSERT INTO drivers
(driver_id, name, license_no, phone, experience)
VALUES
(1, 'Ravi Kumar', 'DL-DRV-1001', '9111111111', 5),
(2, 'Suresh Gowda', 'DL-DRV-1002', '9222222222', 3),
(3, 'Manoj Reddy', 'DL-DRV-1003', '9333333333', 7);

-- 6. DRIVER LANGUAGES
INSERT INTO driver_languages (driver_id, language)
VALUES
(1, 'Kannada'),
(1, 'English'),
(2, 'Kannada'),
(2, 'English'),
(3, 'Telugu'),
(3, 'English');

-- 7. DRIVER REVIEWS
INSERT INTO driver_reviews
(review_id, driver_id, comment, rating, review_date)
VALUES
(1, 1, 'Professional and punctual service',
 5, '2026-09-10 10:30:00'),
(2, 2, 'Helpful and polite driver',
 4, '2026-09-15 14:00:00'),
(3, 3, 'Good driving experience',
 5, '2026-09-20 11:00:00');

-- 8. OFFERS
-- Discount values are examples for database testing.
INSERT INTO offers
(offer_id, offer_code, offer_name, discount_type,
 discount_value, valid_from, valid_to, admin_id, is_active)
VALUES
(1, 'WELCOME10', 'Welcome Offer', 'percentage', 10,
 '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1, TRUE),
(2, 'FAMILY10', 'Family Pack', 'percentage', 10,
 '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1, TRUE),
(3, 'SAVE500', 'Flat 500 Off', 'fixed', 500,
 '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1, TRUE);

-- 9. BOOKING GROUPS
-- Group 1: four Royal Enfield bikes.
-- Subtotal = 4 x 1500 = 6000.
-- SAVE500 discount = 500; final total = 5500.
INSERT INTO booking_groups
(group_id, customer_id, offer_id, start_date, end_date,
 pickup_location, dropoff_location, subtotal,
 discount_amount, total_amount, status)
VALUES
(1, 1, 3, '2026-11-01 09:00:00', '2026-11-02 09:00:00',
 'Bengaluru', 'Bengaluru', 6000, 500, 5500, 'confirmed'),
(2, 2, 1, '2026-11-05 10:00:00', '2026-11-06 10:00:00',
 'Mysuru', 'Mysuru', 800, 80, 720, 'pending'),
(3, 3, NULL, '2026-11-10 09:00:00', '2026-11-11 09:00:00',
 'Tumakuru', 'Tumakuru', 1000, 0, 1000, 'pending');

-- 10. BOOKINGS
INSERT INTO bookings
(booking_id, group_id, vehicle_id, driver_id,
 vehicle_price, booking_status)
VALUES
(1, 1, 1, NULL, 1500, 'confirmed'),
(2, 1, 2, NULL, 1500, 'confirmed'),
(3, 1, 3, NULL, 1500, 'confirmed'),
(4, 1, 4, NULL, 1500, 'confirmed'),
(5, 2, 5, 1, 800, 'pending'),
(6, 3, 6, 2, 1000, 'pending');

-- 11. PAYMENTS
INSERT INTO payments
(payment_id, group_id, payment_method, payment_date,
 amount, status, transaction_reference)
VALUES
(1, 1, 'upi', '2026-10-10 12:00:00',
 5500, 'successful', 'DEMO-TXN-1001'),
(2, 2, 'card', NULL,
 720, 'pending', 'DEMO-TXN-1002'),
(3, 3, 'cash', NULL,
 1000, 'pending', 'DEMO-TXN-1003');

-- =====================================================
-- VERIFY THE DATABASE
-- =====================================================

SHOW TABLES;

-- Check vehicle types
SELECT * FROM vehicle_types;

-- Check vehicles and their categories
SELECT v.vehicle_id, v.vehicle_name, vt.type_name,
       v.price, v.status
FROM vehicles v
JOIN vehicle_types vt ON v.type_id = vt.type_id
ORDER BY v.vehicle_id;

-- Check all four Royal Enfield bookings
SELECT bg.group_id, c.name AS customer_name,
       b.vehicle_id, v.vehicle_name, b.vehicle_price
FROM booking_groups bg
JOIN customers c ON bg.customer_id = c.customer_id
JOIN bookings b ON bg.group_id = b.group_id
JOIN vehicles v ON b.vehicle_id = v.vehicle_id
WHERE bg.group_id = 1;

-- Check the combined offer and final amount
SELECT bg.group_id, o.offer_code,
       bg.subtotal, bg.discount_amount, bg.total_amount
FROM booking_groups bg
LEFT JOIN offers o ON bg.offer_id = o.offer_id;
