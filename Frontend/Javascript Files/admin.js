// =============================================
// DRIVE EASE - ADMIN DASHBOARD
// =============================================
const adminMessage = document.getElementById("adminMessage");
if (admin) {
    document.getElementById("adminWelcome").textContent =
        `Welcome, ${admin.name || "Admin"}. Manage your vehicle rental business in one place.`;
}

const money = (v) => formatPrice(v);
const empty = (tbody, cols, text) => { tbody.innerHTML = `<tr><td colspan="${cols}">${text}</td></tr>`; };

async function loadStatistics() {
    const d = await adminApi("/admin/stats");
    document.getElementById("totalVehicles").textContent = d.totalVehicles;
    document.getElementById("availableVehicles").textContent = d.availableVehicles;
    document.getElementById("rentedVehicles").textContent = d.rentedVehicles;
    document.getElementById("totalBookings").textContent = d.totalBookings;
    document.getElementById("totalCustomers").textContent = d.totalCustomers;
    document.getElementById("totalRevenue").textContent = money(d.totalRevenue);
}

async function loadCustomers() {
    const tbody = document.getElementById("customersTableBody");
    const rows = await adminApi("/admin/customers");
    if (!rows.length) return empty(tbody, 5, "No customers registered yet.");
    tbody.innerHTML = rows.map((c) => `
        <tr><td>${c.customer_id}</td><td>${escapeHTML(c.name)}</td><td>${escapeHTML(c.email)}</td>
        <td>${escapeHTML(c.phone || "—")}</td><td>${escapeHTML(c.address || "—")}</td></tr>`).join("");
}

function statusSelect(kind, id, options, current) {
    return `<select class="inline-select" data-kind="${kind}" data-id="${id}" data-current="${current}">
        ${options.map((o) => `<option value="${o}" ${o === current ? "selected" : ""}>${titleCase(o)}</option>`).join("")}
    </select>`;
}

