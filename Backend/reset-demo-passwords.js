// Run ONCE if you already imported the original SQL file whose password
// columns contain "replace_with_hashed_password":
//     npm run reset-demo-passwords
// Admin    : admin@driveease.com  / Admin@123
// Customers: arun@example.com, priya@example.com, rahul@example.com / Customer@123
const bcrypt = require("bcryptjs");
const db = require("./db").promise();

(async () => {
    try {
        const admin = await bcrypt.hash("Admin@123", 10);
        const customer = await bcrypt.hash("Customer@123", 10);
        const [a] = await db.query(
            "UPDATE admins SET password_hash = ? WHERE email = 'admin@driveease.com'", [admin]);
        const [c] = await db.query(
            `UPDATE customers SET password_hash = ?
             WHERE email IN ('arun@example.com','priya@example.com','rahul@example.com')`, [customer]);
        console.log(`Updated ${a.affectedRows} admin and ${c.affectedRows} customer password(s).`);
    } catch (error) {
        console.error("Failed:", error.message);
    } finally {
        process.exit(0);
    }
})();
