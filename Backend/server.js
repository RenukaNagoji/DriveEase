// =============================================
// DRIVE EASE - BACKEND SERVER (driveease_complete database)
// =============================================
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const pool = require("./db");
const {
    normalizeDateTime, nowText, rentalDays, money,
    ruleDescription, evaluateOffer
} = require("./helpers");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const database = pool.promise();

app.use(cors());
app.use(express.json());

// The website is served from the same server:
// http://localhost:3000  ->  Frontend/Html Files/index.html
const FRONTEND_DIR = path.join(__dirname, "..", "Frontend");
app.use(express.static(FRONTEND_DIR));
app.get("/", (req, res) => {
    res.redirect("/Html%20Files/index.html");
});

// ---------------------------------------------
// Constants (match the ENUMs in the database)
// ---------------------------------------------
const VEHICLE_STATUSES = ["available", "maintenance", "inactive"];
const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"];
const PAYMENT_METHODS = ["cash", "card", "upi", "net_banking", "other"];
const PAYMENT_STATUSES = ["pending", "successful", "failed", "refunded"];
const MAX_VEHICLES_PER_BOOKING = 10;

// A vehicle is "taken" for a period when it has a pending or
// confirmed booking that overlaps that period.
const OVERLAP_SQL = `
    SELECT 1
    FROM bookings b
    JOIN booking_groups g ON g.group_id = b.group_id
    WHERE b.booking_status IN ('pending','confirmed')
      AND g.status IN ('pending','confirmed')
      AND g.start_date < ?
      AND g.end_date > ?
`;

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function sendError(res, error, message = "Something went wrong.") {
    console.error(message, error);
    return res.status(500).json({ message });
}

function isValidId(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0;
}

function parsePeriod(startRaw, endRaw) {
    const start = normalizeDateTime(startRaw);
    const end = normalizeDateTime(endRaw, "09:00:00");
    if (!start || !end) return null;
    if (end <= start) return null;
    return { start, end, days: rentalDays(start, end) };
}

// ---------------------------------------------
// Simple login sessions (in memory)
// ---------------------------------------------
const sessions = new Map();
const SESSION_MS = 12 * 60 * 60 * 1000;

function createSession(role, id) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, { role, id, expires: Date.now() + SESSION_MS });
    return token;
}

function requireRole(role) {
    return (req, res, next) => {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        const session = sessions.get(token);

        if (!session || session.expires < Date.now() || session.role !== role) {
            if (session && session.expires < Date.now()) sessions.delete(token);
            return res.status(401).json({
                message: "Please log in again to continue."
            });
        }
        req.session = session;
        next();
    };
}

const requireCustomer = requireRole("customer");
const requireAdmin = requireRole("admin");

// ---------------------------------------------
// Health
// ---------------------------------------------
app.get("/api/health", async (req, res) => {
    try {
        await database.query("SELECT 1");
        res.json({ status: "OK", message: "DriveEase API and database are connected." });
    } catch (error) {
        sendError(res, error, "Database health check failed.");
    }
});

// =============================================
// CUSTOMER REGISTER / LOGIN
// =============================================
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, phone, password, address } = req.body;

        if (!String(name || "").trim() || !String(email || "").trim() || !password) {
            return res.status(400).json({ message: "Name, email and password are required." });
        }
        if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) {
            return res.status(400).json({ message: "Please enter a valid email address." });
        }
        if (String(password).length < 8) {
            return res.status(400).json({ message: "Password must contain at least 8 characters." });
        }

        const hash = await bcrypt.hash(String(password), 10);
        const [result] = await database.query(
            `INSERT INTO customers (name, email, password_hash, address, phone)
             VALUES (?, ?, ?, ?, ?)`,
            [
                String(name).trim(),
                String(email).trim().toLowerCase(),
                hash,
                String(address || "").trim() || null,
                String(phone || "").trim() || null
            ]
        );

        res.status(201).json({ message: "Registration successful!", customer_id: result.insertId });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "This email is already registered." });
        }
        sendError(res, error, "Customer registration failed.");
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const [rows] = await database.query(
            `SELECT customer_id, name, email, phone, address, password_hash
             FROM customers WHERE email = ? LIMIT 1`,
            [String(email).trim().toLowerCase()]
        );

        const customer = rows[0];
        const valid = customer &&
            String(customer.password_hash).startsWith("$2") &&
            await bcrypt.compare(String(password), customer.password_hash);

        if (!valid) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        delete customer.password_hash;
        customer.token = createSession("customer", customer.customer_id);
        res.json({ message: "Login successful!", user: customer });
    } catch (error) {
        sendError(res, error, "Customer login failed.");
    }
});

