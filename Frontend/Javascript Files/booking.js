// =============================================
// DRIVE EASE - BOOKING PAGE
// One booking = one or more vehicles + optional drivers + one offer
// =============================================
const els = {
    form: document.getElementById("bookingForm"),
    message: document.getElementById("bookingMessage"),
    start: document.getElementById("startDate"),
    end: document.getElementById("endDate"),
    pickup: document.getElementById("pickupLocation"),
    dropoff: document.getElementById("dropoffLocation"),
    picker: document.getElementById("vehiclePicker"),
    driverCard: document.getElementById("driverCard"),
    driverRows: document.getElementById("driverRows"),
    offerList: document.getElementById("offerList"),
    payMethods: document.getElementById("payMethods"),
    confirm: document.getElementById("confirmBookingButton")
};

const PAYMENT_OPTIONS = [
    ["cash", "Cash", "fa-money-bill-wave"],
    ["card", "Card", "fa-credit-card"],
    ["upi", "UPI", "fa-mobile-screen"],
    ["net_banking", "Net Banking", "fa-building-columns"],
    ["other", "Other", "fa-ellipsis"]
];

const user = getUser();
const params = new URLSearchParams(window.location.search);
const preselectId = Number(params.get("vehicle_id")) || null;

let models = [];            // grouped vehicles free for the chosen dates
let quantities = {};        // model.key -> how many
let drivers = [];           // drivers for the chosen dates
let driverChoice = {};      // vehicle_id -> driver_id
let quote = null;           // last answer from /offers/check
let chosenOfferId = "";     // "" = no offer
let paymentMethod = "cash";
let checkToken = 0;

function showMessage(text, type = "") {
    els.message.textContent = text;
    els.message.className = `alert ${type}`.trim();
}

// ---------- Dates ----------
function validPeriod() {
    return els.start.value && els.end.value && els.end.value > els.start.value;
}
function rentalDays() {
    const hours = (new Date(els.end.value) - new Date(els.start.value)) / 3600000;
    return Math.max(1, Math.ceil(hours / 24 - 1e-9));
}
function periodBody() {
    return { start_date: els.start.value, end_date: els.end.value };
}

// ---------- Vehicles ----------
function selectedVehicleIds() {
    const ids = [];
    models.forEach((m) => {
        const n = quantities[m.key] || 0;
        m.availableUnits.slice(0, n).forEach((u) => ids.push(u.vehicle_id));
    });
    return ids;
}

async function loadAvailability() {
    if (!validPeriod()) {
        models = [];
        els.picker.innerHTML = '<p class="alert">Select your pick-up and return time to see available vehicles.</p>';
        refreshAfterSelectionChange();
        return;
    }

    els.picker.innerHTML = '<p class="alert">Checking availability...</p>';
    const query = `start=${encodeURIComponent(els.start.value)}&end=${encodeURIComponent(els.end.value)}`;

    try {
        const [vehicles, driverList] = await Promise.all([
            api(`/vehicles?${query}`),
            api(`/drivers?${query}`)
        ]);
        drivers = driverList;
        models = groupModels(vehicles).filter((m) => m.available);

        // Keep quantities that are still possible; apply the preselected vehicle once.
        const next = {};
        models.forEach((m) => {
            next[m.key] = Math.min(quantities[m.key] || 0, m.availableUnits.length);
        });
        if (preselectId && !Object.values(next).some(Boolean) && !loadAvailability.done) {
            const match = models.find((m) => m.availableUnits.some((u) => u.vehicle_id === preselectId));
            if (match) next[match.key] = 1;
        }
        loadAvailability.done = true;
        quantities = next;
        renderPicker();
        refreshAfterSelectionChange();
    } catch (error) {
        els.picker.innerHTML = `<p class="alert error">${escapeHTML(error.message)}</p>`;
    }
}

function renderPicker() {
    if (models.length === 0) {
        els.picker.innerHTML = '<p class="alert">No vehicles are free for those dates. Please try different dates.</p>';
        return;
    }
    els.picker.innerHTML = models.map((m) => {
        const n = quantities[m.key] || 0;
        const max = m.availableUnits.length;
        return `
        <div class="pick-item ${n ? "selected" : ""}">
            <img src="${vehicleImage(m.name, m.type_name)}" alt="">
            <div>
                <h4>${escapeHTML(m.name)}</h4>
                <small>${escapeHTML(m.type_name)} · ${formatPrice(m.price)} / day · ${max} available</small>
            </div>
            <div class="qty">
                <button type="button" data-key="${escapeHTML(m.key)}" data-delta="-1" ${n === 0 ? "disabled" : ""} aria-label="Remove one">−</button>
                <span>${n}</span>
                <button type="button" data-key="${escapeHTML(m.key)}" data-delta="1" ${n >= max ? "disabled" : ""} aria-label="Add one">+</button>
            </div>
        </div>`;
    }).join("");
}

