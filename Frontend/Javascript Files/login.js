// =============================================
// DRIVE EASE - CUSTOMER LOGIN
// =============================================
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginButton = document.getElementById("loginButton");

// Page to open after login (e.g. a booking the customer was making).
function nextPage() {
    const next = new URLSearchParams(window.location.search).get("next") || "";
    return /^[\w.\-]+\.html(\?[\w=&%.\-:]*)?$/.test(next) ? next : "index.html";
}

if (getUser()) window.location.replace(nextPage());

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.textContent = "";
    loginButton.disabled = true;

    try {
        const data = await api("/login", {
            method: "POST",
            body: {
                email: document.getElementById("email").value.trim(),
                password: document.getElementById("password").value
            }
        });
        localStorage.removeItem("admin");
        localStorage.setItem("user", JSON.stringify(data.user));
        loginMessage.textContent = "Login successful!";
        loginMessage.className = "message success";
        setTimeout(() => { window.location.href = nextPage(); }, 400);
    } catch (error) {
        loginMessage.textContent = error.message;
        loginMessage.className = "message error";
        loginButton.disabled = false;
    }
});

document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "Hide" : "Show";
        button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
});
