# DriveEase - Vehicle Rental Management System
DriveEase is a vehicle rental management system developed using HTML, CSS, JavaScript, Nose.js, Express.js, and MySQL. It allows customers to browse available vehicles, book vehicles, choose drivers, and apply eligible offers. It also provides an admin dashboard to manage vehicles, drivers, bookings, and offers.



## 1. Technology

| Part | Technology |
|------|------------|
| Frontend | HTML, CSS (one `style.css`), vanilla JavaScript |
| Backend | Node.js, Express |
| Database | MySQL (database name: `driveease_complete`) |
| Packages | express, cors, mysql2, bcryptjs |

---

## 2. Folder structure

```
DriveEase/
├── Backend/
│   ├── server.js                  API routes
│   ├── helpers.js                 date, pricing and offer-eligibility rules
│   ├── db.js                      MySQL connection (reads .env)
│   ├── reset-demo-passwords.js    sets working passwords for the sample accounts
│   ├── .env.example               copy to .env and add your MySQL password
│   ├── package.json
│   └── node_modules/
├── Database/
│   └── driveease_complete.sql     tables + sample data
└── Frontend/
    ├── Html Files/                12 pages
    ├── Css Files/style.css        styling for every page
    ├── Javascript Files/          main.js (navbar, footer, helpers) + one script per page
    └── Images/                    logo, hero image, vehicle photos and illustrations
```

---

## 3. What you need first

1. **Node.js** (LTS version) – download from nodejs.org. Check with `node -v` in a terminal.
2. **MySQL Server** and **MySQL Workbench** (or the `mysql` command line), with a user that can create databases (usually `root`).

---

## 4. Setup from scratch

### Step 1 – Unzip
Unzip the project to any folder, for example `C:\Projects\DriveEase`.

### Step 2 – Create the database
1. Open MySQL Workbench and connect to your server.
2. Open `Database/driveease_complete.sql` (File → Open SQL Script).
3. Run the whole script (lightning-bolt button).

This creates the database `driveease_complete`, all tables and the sample data (vehicles, drivers, offers, customers, bookings, payments).

### Step 3 – Add your MySQL details
1. In the `Backend` folder, copy `.env.example` and rename the copy to `.env`.
2. Open `.env` and fill in your details:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=driveease_complete
PORT=3000
```

If your MySQL has no password, leave `DB_PASSWORD=` empty.

### Step 4 – Install packages (only if `node_modules` is missing)
Open a terminal in the `Backend` folder and run:

```
npm install
```

### Step 5 – Start the server
In the same terminal run:

```
npm start
```

You should see: `DriveEase server running at http://localhost:3000`

### Step 6 – Open the website
Go to **http://localhost:3000** in your browser. The backend serves the website as well, so nothing else is needed. Keep the terminal open while you use the site.

To confirm the database connection, open **http://localhost:3000/api/health** – it should say `OK`.

---

## 5. Login details (sample data)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@driveease.com | Admin@123 |
| Customer | arun@example.com | Customer@123 |
| Customer | priya@example.com | Customer@123 |
| Customer | rahul@example.com | Customer@123 |

- Admin login page: `http://localhost:3000/Html%20Files/admin_login.html` (also linked as **Admin** in the footer of every page).
- Customers can also create their own account on the Register page.

### If you imported an older copy of the SQL
Older copies had a placeholder instead of real passwords, so the sample accounts cannot log in. Fix it once, inside the `Backend` folder:

```
npm run reset-demo-passwords
```

### Changing the admin password
Run this once inside the `Backend` folder, replacing `NewPass@123` at the end with the new password (MySQL must be running and `.env` set):

```
node -e "const b=require('bcryptjs');const db=require('./db').promise();b.hash(process.argv[1],10).then(h=>db.query('UPDATE admins SET password_hash=? WHERE email=?',[h,'admin@driveease.com'])).then(()=>{console.log('Password changed');process.exit()})" NewPass@123
```

Use at least 8 characters and avoid `&`, `^` and `%` in the password (the terminal treats them specially).