// =============================================
// VEHICLES, TYPES, DRIVERS  (public)
// =============================================
app.get("/api/vehicle-types", async (req, res) => {
    try {
        const [rows] = await database.query(
            "SELECT type_id, type_name FROM vehicle_types ORDER BY type_id"
        );
        res.json(rows);
    } catch (error) {
        sendError(res, error, "Unable to load vehicle types.");
    }
});

// Optional ?start=...&end=... adds "available_for_dates" for that period.
async function loadVehicles({ period = null, vehicleId = null } = {}) {
    const params = [];
    let availability = "(v.status = 'available')";

    if (period) {
        availability = `(v.status = 'available' AND NOT EXISTS (
            ${OVERLAP_SQL} AND b.vehicle_id = v.vehicle_id))`;
        params.push(period.end, period.start);
    }

    let where = "";
    if (vehicleId) {
        where = "WHERE v.vehicle_id = ?";
        params.push(vehicleId);
    }

    const [rows] = await database.query(
        `SELECT v.vehicle_id, v.vehicle_name, v.price, v.status,
                v.type_id, vt.type_name,
                ${availability} AS available_for_dates
         FROM vehicles v
         JOIN vehicle_types vt ON vt.type_id = v.type_id
         ${where}
         ORDER BY vt.type_id, v.vehicle_name, v.vehicle_id`,
        params
    );

    return rows.map((row) => ({
        ...row,
        price: Number(row.price),
        available_for_dates: Boolean(Number(row.available_for_dates))
    }));
}

app.get("/api/vehicles", async (req, res) => {
    try {
        let period = null;
        if (req.query.start && req.query.end) {
            period = parsePeriod(req.query.start, req.query.end);
            if (!period) {
                return res.status(400).json({ message: "Please provide a valid pickup and return date." });
            }
        }
        res.json(await loadVehicles({ period }));
    } catch (error) {
        sendError(res, error, "Unable to load vehicles.");
    }
});

app.get("/api/vehicles/:id", async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ message: "Invalid vehicle ID." });
        }
        const rows = await loadVehicles({ vehicleId: Number(req.params.id) });
        if (rows.length === 0) {
            return res.status(404).json({ message: "Vehicle not found." });
        }
        res.json(rows[0]);
    } catch (error) {
        sendError(res, error, "Unable to load vehicle details.");
    }
});

app.get("/api/drivers", async (req, res) => {
    try {
        const params = [];
        let busy = "0";

        if (req.query.start && req.query.end) {
            const period = parsePeriod(req.query.start, req.query.end);
            if (period) {
                busy = `EXISTS (${OVERLAP_SQL} AND b.driver_id = d.driver_id)`;
                params.push(period.end, period.start);
            }
        }

        const [rows] = await database.query(
            `SELECT d.driver_id, d.name, d.phone, d.experience,
                (SELECT GROUP_CONCAT(dl.language ORDER BY dl.language SEPARATOR ', ')
                   FROM driver_languages dl WHERE dl.driver_id = d.driver_id) AS languages,
                (SELECT ROUND(AVG(r.rating), 1)
                   FROM driver_reviews r WHERE r.driver_id = d.driver_id) AS avg_rating,
                (SELECT COUNT(*)
                   FROM driver_reviews r WHERE r.driver_id = d.driver_id) AS review_count,
                ${busy} AS busy
             FROM drivers d
             ORDER BY d.name`,
            params
        );

        res.json(rows.map((row) => ({
            ...row,
            avg_rating: row.avg_rating === null ? null : Number(row.avg_rating),
            review_count: Number(row.review_count),
            busy: Boolean(Number(row.busy))
        })));
    } catch (error) {
        sendError(res, error, "Unable to load drivers.");
    }
});

