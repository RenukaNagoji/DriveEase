// =============================================
// DRIVE EASE - VEHICLE DETAILS
// =============================================
const detailsMessage = document.getElementById("detailsMessage");
const detailsSection = document.getElementById("vehicleDetails");
const bookButton = document.getElementById("bookVehicleButton");

const params = new URLSearchParams(window.location.search);
const vehicleId = params.get("id");
const start = params.get("start");
const end = params.get("end");
const dateQuery = start && end
    ? `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}` : "";

document.getElementById("backLink").href = `vehicles.html${dateQuery ? "?" + dateQuery : ""}`;

function showError(message) {
    detailsMessage.textContent = message;
    detailsMessage.className = "alert error";
    detailsSection.hidden = true;
}

async function loadDetails() {
    if (!/^\d+$/.test(vehicleId || "")) {
        showError("Invalid vehicle. Please return to the Vehicles page.");
        return;
    }

    try {
        const all = await api(`/vehicles${dateQuery ? "?" + dateQuery : ""}`);
        const vehicle = all.find((v) => String(v.vehicle_id) === vehicleId);
        if (!vehicle) {
            showError("This vehicle could not be found.");
            return;
        }

        const model = groupModels(all).find((m) =>
            m.units.some((u) => u.vehicle_id === vehicle.vehicle_id));

        detailsMessage.textContent = "";
        detailsMessage.className = "alert";
        detailsSection.hidden = false;

        document.getElementById("vehicleName").textContent = vehicle.vehicle_name;
        document.getElementById("vehicleCategory").textContent = vehicle.type_name;
        document.getElementById("vehiclePrice").textContent = formatPrice(vehicle.price);
        document.title = `${vehicle.vehicle_name} | DriveEase`;

        const image = document.getElementById("vehicleImage");
        image.src = vehicleImage(vehicle.vehicle_name, vehicle.type_name);
        image.alt = vehicle.vehicle_name;

        const count = model.availableUnits.length;
        const availability = document.getElementById("availabilityText");
        availability.textContent = model.available
            ? `${count} vehicle${count === 1 ? "" : "s"} available${dateQuery ? " for your dates" : ""}`
            : "Currently unavailable";
        availability.style.color = model.available ? "var(--green)" : "var(--red)";

        document.getElementById("specList").innerHTML = `
            <li><i class="fa-solid ${typeIcon(vehicle.type_name)}"></i> ${escapeHTML(vehicle.type_name)}</li>
            <li><i class="fa-solid fa-user-group"></i> ${seatText(vehicle.type_name)}</li>
            <li><i class="fa-solid fa-user-tie"></i> Driver available on request</li>
            <li><i class="fa-solid fa-shield-halved"></i> Verified &amp; maintained</li>`;

        bookButton.disabled = !model.available;
        if (!model.available) bookButton.textContent = "Currently Unavailable";

        const target = (model.availableUnits[0] || vehicle).vehicle_id;
        bookButton.addEventListener("click", () => {
            window.location.href =
                `booking.html?vehicle_id=${target}${dateQuery ? "&" + dateQuery : ""}`;
        });
    } catch (error) {
        showError(error.message);
    }
}

loadDetails();
