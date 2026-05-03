function switchTab(tab) {
    document.getElementById("login-tab").classList.toggle("active", tab === "login");
    document.getElementById("register-tab").classList.toggle("active", tab === "register");
    document.getElementById("login-form").style.display = tab === "login" ? "flex" : "none";
    document.getElementById("register-form").style.display = tab === "register" ? "flex" : "none";
    hideMessages();
}

function showError(msg) {
    const el = document.getElementById("error-msg");
    el.textContent = msg;
    el.style.display = "block";
    document.getElementById("success-msg").style.display = "none";
}

function showSuccess(msg) {
    const el = document.getElementById("success-msg");
    el.textContent = msg;
    el.style.display = "block";
    document.getElementById("error-msg").style.display = "none";
}

function hideMessages() {
    document.getElementById("error-msg").style.display = "none";
    document.getElementById("success-msg").style.display = "none";
}

async function readJsonBody(res) {
    const text = await res.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { error: `Server error (${res.status}). Is the API running on the same host?` };
    }
}

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    btn.disabled = loading;
    btn.querySelector(".btn-text").style.display = loading ? "none" : "inline";
    btn.querySelector(".btn-loader").style.display = loading ? "inline" : "none";
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessages();
    setLoading("login-btn", true);
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await readJsonBody(res);
        if (!res.ok) throw new Error(data.error || "Login failed.");
        localStorage.setItem("wvss_token", data.token);
        localStorage.setItem("wvss_user_id", data.userId);
        window.location.href = data.needsProfile ? "/setup" : "/dashboard";
    } catch (err) {
        showError(err.message);
    } finally {
        setLoading("login-btn", false);
    }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessages();
    const password = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;
    if (password !== confirm) { showError("Passwords do not match."); return; }
    setLoading("register-btn", true);
    const email = document.getElementById("reg-email").value;
    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await readJsonBody(res);
        if (!res.ok) throw new Error(data.error || "Registration failed.");
        localStorage.setItem("wvss_token", data.token);
        localStorage.setItem("wvss_user_id", data.userId);
        window.location.href = "/setup";
    } catch (err) {
        showError(err.message);
    } finally {
        setLoading("register-btn", false);
    }
});

(async function redirectIfLoggedIn() {
    const token = localStorage.getItem("wvss_token");
    if (!token) return;
    try {
        const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
            localStorage.removeItem("wvss_token");
            localStorage.removeItem("wvss_user_id");
            return;
        }
        const user = await res.json();
        window.location.href = user.display_name ? "/dashboard" : "/setup";
    } catch {
        localStorage.removeItem("wvss_token");
        localStorage.removeItem("wvss_user_id");
    }
})();
