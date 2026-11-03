// =============================================
// DRIVE EASE - DATABASE CONNECTION
// Database: driveease_complete
// =============================================
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2");

// Tiny .env reader (no extra package needed).
// Create Backend/.env  (see .env.example) to set your MySQL password.
try {
    const envFile = path.join(__dirname, ".env");
    if (fs.existsSync(envFile)) {
        fs.readFileSync(envFile, "utf8").split(/\r?\n/).forEach((line) => {
            const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
            if (match && process.env[match[1]] === undefined) {
                process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
            }
        });
    }
} catch (error) {
    console.warn("Could not read .env file:", error.message);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "driveease_complete",
    waitForConnections: true,
    connectionLimit: 10,
    // DATETIME values come back as plain "YYYY-MM-DD HH:MM:SS" text,
    // so there are no time-zone surprises in the browser.
    dateStrings: true
});

module.exports = pool;
