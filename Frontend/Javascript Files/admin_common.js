// =============================================
// DRIVE EASE - ADMIN SHARED (guard + sidebar)
// =============================================
const admin = getAdmin();
if (!admin) {
    window.location.replace("admin_login.html");
}

(function buildAdminSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    if (!sidebar) return;
    const current = window.location.pathname.split("/").pop();
    const link = (href, icon, label, extra = "") => `
        <a href="${href}" class="${current === href.split("#")[0] && !extra ? "active" : ""}">
            <i class="fa-solid ${icon}"></i> ${label}</a>`;

    sidebar.innerHTML = `
        <h3>MANAGEMENT</h3>
        ${link("admin.html", "fa-gauge", "Dashboard")}
        ${link("manage_vehicles.html", "fa-car", "Manage Vehicles")}
        ${link("add_vehicle.html", "fa-plus", "Add Vehicle")}
        ${link("admin.html#bookingsSection", "fa-calendar-check", "Bookings", "x")}
        ${link("admin.html#paymentsSection", "fa-credit-card", "Payments", "x")}
        ${link("admin.html#customersSection", "fa-users", "Customers", "x")}
        ${link("admin.html#offersSection", "fa-gift", "Offers", "x")}`;
})();

// Shared helpers for admin pages
function setAlert(element, text, type = "") {
    element.textContent = text;
    element.className = `alert ${type}`.trim();
}

async function adminApi(path, options = {}) {
    try {
        return await api(path, { ...options, role: "admin" });
    } catch (error) {
        if (error.status === 401) {
            window.location.href = "admin_login.html";
        }
        throw error;
    }
}

const VEHICLE_STATUS_OPTIONS = ["available", "maintenance", "inactive"];

async function fillTypeSelect(select, selected) {
    const types = await api("/vehicle-types");
    select.innerHTML = '<option value="">Select vehicle type</option>' +
        types.map((t) => `<option value="${t.type_id}">${escapeHTML(t.type_name)}</option>`).join("");
    if (selected) select.value = String(selected);
    return types;
}