// =============================================
// OFFERS
// =============================================
async function loadActiveOffers(executor = database) {
    const [rows] = await executor.query(
        `SELECT offer_id, offer_code, offer_name, discount_type, discount_value,
                valid_from, valid_to, is_active
         FROM offers
         WHERE is_active = TRUE AND valid_from <= ? AND valid_to >= ?
         ORDER BY offer_id`,
        [nowText(), nowText()]
    );
    return rows.map((row) => ({
        ...row,
        discount_value: Number(row.discount_value),
        rule: ruleDescription(row.offer_code)
    }));
}

app.get("/api/offers", async (req, res) => {
    try {
        res.json(await loadActiveOffers());
    } catch (error) {
        sendError(res, error, "Unable to load offers.");
    }
});

// Prices a selection and says which offers fit it.
async function buildQuote(executor, { customerId, vehicleIds, period }) {
    const [vehicles] = await executor.query(
        `SELECT v.vehicle_id, v.vehicle_name, v.price, v.status, vt.type_name
         FROM vehicles v JOIN vehicle_types vt ON vt.type_id = v.type_id
         WHERE v.vehicle_id IN (?)`,
        [vehicleIds]
    );

    const subtotal = money(
        vehicles.reduce((sum, v) => sum + Number(v.price) * period.days, 0)
    );

    const [[history]] = await executor.query(
        `SELECT COUNT(*) AS total FROM booking_groups
         WHERE customer_id = ? AND status IN ('pending','confirmed','completed')`,
        [customerId]
    );

    const context = {
        subtotal,
        vehicles,
        previousBookings: Number(history.total)
    };

    const offers = (await loadActiveOffers(executor)).map((offer) => ({
        ...offer,
        ...evaluateOffer(offer, context)
    }));

    return { vehicles, subtotal, days: period.days, offers };
}

app.post("/api/offers/check", requireCustomer, async (req, res) => {
    try {
        const { vehicle_ids, start_date, end_date } = req.body;
        const period = parsePeriod(start_date, end_date);
        const ids = [...new Set((vehicle_ids || []).map(Number))].filter(isValidId);

        if (!period || ids.length === 0) {
            return res.status(400).json({ message: "Choose vehicles and valid dates first." });
        }

        const quote = await buildQuote(database, {
            customerId: req.session.id,
            vehicleIds: ids,
            period
        });

        res.json({
            days: quote.days,
            subtotal: quote.subtotal,
            offers: quote.offers.map((o) => ({
                offer_id: o.offer_id,
                offer_code: o.offer_code,
                offer_name: o.offer_name,
                discount_type: o.discount_type,
                discount_value: o.discount_value,
                rule: o.rule,
                eligible: o.eligible,
                reason: o.reason,
                discount: o.discount
            }))
        });
    } catch (error) {
        sendError(res, error, "Unable to check offers.");
    }
});

