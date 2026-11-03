// =============================================
// DRIVE EASE - HOME PAGE
// =============================================
const searchForm = document.getElementById("searchForm");
const typeSelect = document.getElementById("vehicleType");
const pickupInput = document.getElementById("pickupDate");
const dropoffInput = document.getElementById("dropoffDate");

// Pick-up cannot be in the past; return cannot be before pick-up.
const nowInput = toInputDateTime(new Date());
pickupInput.min = nowInput;
dropoffInput.min = nowInput;
pickupInput.addEventListener("change", () => {
    dropoffInput.min = pickupInput.value || nowInput;
    if (dropoffInput.value && dropoffInput.value <= pickupInput.value) dropoffInput.value = "";
});

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (typeSelect.value) params.set("type", typeSelect.value);
    if (pickupInput.value && dropoffInput.value) {
        if (dropoffInput.value <= pickupInput.value) {
            alert("Return time must be after the pick-up time.");
            return;
        }
        params.set("start", pickupInput.value);
        params.set("end", dropoffInput.value);
    }
    const pickup = document.getElementById("pickupLocation").value.trim();
    if (pickup) params.set("pickup", pickup);
    window.location.href = `vehicles.html${params.toString() ? "?" + params : ""}`;
});

async function loadTypes() {
    try {
        const types = await api("/vehicle-types");
        types.forEach((t) => typeSelect.add(new Option(t.type_name, t.type_name)));
    } catch (error) {
        console.warn("Vehicle types not loaded:", error.message);
    }
}

async function loadPopular() {
    const grid = document.getElementById("popularGrid");
    try {
        const models = groupModels(await api("/vehicles"));
        // One model per category first, then fill up to four cards.
        const chosen = [];
        const seenTypes = new Set();
        models.filter((m) => m.available).forEach((m) => {
            if (!seenTypes.has(m.type_id)) { seenTypes.add(m.type_id); chosen.push(m); }
        });
        models.filter((m) => m.available && !chosen.includes(m))
            .forEach((m) => { if (chosen.length < 4) chosen.push(m); });

        grid.innerHTML = chosen.length
            ? chosen.slice(0, 4).map((m) => buildVehicleCard(m)).join("")
            : '<p class="alert" style="grid-column:1/-1;">No vehicles are available right now.</p>';
    } catch (error) {
        grid.innerHTML = `<p class="alert error" style="grid-column:1/-1;">${escapeHTML(error.message)}</p>`;
    }
}

async function loadOffers() {
    const grid = document.getElementById("offerGrid");
    try {
        const offers = await api("/offers");
        if (offers.length === 0) {
            grid.innerHTML = '<p class="alert" style="grid-column:1/-1;">No offers are running right now. Please check back soon.</p>';
            return;
        }
        grid.innerHTML = offers.map((o) => `
            <article class="offer-card">
                <div class="offer-value">${o.discount_type === "percentage"
                    ? `${Number(o.discount_value)}% OFF` : `${formatPrice(o.discount_value)} OFF`}</div>
                <h3>${escapeHTML(o.offer_name)}</h3>
                <p>${escapeHTML(o.rule)}</p>
                <span class="offer-code">${escapeHTML(o.offer_code)}</span>
            </article>`).join("");
    } catch (error) {
        grid.innerHTML = `<p class="alert error" style="grid-column:1/-1;">${escapeHTML(error.message)}</p>`;
    }
}

loadTypes();
loadPopular();
loadOffers();