els.picker.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-key]");
    if (!button) return;
    const model = models.find((m) => m.key === button.dataset.key);
    if (!model) return;
    const next = (quantities[model.key] || 0) + Number(button.dataset.delta);
    quantities[model.key] = Math.min(Math.max(next, 0), model.availableUnits.length);
    renderPicker();
    refreshAfterSelectionChange();
});

// ---------- Drivers ----------
function renderDrivers() {
    const ids = selectedVehicleIds();
    els.driverCard.hidden = ids.length === 0 || drivers.length === 0;
    if (els.driverCard.hidden) return;

    // forget drivers for vehicles that were removed
    Object.keys(driverChoice).forEach((id) => {
        if (!ids.includes(Number(id))) delete driverChoice[id];
    });

    els.driverRows.innerHTML = ids.map((id) => {
        const vehicle = models.flatMap((m) => m.units).find((u) => u.vehicle_id === id);
        const taken = Object.entries(driverChoice)
            .filter(([vid]) => Number(vid) !== id).map(([, did]) => Number(did));
        const options = drivers.map((d) => {
            const disabled = d.busy || taken.includes(d.driver_id);
            const rating = d.avg_rating !== null ? ` · ★ ${d.avg_rating}` : "";
            const label = `${d.name} · ${d.experience} yrs${rating} · ${d.languages || "—"}${d.busy ? " (booked)" : ""}`;
            const selected = Number(driverChoice[id]) === d.driver_id ? "selected" : "";
            return `<option value="${d.driver_id}" ${disabled ? "disabled" : ""} ${selected}>${escapeHTML(label)}</option>`;
        }).join("");
        return `
        <div class="driver-row">
            <span>${escapeHTML(vehicle ? vehicle.vehicle_name : "Vehicle")} <small>#${id}</small></span>
            <select class="form-control" data-vehicle="${id}">
                <option value="">No driver needed</option>${options}
            </select>
        </div>`;
    }).join("");
}

els.driverRows.addEventListener("change", (event) => {
    const select = event.target.closest("select[data-vehicle]");
    if (!select) return;
    if (select.value) driverChoice[select.dataset.vehicle] = select.value;
    else delete driverChoice[select.dataset.vehicle];
    renderDrivers();
});

// ---------- Offers ----------
async function checkOffers() {
    const ids = selectedVehicleIds();
    const token = ++checkToken;

    if (!user || ids.length === 0 || !validPeriod()) {
        quote = null;
        chosenOfferId = "";
        els.offerList.innerHTML = '<p class="alert">Choose your vehicles to see which offers you can use.</p>';
        updateSummary();
        return;
    }

    try {
        const result = await api("/offers/check", {
            method: "POST", role: "customer",
            body: { vehicle_ids: ids, ...periodBody() }
        });
        if (token !== checkToken) return; // a newer check is running
        quote = result;
        const chosen = quote.offers.find((o) => String(o.offer_id) === String(chosenOfferId));
        if (!chosen || !chosen.eligible) chosenOfferId = "";
        renderOffers();
    } catch (error) {
        if (token !== checkToken) return;
        quote = null;
        els.offerList.innerHTML = `<p class="alert error">${escapeHTML(error.message)}</p>`;
    }
    updateSummary();
}

function renderOffers() {
    const none = `
        <label class="offer-choice ${chosenOfferId === "" ? "selected" : ""}">
            <input type="radio" name="offer" value="" ${chosenOfferId === "" ? "checked" : ""}>
            <div><strong>No offer</strong></div>
        </label>`;

    const rows = quote.offers.map((o) => {
        const value = o.discount_type === "percentage"
            ? `${o.discount_value}% off` : `${formatPrice(o.discount_value)} off`;
        const selected = String(chosenOfferId) === String(o.offer_id);
        return `
        <label class="offer-choice ${selected ? "selected" : ""} ${o.eligible ? "" : "disabled"}">
            <input type="radio" name="offer" value="${o.offer_id}" ${o.eligible ? "" : "disabled"} ${selected ? "checked" : ""}>
            <div>
                <strong>${escapeHTML(o.offer_name)} · ${escapeHTML(o.offer_code)} · ${value}</strong>
                <small>${escapeHTML(o.rule)}</small>
                ${o.eligible
                    ? `<small class="save">You save ${formatPrice(o.discount)} on this booking</small>`
                    : `<small class="why">${escapeHTML(o.reason)}</small>`}
            </div>
        </label>`;
    }).join("");

    els.offerList.innerHTML = none + rows;
}

els.offerList.addEventListener("change", (event) => {
    if (event.target.name !== "offer") return;
    chosenOfferId = event.target.value;
    renderOffers();
    updateSummary();
});

// ---------- Payment ----------
els.payMethods.innerHTML = PAYMENT_OPTIONS.map(([value, label, icon]) => `
    <label class="pay-method ${value === paymentMethod ? "selected" : ""}">
        <input type="radio" name="payment" value="${value}" ${value === paymentMethod ? "checked" : ""}>
        <i class="fa-solid ${icon}"></i>${label}
    </label>`).join("");