// =============================================
// CREATE BOOKING  (one booking group, one row per vehicle)
// POST /api/bookings
// =============================================
app.post("/api/bookings", requireCustomer, async (req, res) => {
    let connection;

    try {
        const {
            items, offer_id, start_date, end_date,
            pickup_location, dropoff_location, payment_method
        } = req.body;

        const customerId = req.session.id;
        const period = parsePeriod(start_date, end_date);
        const pickup = String(pickup_location || "").trim();
        const dropoff = String(dropoff_location || "").trim();

        if (!period) {
            return res.status(400).json({ message: "Return date and time must be after the pickup date and time." });
        }
        if (period.start < nowText().slice(0, 16) + ":00") {
            return res.status(400).json({ message: "Pickup time cannot be in the past." });
        }
        if (!pickup || !dropoff) {
            return res.status(400).json({ message: "Please enter pickup and drop-off locations." });
        }
        if (!PAYMENT_METHODS.includes(payment_method)) {
            return res.status(400).json({ message: "Please choose a payment method." });
        }
        if (!Array.isArray(items) || items.length === 0 ||
            items.length > MAX_VEHICLES_PER_BOOKING) {
            return res.status(400).json({
                message: `Select between 1 and ${MAX_VEHICLES_PER_BOOKING} vehicles.`
            });
        }

        const vehicleIds = items.map((item) => Number(item.vehicle_id));
        const driverIds = items
            .map((item) => item.driver_id)
            .filter((id) => id !== null && id !== undefined && id !== "")
            .map(Number);

        if (!vehicleIds.every(isValidId) || new Set(vehicleIds).size !== vehicleIds.length) {
            return res.status(400).json({ message: "Each vehicle can only be selected once." });
        }
        if (!driverIds.every(isValidId) || new Set(driverIds).size !== driverIds.length) {
            return res.status(400).json({ message: "Each driver can only be assigned to one vehicle." });
        }

        connection = await database.getConnection();
        await connection.beginTransaction();

        // Customer exists?
        const [customerRows] = await connection.query(
            "SELECT customer_id FROM customers WHERE customer_id = ?", [customerId]
        );
        if (customerRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Customer not found. Please log in again." });
        }

        // Lock the chosen vehicles, then check status and date overlaps.
        const [vehicleRows] = await connection.query(
            `SELECT vehicle_id, vehicle_name, status
             FROM vehicles WHERE vehicle_id IN (?) FOR UPDATE`,
            [vehicleIds]
        );
        if (vehicleRows.length !== vehicleIds.length) {
            await connection.rollback();
            return res.status(404).json({ message: "One of the selected vehicles was not found." });
        }
        const unavailable = vehicleRows.find((v) => v.status !== "available");
        if (unavailable) {
            await connection.rollback();
            return res.status(409).json({
                message: `${unavailable.vehicle_name} is currently not available.`
            });
        }

        const [overlaps] = await connection.query(
            `SELECT DISTINCT b.vehicle_id FROM bookings b
             JOIN booking_groups g ON g.group_id = b.group_id
             WHERE b.vehicle_id IN (?)
               AND b.booking_status IN ('pending','confirmed')
               AND g.status IN ('pending','confirmed')
               AND g.start_date < ? AND g.end_date > ?`,
            [vehicleIds, period.end, period.start]
        );
        if (overlaps.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: "One or more selected vehicles are already booked for those dates. Please pick different dates or vehicles."
            });
        }

        // Drivers: must exist and be free.
        if (driverIds.length > 0) {
            const [driverRows] = await connection.query(
                "SELECT driver_id FROM drivers WHERE driver_id IN (?) FOR UPDATE",
                [driverIds]
            );
            if (driverRows.length !== driverIds.length) {
                await connection.rollback();
                return res.status(400).json({ message: "A selected driver does not exist." });
            }
            const [busyDrivers] = await connection.query(
                `SELECT DISTINCT b.driver_id FROM bookings b
                 JOIN booking_groups g ON g.group_id = b.group_id
                 WHERE b.driver_id IN (?)
                   AND b.booking_status IN ('pending','confirmed')
                   AND g.status IN ('pending','confirmed')
                   AND g.start_date < ? AND g.end_date > ?`,
                [driverIds, period.end, period.start]
            );
            if (busyDrivers.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    message: "A selected driver is already booked for those dates."
                });
            }
        }

        // Price + offer (always decided by the server).
        const quote = await buildQuote(connection, {
            customerId, vehicleIds, period
        });

        let offerId = null;
        let discount = 0;

        if (offer_id !== undefined && offer_id !== null && offer_id !== "") {
            const chosen = quote.offers.find(
                (offer) => Number(offer.offer_id) === Number(offer_id)
            );
            if (!chosen) {
                await connection.rollback();
                return res.status(400).json({ message: "That offer is not available." });
            }
            if (!chosen.eligible) {
                await connection.rollback();
                return res.status(400).json({ message: chosen.reason });
            }
            offerId = chosen.offer_id;
            discount = chosen.discount;
        }

        const subtotal = quote.subtotal;
        const total = money(subtotal - discount);

        const [groupResult] = await connection.query(
            `INSERT INTO booking_groups
             (customer_id, offer_id, start_date, end_date, pickup_location,
              dropoff_location, subtotal, discount_amount, total_amount, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [customerId, offerId, period.start, period.end, pickup, dropoff,
             subtotal, discount, total]
        );
        const groupId = groupResult.insertId;

        for (const item of items) {
            const vehicle = quote.vehicles.find(
                (v) => Number(v.vehicle_id) === Number(item.vehicle_id)
            );
            await connection.query(
                `INSERT INTO bookings
                 (group_id, vehicle_id, driver_id, vehicle_price, booking_status)
                 VALUES (?, ?, ?, ?, 'pending')`,
                [
                    groupId,
                    vehicle.vehicle_id,
                    item.driver_id ? Number(item.driver_id) : null,
                    money(Number(vehicle.price) * period.days)
                ]
            );
        }

        const reference = `DE-${groupId}-${Date.now().toString(36).toUpperCase()}`;
        await connection.query(
            `INSERT INTO payments
             (group_id, payment_method, amount, status, transaction_reference)
             VALUES (?, ?, ?, 'pending', ?)`,
            [groupId, payment_method, total, reference]
        );

        await connection.commit();

        res.status(201).json({
            message: "Booking placed successfully!",
            group_id: groupId,
            days: period.days,
            subtotal,
            discount,
            total_amount: total,
            transaction_reference: reference
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (e) { console.error("Rollback failed:", e); }
        }
        sendError(res, error, "Booking creation failed.");
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// CUSTOMER BOOKINGS
// =============================================
async function loadGroups(whereSql, params) {
    const [groups] = await database.query(
        `SELECT g.group_id, g.customer_id, g.offer_id, g.start_date, g.end_date,
                g.pickup_location, g.dropoff_location, g.subtotal,
                g.discount_amount, g.total_amount, g.status, g.created_at,
                o.offer_code, o.offer_name,
                c.name AS customer_name, c.email AS customer_email
         FROM booking_groups g
         JOIN customers c ON c.customer_id = g.customer_id
         LEFT JOIN offers o ON o.offer_id = g.offer_id
         ${whereSql}
         ORDER BY g.group_id DESC`,
        params
    );
    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.group_id);

    const [items] = await database.query(
        `SELECT b.booking_id, b.group_id, b.vehicle_id, b.driver_id,
                b.vehicle_price, b.booking_status,
                v.vehicle_name, vt.type_name, d.name AS driver_name
         FROM bookings b
         JOIN vehicles v ON v.vehicle_id = b.vehicle_id
         JOIN vehicle_types vt ON vt.type_id = v.type_id
         LEFT JOIN drivers d ON d.driver_id = b.driver_id
         WHERE b.group_id IN (?)
         ORDER BY b.booking_id`,
        [groupIds]
    );

    const [payments] = await database.query(
        `SELECT payment_id, group_id, payment_method, payment_date, amount,
                status, transaction_reference
         FROM payments WHERE group_id IN (?) ORDER BY payment_id DESC`,
        [groupIds]
    );

    return groups.map((group) => ({
        ...group,
        subtotal: Number(group.subtotal),
        discount_amount: Number(group.discount_amount),
        total_amount: Number(group.total_amount),
        items: items
            .filter((item) => item.group_id === group.group_id)
            .map((item) => ({ ...item, vehicle_price: Number(item.vehicle_price) })),
        payment: payments
            .filter((p) => p.group_id === group.group_id)
            .map((p) => ({ ...p, amount: Number(p.amount) }))[0] || null
    }));
}

app.get("/api/bookings/mine", requireCustomer, async (req, res) => {
    try {
        res.json(await loadGroups("WHERE g.customer_id = ?", [req.session.id]));
    } catch (error) {
        sendError(res, error, "Unable to load your bookings.");
    }
});

app.post("/api/bookings/:id/cancel", requireCustomer, async (req, res) => {
    let connection;
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ message: "Invalid booking." });
        }

        connection = await database.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `SELECT group_id, status, start_date FROM booking_groups
             WHERE group_id = ? AND customer_id = ? FOR UPDATE`,
            [Number(req.params.id), req.session.id]
        );
        const group = rows[0];

        if (!group) {
            await connection.rollback();
            return res.status(404).json({ message: "Booking not found." });
        }
        if (!["pending", "confirmed"].includes(group.status)) {
            await connection.rollback();
            return res.status(409).json({ message: "This booking can no longer be cancelled." });
        }
        if (group.start_date <= nowText()) {
            await connection.rollback();
            return res.status(409).json({ message: "A rental that has already started cannot be cancelled." });
        }

        await cancelGroup(connection, group.group_id);
        await connection.commit();
        res.json({ message: "Booking cancelled." });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (e) { console.error(e); }
        }
        sendError(res, error, "Unable to cancel the booking.");
    } finally {
        if (connection) connection.release();
    }
});

async function cancelGroup(connection, groupId) {
    await connection.query(
        "UPDATE booking_groups SET status = 'cancelled' WHERE group_id = ?", [groupId]
    );
    await connection.query(
        "UPDATE bookings SET booking_status = 'cancelled' WHERE group_id = ?", [groupId]
    );
    await connection.query(
        `UPDATE payments SET status = CASE WHEN status = 'successful' THEN 'refunded' ELSE 'failed' END
         WHERE group_id = ? AND status IN ('pending','successful')`,
        [groupId]
    );
}

// =============================================
// ADMIN
// =============================================
app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const [rows] = await database.query(
            `SELECT admin_id, name, email, password_hash
             FROM admins WHERE email = ? LIMIT 1`,
            [String(email).trim().toLowerCase()]
        );

        const admin = rows[0];
        const valid = admin &&
            String(admin.password_hash).startsWith("$2") &&
            await bcrypt.compare(String(password), admin.password_hash);

        if (!valid) {
            return res.status(401).json({ message: "Invalid admin email or password." });
        }

        delete admin.password_hash;
        admin.token = createSession("admin", admin.admin_id);
        res.json({ message: "Admin login successful!", admin });
    } catch (error) {
        sendError(res, error, "Admin login failed.");
    }
});

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
        const now = nowText();
        const [[vehicles]] = await database.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(status = 'available'), 0) AS available
             FROM vehicles`
        );
        const [[rented]] = await database.query(
            `SELECT COUNT(DISTINCT b.vehicle_id) AS total
             FROM bookings b JOIN booking_groups g ON g.group_id = b.group_id
             WHERE b.booking_status = 'confirmed' AND g.status = 'confirmed'
               AND g.start_date <= ? AND g.end_date > ?`,
            [now, now]
        );
        const [[customers]] = await database.query("SELECT COUNT(*) AS total FROM customers");
        const [[bookings]] = await database.query("SELECT COUNT(*) AS total FROM booking_groups");
        const [[revenue]] = await database.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM payments WHERE status = 'successful'`
        );

        res.json({
            totalVehicles: Number(vehicles.total),
            availableVehicles: Number(vehicles.available),
            rentedVehicles: Number(rented.total),
            totalCustomers: Number(customers.total),
            totalBookings: Number(bookings.total),
            totalRevenue: Number(revenue.total)
        });
    } catch (error) {
        sendError(res, error, "Failed to load dashboard statistics.");
    }
});

app.get("/api/admin/customers", requireAdmin, async (req, res) => {
    try {
        const [rows] = await database.query(
            `SELECT customer_id, name, email, phone, address
             FROM customers ORDER BY customer_id DESC`
        );
        res.json(rows);
    } catch (error) {
        sendError(res, error, "Unable to load customers.");
    }
});

app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
    try {
        res.json(await loadGroups("", []));
    } catch (error) {
        sendError(res, error, "Unable to load bookings.");
    }
});

app.put("/api/admin/bookings/:id/status", requireAdmin, async (req, res) => {
    let connection;
    try {
        const { status } = req.body;
        if (!isValidId(req.params.id) || !BOOKING_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Invalid booking or status." });
        }

        connection = await database.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            "SELECT group_id, status FROM booking_groups WHERE group_id = ? FOR UPDATE",
            [Number(req.params.id)]
        );
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Booking not found." });
        }

        if (status === "cancelled") {
            await cancelGroup(connection, rows[0].group_id);
        } else {
            await connection.query(
                "UPDATE booking_groups SET status = ? WHERE group_id = ?",
                [status, rows[0].group_id]
            );
            await connection.query(
                "UPDATE bookings SET booking_status = ? WHERE group_id = ?",
                [status, rows[0].group_id]
            );
        }

        await connection.commit();
        res.json({ message: `Booking marked as ${status}.` });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (e) { console.error(e); }
        }
        sendError(res, error, "Unable to update the booking.");
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
        const [rows] = await database.query(
            `SELECT p.payment_id, p.group_id, p.payment_method, p.payment_date,
                    p.amount, p.status, p.transaction_reference,
                    c.name AS customer_name
             FROM payments p
             JOIN booking_groups g ON g.group_id = p.group_id
             JOIN customers c ON c.customer_id = g.customer_id
             ORDER BY p.payment_id DESC`
        );
        res.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
    } catch (error) {
        sendError(res, error, "Unable to load payments.");
    }
});

app.put("/api/admin/payments/:id/status", requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!isValidId(req.params.id) || !PAYMENT_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Invalid payment or status." });
        }

        const [result] = await database.query(
            `UPDATE payments
             SET status = ?,
                 payment_date = CASE
                     WHEN ? = 'successful' THEN COALESCE(payment_date, ?)
                     ELSE payment_date END
             WHERE payment_id = ?`,
            [status, status, nowText(), Number(req.params.id)]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Payment not found." });
        }
        res.json({ message: `Payment marked as ${status}.` });
    } catch (error) {
        sendError(res, error, "Unable to update the payment.");
    }
});

// ---------- Vehicles (admin) ----------
function validateVehicleBody(body) {
    const name = String(body.vehicle_name || "").trim();
    const price = Number(body.price);
    if (!name || name.length > 120) return "Enter a vehicle name (up to 120 characters).";
    if (!Number.isFinite(price) || price < 0) return "Enter a valid rental price per day.";
    if (!isValidId(body.type_id)) return "Select a vehicle type.";
    if (!VEHICLE_STATUSES.includes(body.status)) return "Select a valid status.";
    return null;
}

app.post("/api/admin/vehicles", requireAdmin, async (req, res) => {
    try {
        const problem = validateVehicleBody(req.body);
        if (problem) return res.status(400).json({ message: problem });

        const quantity = Math.min(Math.max(parseInt(req.body.quantity, 10) || 1, 1), 20);
        const ids = [];

        for (let i = 0; i < quantity; i += 1) {
            const [result] = await database.query(
                `INSERT INTO vehicles (vehicle_name, price, status, type_id, admin_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [String(req.body.vehicle_name).trim(), Number(req.body.price),
                 req.body.status, Number(req.body.type_id), req.session.id]
            );
            ids.push(result.insertId);
        }

        res.status(201).json({
            message: quantity === 1
                ? "Vehicle added successfully!"
                : `${quantity} vehicles added successfully!`,
            vehicle_ids: ids
        });
    } catch (error) {
        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({ message: "Selected vehicle type does not exist." });
        }
        sendError(res, error, "Unable to add vehicle.");
    }
});

