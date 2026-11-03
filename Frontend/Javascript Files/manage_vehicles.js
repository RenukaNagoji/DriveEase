// =============================================
// DRIVE EASE - MANAGE VEHICLES (admin)
// =============================================
const vehiclesBody = document.getElementById("manageVehiclesBody");
const manageMessage = document.getElementById("manageMessage");
const searchBox = document.getElementById("vehicleSearch");
const statusFilter = document.getElementById("vehicleStatusFilter");
let allVehicles = [];

async function loadVehicles() {
    setAlert(manageMessage, "Loading vehicles...");
    try {
        allVehicles = await api("/vehicles");
        render();
        setAlert(manageMessage, `${allVehicles.length} vehicle record(s) found.`);
    } catch (error) {
        vehiclesBody.innerHTML = '<tr><td colspan="6">Could not load vehicles. Check that the backend is running.</td></tr>';
        setAlert(manageMessage, error.message, "error");
    }
}

function render() {
    const term = searchBox.value.trim().toLowerCase();
    const shown = allVehicles.filter((v) =>
        v.vehicle_name.toLowerCase().includes(term) &&
        (!statusFilter.value || v.status === statusFilter.value));

    if (!shown.length) {
        vehiclesBody.innerHTML = '<tr><td colspan="6">No matching vehicles found.</td></tr>';
        return;
    }
    vehiclesBody.innerHTML = shown.map((v) => `
        <tr>
            <td>${v.vehicle_id}</td>
            <td>${escapeHTML(v.vehicle_name)}</td>
            <td>${escapeHTML(v.type_name)}</td>
            <td>${formatPrice(v.price)}</td>
            <td><span class="badge ${v.status}">${escapeHTML(titleCase(v.status))}</span></td>
            <td><div class="row-actions">
                <a class="btn btn-sm" href="edit_vehicle.html?id=${v.vehicle_id}">Edit</a>
                <button class="btn btn-danger btn-sm" data-delete="${v.vehicle_id}">Delete</button>
            </div></td>
        </tr>`).join("");
}

vehiclesBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-delete]");
    if (!button) return;
    if (!window.confirm("Delete this vehicle? This cannot be undone.")) return;
    button.disabled = true;
    try {
        const result = await adminApi(`/admin/vehicles/${button.dataset.delete}`, { method: "DELETE" });
        await loadVehicles();
        setAlert(manageMessage, result.message, "success");
    } catch (error) {
        setAlert(manageMessage, error.message, "error");
        button.disabled = false;
    }
});

searchBox.addEventListener("input", render);
statusFilter.addEventListener("change", render);
if (admin) loadVehicles();
