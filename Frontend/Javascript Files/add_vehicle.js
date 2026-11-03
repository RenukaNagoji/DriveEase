// =============================================
// DRIVE EASE - ADD VEHICLE (admin)
// =============================================
const addForm = document.getElementById("addVehicleForm");
const addMessage = document.getElementById("addVehicleMessage");
const saveButton = document.getElementById("saveVehicleButton");
const addTypeSelect = document.getElementById("vehicleType");

if (admin) {
    fillTypeSelect(addTypeSelect).then((types) => {
        if (!types.length) setAlert(addMessage, "No vehicle types found in the database.", "error");
    }).catch((error) => setAlert(addMessage, error.message, "error"));
}

addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const vehicle = {
        vehicle_name: document.getElementById("vehicleName").value.trim(),
        type_id: Number(addTypeSelect.value),
        price: Number(document.getElementById("vehiclePrice").value),
        status: document.getElementById("vehicleStatus").value,
        quantity: Number(document.getElementById("vehicleQuantity").value)
    };
    if (!vehicle.vehicle_name || !vehicle.type_id || !(vehicle.price >= 0)) {
        return setAlert(addMessage, "Please fill in all required fields.", "error");
    }

    saveButton.disabled = true;
    saveButton.textContent = "Adding...";
    try {
        const result = await adminApi("/admin/vehicles", { method: "POST", body: vehicle });
        setAlert(addMessage, result.message, "success");
        addForm.reset();
        document.getElementById("vehicleQuantity").value = 1;
    } catch (error) {
        setAlert(addMessage, error.message, "error");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Add Vehicle";
    }
});