---

## 6. Pages

**Customer pages**

| Page | Purpose |
|------|---------|
| `index.html` | Home – hero image, benefits, vehicle categories, popular vehicles, current offers |
| `vehicles.html` | All vehicles with search, category, date and availability filters |
| `vehicle_details.html` | Details, price and availability of one vehicle |
| `booking.html` | Book one or more vehicles (login required) |
| `my_rentals.html` | Booking history, status, payment, cancellation |
| `login.html` / `register.html` | Customer account |

**Admin pages** (admin login required)

| Page | Purpose |
|------|---------|
| `admin_login.html` | Admin sign-in |
| `admin.html` | Dashboard: statistics, bookings, payments, customers, offers |
| `manage_vehicles.html` | List, search, edit and delete vehicles |
| `add_vehicle.html` | Add vehicles (quantity field adds identical vehicles at once) |
| `edit_vehicle.html` | Edit a vehicle's name, type, price and status |

The same navbar and footer appear on every page. The navbar shows **Login** when signed out, and the user's name with **Logout** when signed in.

---

## 7. How booking works

1. **Trip details** – choose pick-up and return date/time and the pick-up and drop-off locations.
2. **Vehicles** – only vehicles free for those dates are listed. Use + / − to pick several vehicles (for example 2 bikes and 1 car) in one booking, up to 10.
3. **Drivers (optional)** – add a driver per vehicle. Drivers are shown with experience, rating and languages. A driver already booked for those dates cannot be chosen, and one driver can only be assigned to one vehicle.
4. **Offers** – eligible offers can be selected; ineligible ones are greyed out with the reason. One offer per booking.
5. **Payment method** – Cash, Card, UPI, Net Banking or Other.
6. **Confirm** – the server re-checks availability, drivers, offer eligibility and the final price before saving.

**Pricing**
- Rental days = every started 24 hours counts as one day (minimum 1 day).
- Subtotal = sum of (vehicle price per day × days).
- Total = subtotal − offer discount.

**Availability**
- A vehicle is blocked for a period when it has a pending or confirmed booking that overlaps it.
- Vehicles with status `maintenance` or `inactive` cannot be booked.
- Back-to-back bookings are allowed (a return time equal to the next pick-up time is fine).

**Booking and payment status**
- New bookings start as **pending** with a **pending** payment.
- The admin confirms the booking and marks the payment as successful on the dashboard.
- Customers can cancel a pending or confirmed booking before its pick-up time. A successful payment becomes *refunded*; a pending one becomes *failed*.
- The Payments Received figure on the dashboard counts only successful payments.

---

## 8. The three offers

Each offer applies **only to bookings that qualify**. This is checked on the page and again on the server when the booking is placed.

| Code | Name | Discount | Applies only when |
|------|------|----------|-------------------|
| `WELCOME10` | Welcome Offer | 10% | it is the customer's **first booking** |
| `FAMILY10` | Family Pack | 10% | the booking includes a **Car or a Minibus** |
| `SAVE500` | Flat 500 Off | ₹500 | the booking subtotal is **₹5,000 or more** |

- Cancelled bookings do not count as a previous booking for WELCOME10.
- Offers must be active and inside their valid dates.
- The rules are in `Backend/helpers.js` under `OFFER_RULES` and can be changed there.
- Offers the admin adds later (dashboard → Offers → Add Offer) have no extra rule; they only need to be active and within their dates. They can be switched on and off from the same table.

---

## 9. Database tables

| Table | Contents |
|-------|----------|
| `admins` | Admin accounts |
| `customers` | Customer accounts (passwords stored as bcrypt hashes) |
| `vehicle_types` | Bike, Car, Minibus |
| `vehicles` | One row per physical vehicle: name, price per day, status, type |
| `drivers` | Drivers with phone and experience |
| `driver_languages` | Languages each driver speaks |
| `driver_reviews` | Ratings used for the average rating |
| `offers` | Offer code, name, discount type/value, validity, active flag |
| `booking_groups` | One row per booking: customer, dates, locations, subtotal, discount, total, status, offer |
| `bookings` | One row per vehicle inside a booking group, with optional driver and line price |
| `payments` | Payment method, amount, status and transaction reference for a booking group |

