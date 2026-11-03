// =============================================
// DRIVE EASE - ADMIN LOGIN
// =============================================
const adminForm = document.getElementById("adminLoginForm");
const adminMessage = document.getElementById("adminLoginMessage");
const adminButton = document.getElementById("adminLoginButton");

if (getAdmin()) window.location.replace("admin.html");

adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    adminMessage.textContent = "";
    adminButton.disabled = true;
    adminButton.textContent = "Signing in...";

    try {
        const data = await api("/admin/login", {
            method: "POST",
            body: {
                email: document.getElementById("adminEmail").value.trim(),
                password: document.getElementById("adminPassword").value
            }
        });
        localStorage.removeItem("user");
        localStorage.setItem("admin", JSON.stringify(data.admin));
        window.location.href = "admin.html";
    } catch (error) {
        adminMessage.textContent = error.message;
        adminMessage.className = "message error";
        adminButton.disabled = false;
        adminButton.textContent = "Sign In";
    }
});

document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "Hide" : "Show";
    });
});