app.put("/api/admin/vehicles/:id", requireAdmin, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ message: "Invalid vehicle ID." });
        }
        const problem = validateVehicleBody(req.body);
        if (problem) return res.status(400).json({ message: problem });

        const [result] = await database.query(
            `UPDATE vehicles
             SET vehicle_name = ?, price = ?, status = ?, type_id = ?
             WHERE vehicle_id = ?`,
            [String(req.body.vehicle_name).trim(), Number(req.body.price),
             req.body.status, Number(req.body.type_id), Number(req.params.id)]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Vehicle not found." });
        }
        res.json({ message: "Vehicle updated successfully!" });
    } catch (error) {
        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({ message: "Selected vehicle type does not exist." });
        }
        sendError(res, error, "Unable to update vehicle.");
    }
});

app.delete("/api/admin/vehicles/:id", requireAdmin, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ message: "Invalid vehicle ID." });
        }
        const [result] = await database.query(
            "DELETE FROM vehicles WHERE vehicle_id = ?", [Number(req.params.id)]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Vehicle not found." });
        }
        res.json({ message: "Vehicle deleted successfully!" });
    } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                message: "This vehicle has booking records and cannot be deleted. Set its status to Inactive instead."
            });
        }
        sendError(res, error, "Unable to delete vehicle.");
    }
});