els.payMethods.addEventListener("change", (event) => {
    paymentMethod = event.target.value;
    els.payMethods.querySelectorAll(".pay-method").forEach((el) =>
        el.classList.toggle("selected", el.querySelector("input").checked));
});

// ---------- Summary ----------
function updateSummary() {
    const ids = selectedVehicleIds();
    const days = validPeriod() ? rentalDays() : 0;
    const units = models.flatMap((m) => m.availableUnits.map((u) => ({ ...u, model: m })));

    const lines = models
        .filter((m) => (quantities[m.key] || 0) > 0)
        .map((m) => `<li><span>${quantities[m.key]} × ${escapeHTML(m.name)}</span>
                     <strong>${formatPrice(m.price * quantities[m.key] * days)}</strong></li>`);
    document.getElementById("summaryItems").innerHTML =
        lines.length ? lines.join("") : "<li>No vehicles selected yet</li>";

    const subtotal = units
        .filter((u) => ids.includes(u.vehicle_id))
        .reduce((sum, u) => sum + Number(u.price) * days, 0);

    const chosen = quote && quote.offers.find((o) => String(o.offer_id) === String(chosenOfferId));
    const discount = chosen && chosen.eligible ? chosen.discount : 0;

    document.getElementById("summaryDays").textContent = days ? `${days} day${days === 1 ? "" : "s"}` : "—";
    document.getElementById("summarySubtotal").textContent = formatPrice(subtotal);
    document.getElementById("summaryOfferLabel").textContent = chosen ? `Discount (${chosen.offer_code})` : "Discount";
    document.getElementById("summaryDiscount").textContent = `−${formatPrice(discount)}`;
    document.getElementById("summaryTotal").textContent = formatPrice(Math.max(0, subtotal - discount));
}

function refreshAfterSelectionChange() {
    renderDrivers();
    updateSummary();
    checkOffers();
}

// ---------- Date inputs ----------
const nowValue = toInputDateTime(new Date());
els.start.min = nowValue;
els.end.min = nowValue;
els.start.value = params.get("start") || "";
els.end.value = params.get("end") || "";
els.pickup.value = params.get("pickup") || "";

els.start.addEventListener("change", () => {
    els.end.min = els.start.value || nowValue;
    if (els.end.value && els.end.value <= els.start.value) els.end.value = "";
    loadAvailability();
});
els.end.addEventListener("change", () => {
    if (els.end.value && els.start.value && els.end.value <= els.start.value) {
        showMessage("Return time must be after the pick-up time.", "error");
        els.end.value = "";
        return;
    }
    showMessage("");
    loadAvailability();
});

// ---------- Submit ----------
els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    if (!getUser()) {
        window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search)}`;
        return;
    }
    if (!validPeriod()) return showMessage("Please choose valid pick-up and return times.", "error");
    if (els.start.value < toInputDateTime(new Date())) return showMessage("Pick-up time cannot be in the past.", "error");
    if (!els.pickup.value.trim() || !els.dropoff.value.trim()) return showMessage("Please enter both pick-up and drop-off locations.", "error");

    const ids = selectedVehicleIds();
    if (ids.length === 0) return showMessage("Please select at least one vehicle.", "error");

    els.confirm.disabled = true;
    els.confirm.textContent = "Processing...";

    try {
        const result = await api("/bookings", {
            method: "POST", role: "customer",
            body: {
                items: ids.map((id) => ({ vehicle_id: id, driver_id: driverChoice[id] ? Number(driverChoice[id]) : null })),
                offer_id: chosenOfferId ? Number(chosenOfferId) : null,
                ...periodBody(),
                pickup_location: els.pickup.value.trim(),
                dropoff_location: els.dropoff.value.trim(),
                payment_method: paymentMethod
            }
        });

        showMessage(
            `Booking #${result.group_id} placed! Total ${formatPrice(result.total_amount)}` +
            `${result.discount ? ` (you saved ${formatPrice(result.discount)})` : ""}. ` +
            `Payment reference: ${result.transaction_reference}. Redirecting to My Rentals...`,
            "success"
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => { window.location.href = "my_rentals.html"; }, 2800);
    } catch (error) {
        if (error.status === 401) {
            showMessage("Your session expired. Please log in again.", "error");
            setTimeout(() => { window.location.href = "login.html"; }, 1200);
            return;
        }
        showMessage(error.message, "error");
        if (error.status === 409) loadAvailability();
        els.confirm.disabled = false;
        els.confirm.textContent = "Confirm Booking";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
});

// ---------- Start ----------
if (!user) {
    const here = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
    showMessage("Please log in to make a booking.", "error");
    els.message.innerHTML += ` <a href="login.html?next=${here}" style="text-decoration:underline;font-weight:700;">Log in here</a>`;
    els.confirm.disabled = true;
}
loadAvailability();
