// =============================================
// DRIVE EASE - VEHICLES PAGE
// =============================================
const grid = document.getElementById("vehicleGrid");
const searchInput = document.getElementById("vehicleSearch");
const typeFilter = document.getElementById("typeFilter");
const startFilter = document.getElementById("startFilter");
const endFilter = document.getElementById("endFilter");
const availabilityFilter = document.getElementById("availabilityFilter");
const countText = document.getElementById("vehicleCount");
const messageBox = document.getElementById("vehicleMessage");
const emptyBox = document.getElementById("vehicleEmpty");
const dateHint = document.getElementById("dateHint");

let models = [];

// Filters can arrive from the home page search (?type=&start=&end=).
const params = new URLSearchParams(window.location.search);
startFilter.value = params.get("start") || "";
endFilter.value = params.get("end") || "";
startFilter.min = endFilter.min = toInputDateTime(new Date());

function dateQuery() {
    if (startFilter.value && endFilter.value && endFilter.value > startFilter.value) {
        return `start=${encodeURIComponent(startFilter.value)}&end=${encodeURIComponent(endFilter.value)}`;
    }
    return "";
}

async function loadTypes() {
    try {
        const types = await api("/vehicle-types");
        types.forEach((t) => typeFilter.add(new Option(t.type_name, t.type_name)));
        const wanted = (params.get("type") || "").toLowerCase();
        const match = types.find((t) => t.type_name.toLowerCase() === wanted);
        if (match) typeFilter.value = match.type_name;
    } catch (error) {
        console.warn("Types not loaded:", error.message);
    }
}

async function loadVehicles() {
    const query = dateQuery();
    messageBox.textContent = "Loading vehicles...";
    messageBox.className = "alert";
    grid.innerHTML = "";
    emptyBox.hidden = true;
    dateHint.textContent = query
        ? "Showing availability for your selected dates"
        : "Choose pick-up and return times to check availability for your dates";

    try {
        models = groupModels(await api(`/vehicles${query ? "?" + query : ""}`));
        messageBox.textContent = "";
        render();
    } catch (error) {
        messageBox.textContent = error.message;
        messageBox.className = "alert error";
        countText.textContent = "Vehicles unavailable";
    }
}

function render() {
    const term = searchInput.value.trim().toLowerCase();
    const wantedAvailability = availabilityFilter.value;

    const shown = models.filter((m) => {
        const matchesText = !term ||
            m.name.toLowerCase().includes(term) ||
            m.type_name.toLowerCase().includes(term);
        const matchesType = !typeFilter.value || m.type_name === typeFilter.value;
        const matchesAvail = wantedAvailability === "all" ||
            (wantedAvailability === "available" ? m.available : !m.available);
        return matchesText && matchesType && matchesAvail;
    });

    countText.textContent = `${shown.length} model${shown.length === 1 ? "" : "s"} found`;
    emptyBox.hidden = shown.length !== 0;
    grid.innerHTML = shown.map((m) => buildVehicleCard(m, dateQuery())).join("");
}

[searchInput, typeFilter, availabilityFilter].forEach((el) =>
    el.addEventListener(el === searchInput ? "input" : "change", render));

function onDatesChanged() {
    if (startFilter.value && endFilter.value && endFilter.value <= startFilter.value) {
        messageBox.textContent = "Return time must be after the pick-up time.";
        messageBox.className = "alert error";
        return;
    }
    loadVehicles();
}
startFilter.addEventListener("change", () => {
    endFilter.min = startFilter.value || toInputDateTime(new Date());
    onDatesChanged();
});
endFilter.addEventListener("change", onDatesChanged);

document.getElementById("resetFilters").addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "";
    availabilityFilter.value = "all";
    render();
});

loadTypes().then(loadVehicles);