// ---------- Offers (admin) ----------
app.get("/api/admin/offers", requireAdmin, async (req, res) => {
    try {
        const [rows] = await database.query(
            `SELECT offer_id, offer_code, offer_name, discount_type, discount_value,
                    valid_from, valid_to, is_active
             FROM offers ORDER BY offer_id`
        );
        res.json(rows.map((row) => ({
            ...row,
            discount_value: Number(row.discount_value),
            is_active: Boolean(row.is_active),
            rule: ruleDescription(row.offer_code)
        })));
    } catch (error) {
        sendError(res, error, "Unable to load offers.");
    }
});

app.post("/api/admin/offers", requireAdmin, async (req, res) => {
    try {
        const { offer_code, offer_name, discount_type, discount_value, valid_from, valid_to } = req.body;
        const from = normalizeDateTime(valid_from, "00:00:00");
        const to = normalizeDateTime(valid_to, "23:59:59");
        const value = Number(discount_value);

        if (!String(offer_code || "").trim() || !String(offer_name || "").trim()) {
            return res.status(400).json({ message: "Offer code and offer name are required." });
        }
        if (!["percentage", "fixed"].includes(discount_type) ||
            !Number.isFinite(value) || value <= 0 ||
            (discount_type === "percentage" && value > 100)) {
            return res.status(400).json({ message: "Enter a valid discount." });
        }
        if (!from || !to || to < from) {
            return res.status(400).json({ message: "Enter a valid offer date range." });
        }

        const [result] = await database.query(
            `INSERT INTO offers
             (offer_code, offer_name, discount_type, discount_value,
              valid_from, valid_to, admin_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [String(offer_code).trim().toUpperCase(), String(offer_name).trim(),
             discount_type, value, from, to, req.session.id]
        );
        res.status(201).json({ message: "Offer created successfully!", offer_id: result.insertId });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "That offer code already exists." });
        }
        sendError(res, error, "Unable to create offer.");
    }
});

app.put("/api/admin/offers/:id/active", requireAdmin, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ message: "Invalid offer." });
        }
        const [result] = await database.query(
            "UPDATE offers SET is_active = ? WHERE offer_id = ?",
            [req.body.is_active ? 1 : 0, Number(req.params.id)]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Offer not found." });
        }
        res.json({ message: req.body.is_active ? "Offer activated." : "Offer deactivated." });
    } catch (error) {
        sendError(res, error, "Unable to update the offer.");
    }
});

// ---------------------------------------------
// Unknown API routes
// ---------------------------------------------
app.use("/api", (req, res) => {
    res.status(404).json({ message: "API route not found." });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`DriveEase server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
