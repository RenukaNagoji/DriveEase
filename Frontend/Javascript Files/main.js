// =============================================
// DRIVE EASE - SHARED SCRIPT (loaded on every page)
//  - one navbar + footer for all pages
//  - API helper, login helpers, formatting helpers
// =============================================
const API_URL = `http://${window.location.hostname || "localhost"}:3000/api`;

// ---------- Login state ----------
function readStored(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value && typeof value === "object" ? value : null;
    } catch {
        return null;
    }
}
const getUser = () => {
    const user = readStored("user");
    return user && user.customer_id && user.token ? user : null;
};
const getAdmin = () => {
    const admin = readStored("admin");
    return admin && admin.admin_id && admin.token ? admin : null;
};
function logoutAll() {
    localStorage.removeItem("user");
    localStorage.removeItem("admin");
}

// ---------- API helper ----------
// role: "customer" | "admin" | undefined (public)
async function api(path, { method = "GET", body, role } = {}) {
    const headers = { "Content-Type": "application/json" };
    const session = role === "admin" ? getAdmin() : role === "customer" ? getUser() : null;
    if (session) headers.Authorization = `Bearer ${session.token}`;

    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    } catch {
        throw new Error("Cannot reach the DriveEase server. Please start the backend (npm start) and MySQL.");
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && role) {
        localStorage.removeItem(role === "admin" ? "admin" : "user");
        const error = new Error(data.message || "Please log in again.");
        error.status = 401;
        throw error;
    }
    if (!response.ok) {
        const error = new Error(data.message || "Request failed.");
        error.status = response.status;
        throw error;
    }
    return data;
}

// ---------- Formatting ----------
const formatPrice = (amount) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2
    }).format(Number(amount) || 0);

function parseDbDate(value) {
    if (!value) return null;
    const date = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? null : date;
}
function formatDateTime(value) {
    const date = parseDbDate(value);
    if (!date) return "—";
    return date.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true
    });
}
function formatDate(value) {
    const date = parseDbDate(value);
    if (!date) return "—";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}
