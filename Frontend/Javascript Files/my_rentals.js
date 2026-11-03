// =============================================
// DRIVE EASE - MY RENTALS
// =============================================
const rentalsMessage = document.getElementById("rentalsMessage");
const rentalsList = document.getElementById("rentalsList");
const rentalsEmpty = document.getElementById("rentalsEmpty");
const statusFilter = document.getElementById("bookingStatusFilter");

let bookings = [];

function showMessage(text, type = "") {
    rentalsMessage.textContent = text;
    rentalsMessage.className = `alert ${type}`.trim();
}

function canCancel(group) {
    return ["pending", "confirmed"].includes(group.status) &&
        parseDbDate(group.start_date) > new Date();
}

function renderBookings() {
    const filter = statusFilter.value;
    const shown = bookings.filter((g) => filter === "all" || g.status === filter);

    rentalsEmpty.hidden = shown.length !== 0;
    rentalsList.innerHTML = shown.map((g) => {
        const payment = g.payment;
        const items = g.items.map((i) => `
            <li>
                <div>
                    <strong>${escapeHTML(i.vehicle_name)}</strong>
                    <small>${escapeHTML(i.type_name)} · Driver: ${escapeHTML(i.driver_name || "Not selected")}</small>
                </div>
                <strong>${formatPrice(i.vehicle_price)}</strong>
            </li>`).join("");

        return `
        <article class="rental-card">
            <div class="rental-top">
                <div>
                    <h3>Booking #${g.group_id}</h3>
                    <small>${g.items.length} vehicle${g.items.length === 1 ? "" : "s"} · booked on ${formatDate(g.created_at)}</small>
                </div>
                <div class="badges">
                    <span class="badge ${g.status}">${escapeHTML(g.status)}</span>
                    <span class="badge ${payment ? payment.status : "pending"}">Payment: ${escapeHTML(payment ? payment.status : "none")}</span>
                </div>
            </div>

            <ul class="rental-items">${items}</ul>

            <div class="rental-details">
                <div><span class="label">Pick-up</span><span class="value">${formatDateTime(g.start_date)}</span></div>
                <div><span class="label">Return</span><span class="value">${formatDateTime(g.end_date)}</span></div>
                <div><span class="label">Pick-up location</span><span class="value">${escapeHTML(g.pickup_location)}</span></div>
                <div><span class="label">Drop-off location</span><span class="value">${escapeHTML(g.dropoff_location)}</span></div>
                ${payment ? `<div><span class="label">Payment method</span><span class="value">${escapeHTML(titleCase(payment.payment_method))}</span></div>
                <div><span class="label">Reference</span><span class="value">${escapeHTML(payment.transaction_reference || "—")}</span></div>` : ""}
                ${g.offer_code ? `<div><span class="label">Offer used</span><span class="value">${escapeHTML(g.offer_name)} (${escapeHTML(g.offer_code)})</span></div>` : ""}
            </div>

            <div class="rental-bottom">
                <div class="rental-total">
                    <div class="label">Total Amount${g.discount_amount > 0 ? ` · subtotal ${formatPrice(g.subtotal)}` : ""}</div>
                    <div class="amount">${formatPrice(g.total_amount)}</div>
                    ${g.discount_amount > 0 ? `<small>You saved ${formatPrice(g.discount_amount)}</small>` : ""}
                </div>
                ${canCancel(g) ? `<button class="btn btn-danger btn-sm" data-cancel="${g.group_id}">Cancel Booking</button>` : ""}
            </div>
        </article>`;
    }).join("");
}

function updateStats() {
    document.getElementById("totalBookings").textContent = bookings.length;
    document.getElementById("activeBookings").textContent =
        bookings.filter((g) => ["pending", "confirmed"].includes(g.status)).length;
    const paid = bookings.reduce((sum, g) =>
        sum + (g.payment && g.payment.status === "successful" ? g.payment.amount : 0), 0);
    document.getElementById("paidAmount").textContent = formatPrice(paid);
}

async function loadRentals() {
    const user = getUser();
    if (!user) {
        document.getElementById("customerName").textContent = "Guest";
        showMessage("Please log in to view your rentals.", "error");
        rentalsMessage.innerHTML += ' <a href="login.html?next=my_rentals.html" style="text-decoration:underline;font-weight:700;">Log in</a>';
        rentalsEmpty.hidden = true;
        return;
    }

    document.getElementById("customerName").textContent = user.name || "Customer";
    try {
        bookings = await api("/bookings/mine", { role: "customer" });
        showMessage("");
        updateStats();
        renderBookings();
    } catch (error) {
        if (error.status === 401) {
            showMessage("Your session expired. Please log in again.", "error");
            rentalsMessage.innerHTML += ' <a href="login.html?next=my_rentals.html" style="text-decoration:underline;font-weight:700;">Log in</a>';
            return;
        }
        showMessage(error.message, "error");
    }
}

rentalsList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-cancel]");
    if (!button) return;
    if (!window.confirm("Cancel this booking? This cannot be undone.")) return;

    button.disabled = true;
    try {
        const result = await api(`/bookings/${button.dataset.cancel}/cancel`, { method: "POST", role: "customer" });
        showMessage(result.message, "success");
        await loadRentals();
        showMessage(result.message, "success");
    } catch (error) {
        showMessage(error.message, "error");
        button.disabled = false;
    }
});

statusFilter.addEventListener("change", renderBookings);
loadRentals();
