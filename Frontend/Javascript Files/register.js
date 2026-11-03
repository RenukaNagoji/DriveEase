// =============================================
// DRIVE EASE - CUSTOMER REGISTRATION
// =============================================
const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");
const registerButton = document.getElementById("registerButton");

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    const fail = (text) => {
        registerMessage.textContent = text;
        registerMessage.className = "message error";
    };

    if (password.length < 8) return fail("Password must contain at least 8 characters.");
    if (password !== confirmPassword) return fail("Passwords do not match.");

    registerButton.disabled = true;
    registerMessage.textContent = "";

    try {
        await api("/register", {
            method: "POST",
            body: {
                name: document.getElementById("name").value.trim(),
                email: document.getElementById("email").value.trim(),
                phone: document.getElementById("phone").value.trim(),
                address: document.getElementById("address").value.trim(),
                password
            }
        });
        registerMessage.textContent = "Registration successful! Redirecting to login...";
        registerMessage.className = "message success";
        registerForm.reset();
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
    } catch (error) {
        fail(error.message);
        registerButton.disabled = false;
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