function titleCase(value) {
    const text = String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return text.replace(/\bUpi\b/, "UPI");
}
// "2026-11-01T09:00" for <input type="datetime-local">
function toInputDateTime(date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

// ---------- Vehicle pictures ----------
// Real photos are used when the model has one; otherwise a clean
// illustration for its type. To add a photo, save it in Images/Vehicles
// and add a line below.
const VEHICLE_PHOTOS = [
    ["royal enfield", "royal-enfield.jpg"],
    ["honda city", "honda-city.jpg"],
    ["creta", "hyundai-creta.jpg"],
    ["bmw", "bmw-5-series.jpg"]
];
function typeKey(typeName) {
    const t = String(typeName || "").toLowerCase();
    if (t.includes("bike") || t.includes("scooter")) return "bike";
    if (t.includes("bus") || t.includes("traveller")) return "minibus";
    return "car";
}
function vehicleImage(name, typeName) {
    const n = String(name || "").toLowerCase();
    const photo = VEHICLE_PHOTOS.find(([key]) => n.includes(key));
    if (photo) return `../Images/Vehicles/${photo[1]}`;
    return `../Images/Vehicles/type-${typeKey(typeName)}.svg`;
}
function typeIcon(typeName) {
    return { bike: "fa-motorcycle", minibus: "fa-van-shuttle", car: "fa-car-side" }[typeKey(typeName)];
}
function seatText(typeName) {
    return { bike: "2 Seats", minibus: "12+ Seats", car: "4–5 Seats" }[typeKey(typeName)];
}


// ---------- Vehicle models (identical physical vehicles grouped) ----------
function groupModels(vehicles) {
    const map = new Map();
    vehicles.forEach((v) => {
        const key = `${v.vehicle_name}|${v.type_id}|${v.price}`;
        if (!map.has(key)) {
            map.set(key, {
                key, name: v.vehicle_name, type_id: v.type_id,
                type_name: v.type_name, price: Number(v.price), units: []
            });
        }
        map.get(key).units.push(v);
    });
    return [...map.values()].map((m) => {
        const availableUnits = m.units.filter((u) => u.available_for_dates);
        return { ...m, availableUnits, available: availableUnits.length > 0 };
    });
}

function buildVehicleCard(model, query = "") {
    const q = query ? `&${query}` : "";
    const first = (model.availableUnits[0] || model.units[0]).vehicle_id;
    const count = model.availableUnits.length;
    const status = model.available
        ? `<span class="badge available vehicle-status">${count} available</span>`
        : `<span class="badge inactive vehicle-status">Unavailable</span>`;
    const book = model.available
        ? `<a href="booking.html?vehicle_id=${first}${q}" class="btn btn-sm">Book Now</a>`
        : `<button class="btn btn-sm" disabled>Unavailable</button>`;

    return `
    <article class="vehicle-card">
        <div class="vehicle-image">
            <img src="${vehicleImage(model.name, model.type_name)}" alt="${escapeHTML(model.name)}" loading="lazy">
            <span class="vehicle-tag">${escapeHTML(model.type_name)}</span>
            ${status}
        </div>
        <div class="vehicle-info">
            <h3>${escapeHTML(model.name)}</h3>
            <div class="vehicle-specs">
                <span><i class="fa-solid ${typeIcon(model.type_name)}"></i> ${escapeHTML(model.type_name)}</span>
                <span><i class="fa-solid fa-user-group"></i> ${seatText(model.type_name)}</span>
            </div>
            <div class="vehicle-bottom">
                <div class="vehicle-price"><strong>${formatPrice(model.price)}</strong> <span>/ day</span></div>
                <div class="vehicle-actions">
                    <a href="vehicle_details.html?id=${first}${q}" class="btn btn-outline btn-sm">Details</a>
                    ${book}
                </div>
            </div>
        </div>
    </article>`;
}

// ---------- Navbar + footer ----------
function buildHeader() {
    const page = document.body.dataset.page || "";
    const user = getUser();
    const admin = getAdmin();

    const link = (key, href, icon, label) => `
        <li><a href="${href}" class="${page === key ? "active" : ""}">
            <i class="fa-solid ${icon}"></i> ${label}</a></li>`;

    let account;
    if (admin) {
        account = `
            <li><a href="admin.html" class="${page === "admin" ? "active" : ""}">
                <i class="fa-solid fa-gauge"></i> Admin</a></li>
            <li><button class="nav-logout" id="navLogout" type="button">Logout</button></li>`;
    } else if (user) {
        account = `
            <li><span class="nav-user"><i class="fa-solid fa-circle-user"></i> ${escapeHTML(String(user.name).split(" ")[0])}</span></li>
            <li><button class="nav-logout" id="navLogout" type="button">Logout</button></li>`;
    } else {
        account = link("login", "login.html", "fa-right-to-bracket", "Login");
    }

    return `
    <header class="site-header">
        <div class="site-header-inner">
            <a href="index.html" class="brand" aria-label="DriveEase home">
                <img src="../Images/Logo/driveease-logo.png" alt="DriveEase - Vehicle Rental">
            </a>
            <button class="nav-toggle" id="navToggle" type="button" aria-label="Open menu" aria-expanded="false">
                <span class="bars"></span>
            </button>
            <nav class="navbar" id="mainNav" aria-label="Main navigation">
                <ul>
                    ${link("home", "index.html", "fa-house", "Home")}
                    ${link("vehicles", "vehicles.html", "fa-car", "Vehicles")}
                    ${link("rentals", "my_rentals.html", "fa-calendar-check", "My Rentals")}
                    ${account}
                </ul>
            </nav>
        </div>
    </header>`;
}

function buildFooter() {
    return `
    <footer class="footer">
        <div class="footer-container">
            <div class="footer-column footer-about">
                <a href="index.html" class="footer-logo">
                    <img src="../Images/Logo/driveease-logo-light.png" alt="DriveEase">
                </a>
                <p>Making every journey easier, safer and more comfortable with reliable vehicle rentals.</p>
                <div class="social-icons">
                    <a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a>
                    <a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
                    <a href="#" aria-label="Twitter"><i class="fa-brands fa-twitter"></i></a>
                    <a href="#" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                </div>
            </div>
            <div class="footer-column">
                <h3>Quick Links</h3>
                <ul>
                    <li><a href="index.html">Home</a></li>
                    <li><a href="vehicles.html">Vehicles</a></li>
                    <li><a href="my_rentals.html">My Rentals</a></li>
                    <li><a href="login.html">Login</a></li>
                </ul>
            </div>
            <div class="footer-column">
                <h3>Vehicles</h3>
                <ul>
                    <li><a href="vehicles.html?type=Bike">Bikes</a></li>
                    <li><a href="vehicles.html?type=Car">Cars</a></li>
                    <li><a href="vehicles.html?type=Minibus">Minibuses</a></li>
                </ul>
            </div>
            <div class="footer-column">
                <h3>Contact Us</h3>
                <ul class="contact-list">
                    <li><i class="fa-solid fa-location-dot"></i> Bengaluru, Karnataka</li>
                    <li><i class="fa-solid fa-phone"></i> +91 98765 43210</li>
                    <li><i class="fa-solid fa-envelope"></i> support@driveease.com</li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <p>© ${new Date().getFullYear()} DriveEase. All Rights Reserved.</p>
            <p>Vehicle Rental Management System · <a href="admin_login.html">Admin</a></p>
        </div>
    </footer>`;
}

function mountLayout() {
    const header = document.getElementById("siteHeader");
    const footer = document.getElementById("siteFooter");
    if (header) header.outerHTML = buildHeader();
    if (footer) footer.outerHTML = buildFooter();

    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("mainNav");
    if (toggle && nav) {
        toggle.addEventListener("click", () => {
            const open = nav.classList.toggle("open");
            toggle.setAttribute("aria-expanded", String(open));
        });
    }

    const logout = document.getElementById("navLogout");
    if (logout) {
        logout.addEventListener("click", () => {
            logoutAll();
            window.location.href = "index.html";
        });
    }
}

mountLayout();