async function loadBookings() {
    const tbody = document.getElementById("bookingsTableBody");
    const rows = await adminApi("/admin/bookings");
    if (!rows.length) return empty(tbody, 7, "No bookings available yet.");
    tbody.innerHTML = rows.map((g) => `
        <tr>
            <td>#${g.group_id}</td>
            <td>${escapeHTML(g.customer_name)}<small>${escapeHTML(g.customer_email)}</small></td>
            <td>${g.items.map((i) => `${escapeHTML(i.vehicle_name)} <small>#${i.vehicle_id}${i.driver_name ? " · driver " + escapeHTML(i.driver_name) : ""}</small>`).join("")}</td>
            <td>${formatDateTime(g.start_date)}<small>to ${formatDateTime(g.end_date)}</small></td>
            <td>${g.offer_code ? `${escapeHTML(g.offer_code)}<small>−${money(g.discount_amount)}</small>` : "—"}</td>
            <td>${money(g.total_amount)}</td>
            <td>${statusSelect("booking", g.group_id, ["pending", "confirmed", "completed", "cancelled"], g.status)}</td>
        </tr>`).join("");
}

async function loadPayments() {
    const tbody = document.getElementById("paymentsTableBody");
    const rows = await adminApi("/admin/payments");
    if (!rows.length) return empty(tbody, 7, "No payment records available.");
    tbody.innerHTML = rows.map((p) => `
        <tr>
            <td>${p.payment_id}</td><td>#${p.group_id}</td><td>${escapeHTML(p.customer_name)}</td>
            <td>${money(p.amount)}<small>${escapeHTML(p.transaction_reference || "")}</small></td>
            <td>${escapeHTML(titleCase(p.payment_method))}</td>
            <td>${p.payment_date ? formatDateTime(p.payment_date) : "—"}</td>
            <td>${statusSelect("payment", p.payment_id, ["pending", "successful", "failed", "refunded"], p.status)}</td>
        </tr>`).join("");
}

async function loadOffers() {
    const tbody = document.getElementById("offersTableBody");
    const rows = await adminApi("/admin/offers");
    if (!rows.length) return empty(tbody, 7, "No offers created yet.");
    tbody.innerHTML = rows.map((o) => `
        <tr>
            <td>${o.offer_id}</td><td><strong>${escapeHTML(o.offer_code)}</strong></td><td>${escapeHTML(o.offer_name)}</td>
            <td>${o.discount_type === "percentage" ? `${o.discount_value}%` : money(o.discount_value)}</td>
            <td>${escapeHTML(o.rule)}</td>
            <td>${formatDate(o.valid_from)}<small>to ${formatDate(o.valid_to)}</small></td>
            <td><button class="btn btn-sm ${o.is_active ? "btn-success" : "btn-outline"}" data-offer="${o.offer_id}" data-active="${o.is_active}">
                ${o.is_active ? "Active" : "Inactive"}</button></td>
        </tr>`).join("");
}

// Status dropdowns (bookings + payments)
document.addEventListener("change", async (event) => {
    const select = event.target.closest("select[data-kind]");
    if (!select) return;
    const path = select.dataset.kind === "booking"
        ? `/admin/bookings/${select.dataset.id}/status`
        : `/admin/payments/${select.dataset.id}/status`;
    try {
        const result = await adminApi(path, { method: "PUT", body: { status: select.value } });
        setAlert(adminMessage, result.message, "success");
        await Promise.all([loadBookings(), loadPayments(), loadStatistics()]);
    } catch (error) {
        setAlert(adminMessage, error.message, "error");
        select.value = select.dataset.current;
    }
});

// Offer activate / deactivate
document.getElementById("offersTableBody").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-offer]");
    if (!button) return;
    try {
        const result = await adminApi(`/admin/offers/${button.dataset.offer}/active`, {
            method: "PUT", body: { is_active: button.dataset.active !== "true" }
        });
        setAlert(adminMessage, result.message, "success");
        await loadOffers();
    } catch (error) {
        setAlert(adminMessage, error.message, "error");
    }
});

// Add offer form
const offerForm = document.getElementById("offerForm");
const offerMessage = document.getElementById("offerMessage");
document.getElementById("showOfferFormButton").addEventListener("click", () => {
    offerForm.hidden = false;
    offerForm.scrollIntoView({ behavior: "smooth", block: "center" });
});
document.getElementById("cancelOfferButton").addEventListener("click", () => {
    offerForm.reset();
    offerForm.hidden = true;
    offerMessage.textContent = "";
});
offerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const offer = {
        offer_code: document.getElementById("offerCode").value.trim(),
        offer_name: document.getElementById("offerName").value.trim(),
        discount_type: document.getElementById("discountType").value,
        discount_value: Number(document.getElementById("discountValue").value),
        valid_from: document.getElementById("validFrom").value,
        valid_to: document.getElementById("validTo").value
    };
    if (offer.discount_type === "percentage" && offer.discount_value > 100) {
        offerMessage.className = "message error";
        offerMessage.textContent = "Percentage discount cannot exceed 100%.";
        return;
    }
    if (offer.valid_to < offer.valid_from) {
        offerMessage.className = "message error";
        offerMessage.textContent = "The end date must be on or after the start date.";
        return;
    }
    try {
        await adminApi("/admin/offers", { method: "POST", body: offer });
        offerMessage.className = "message success";
        offerMessage.textContent = "Offer added successfully!";
        offerForm.reset();
        offerForm.hidden = true;
        await loadOffers();
    } catch (error) {
        offerMessage.className = "message error";
        offerMessage.textContent = error.message;
    }
});

async function loadDashboard() {
    setAlert(adminMessage, "Loading dashboard...");
    const results = await Promise.allSettled([
        loadStatistics(), loadCustomers(), loadBookings(), loadPayments(), loadOffers()
    ]);
    const failed = results.find((r) => r.status === "rejected");
    if (failed) setAlert(adminMessage, failed.reason.message, "error");
    else setAlert(adminMessage, "Dashboard data refreshed.", "success");
}

document.getElementById("refreshDashboardButton").addEventListener("click", loadDashboard);
if (admin) loadDashboard();