Vehicle status values: `available`, `maintenance`, `inactive`.
Booking status values: `pending`, `confirmed`, `cancelled`, `completed`.
Payment status values: `pending`, `successful`, `failed`, `refunded`.

---

## 10. API reference

All routes start with `/api`. Customer routes need a login token; admin routes need an admin token (sent automatically by the website).

**Public**

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Checks the API and database connection |
| POST | `/register` | Create a customer account |
| POST | `/login` | Customer login |
| GET | `/vehicle-types` | Bike, Car, Minibus |
| GET | `/vehicles?start=&end=` | All vehicles, with availability for the dates if given |
| GET | `/vehicles/:id` | One vehicle |
| GET | `/drivers?start=&end=` | Drivers with languages, rating and busy flag |
| GET | `/offers` | Currently active offers |

**Customer (login required)**

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/offers/check` | Price a selection and show which offers apply |
| POST | `/bookings` | Create a booking |
| GET | `/bookings/mine` | The customer's own bookings |
| POST | `/bookings/:id/cancel` | Cancel own booking |

**Admin (admin login required)**

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/admin/login` | Admin login |
| GET | `/admin/stats` | Dashboard figures |
| GET | `/admin/customers` | All customers |
| GET | `/admin/bookings` | All bookings |
| PUT | `/admin/bookings/:id/status` | Change booking status |
| GET | `/admin/payments` | All payments |
| PUT | `/admin/payments/:id/status` | Change payment status |
| POST | `/admin/vehicles` | Add vehicle(s) |
| PUT | `/admin/vehicles/:id` | Edit vehicle |
| DELETE | `/admin/vehicles/:id` | Delete vehicle (blocked if it has bookings; set it to Inactive instead) |
| GET / POST | `/admin/offers` | List / add offers |
| PUT | `/admin/offers/:id/active` | Activate or deactivate an offer |

---

## 11. Adding vehicle photos

Vehicles without a photo show a clean illustration of their type (bike, car or minibus). To use a real photo:

1. Save the image in `Frontend/Images/Vehicles/` (about 800 × 520 px keeps pages fast).
2. Add one line to the `VEHICLE_PHOTOS` list in `Frontend/Javascript Files/main.js`:

```js
["swift", "maruti-swift.jpg"],
```

The first word(s) must appear in the vehicle's name (lowercase). Photos for Royal Enfield, Honda City, Hyundai Creta and BMW are already included.

---

## 12. Troubleshooting

| Problem | Fix |
|---------|-----|
| "Cannot reach the DriveEase server" on the site | The backend is not running. Run `npm start` in `Backend` and keep that terminal open. |
| `/api/health` does not say OK, or `Access denied` in the terminal | Wrong MySQL password or user in `.env`. |
| `Unknown database 'driveease_complete'` | Step 2 was skipped. Run `Database/driveease_complete.sql`. |
| `npm` is not recognised | Node.js is not installed, or the terminal was opened before installing it. Install Node.js and open a new terminal. |
| `Port 3000 is already in use` | Close the other program using it, or set `PORT=3001` in `.env` and also change `3000` to `3001` in the `API_URL` line at the top of `Frontend/Javascript Files/main.js`. |
| Sample accounts say "Invalid email or password" | Run `npm run reset-demo-passwords` in `Backend`. |
| Icons do not appear | They load from the internet (Font Awesome) and the page fonts from Google Fonts; connect to the internet. |
| "Please log in again" message | The login session lasts 12 hours and is cleared when the server restarts. Log in again. |
| Changes to the Backend do not show | Stop the server (Ctrl + C) and run `npm start` again. |

---

## 13. Notes

- Login sessions are kept in the server's memory, so restarting the server logs everyone out.
- Passwords are stored as bcrypt hashes, never as plain text.
- To open the site from another device on the same network, use `http://<your-PC-IP>:3000`.

