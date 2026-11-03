// =============================================
// DRIVE EASE - EDIT VEHICLE (admin)
// =============================================
const vehicleSelect = document.getElementById("editVehicleSelect");
const nameInput = document.getElementById("editVehicleName");
const typeSelect = document.getElementById("editVehicleType");
const priceInput = document.getElementById("editVehiclePrice");
const statusSelect = document.getElementById("editVehicleStatus");
const editMessage = document.getElementById("editVehicleMessage");
const updateButton = document.getElementById("updateVehicleButton");
let vehicles = [];

function fillForm(vehicleId) {
    const vehicle = vehicles.find((v) => Number(v.vehicle_id) === Number(vehicleId));
    if (!vehicle) return;
    vehicleSelect.value = String(vehicle.vehicle_id);
    nameInput.value = vehicle.vehicle_name;
    typeSelect.value = String(vehicle.type_id);
    priceInput.value = vehicle.price;
    statusSelect.value = vehicle.status;
}

async function loadVehicles() {
    vehicles = await api("/vehicles");
    vehicleSelect.innerHTML = '<option value="">Select a vehicle</option>' +
        vehicles.map((v) => `<option value="${v.vehicle_id}">#${v.vehicle_id} - ${escapeHTML(v.vehicle_name)}</option>`).join("");
}

async function init() {
    try {
        await Promise.all([loadVehicles(), fillTypeSelect(typeSelect)]);
        const requested = new URLSearchParams(window.location.search).get("id");
        if (requested) fillForm(requested);
        else if (vehicles.length) fillForm(vehicles[0].vehicle_id);
    } catch (error) {
        setAlert(editMessage, error.message, "error");
    }
}

vehicleSelect.addEventListener("change", () => { fillForm(vehicleSelect.value); setAlert(editMessage, ""); });
document.getElementById("resetEditVehicleButton").addEventListener("click", (event) => {
    event.preventDefault();
    fillForm(vehicleSelect.value);
});

document.getElementById("editVehicleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = Number(vehicleSelect.value);
    if (!id) return setAlert(editMessage, "Please select a vehicle.", "error");

    updateButton.disabled = true;
    try {
        const result = await adminApi(`/admin/vehicles/${id}`, {
            method: "PUT",
            body: {
                vehicle_name: nameInput.value.trim(),
                type_id: Number(typeSelect.value),
                price: Number(priceInput.value),
                status: statusSelect.value
            }
        });
        await loadVehicles();
        fillForm(id);
        setAlert(editMessage, result.message, "success");
    } catch (error) {
        setAlert(editMessage, error.message, "error");
    } finally {
        updateButton.disabled = false;
    }
});

if (admin) init();
