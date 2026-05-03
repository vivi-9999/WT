const token = localStorage.getItem("wvss_token");
if (!token) window.location.href = "/";

let selectedColor = "#2563eb";

document.querySelectorAll(".color-swatch").forEach(swatch => {
    swatch.addEventListener("click", () => {
        document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
        swatch.classList.add("active");
        selectedColor = swatch.dataset.color;
        document.getElementById("avatar-preview").style.background = selectedColor;
        updateInitials();
    });
});

document.getElementById("display-name").addEventListener("input", updateInitials);

function updateInitials() {
    const name = document.getElementById("display-name").value.trim();
    const parts = name.split(" ").filter(Boolean);
    const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (parts[0] || "?")[0].toUpperCase();
    document.getElementById("avatar-initials").textContent = initials;
}

function showError(msg) {
    const el = document.getElementById("error-msg");
    el.textContent = msg;
    el.style.display = "block";
}

document.getElementById("setup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("setup-btn");
    btn.disabled = true;
    btn.querySelector(".btn-text").style.display = "none";
    btn.querySelector(".btn-loader").style.display = "inline";
    document.getElementById("error-msg").style.display = "none";

    const display_name = document.getElementById("display-name").value.trim();
    const organization = document.getElementById("organization").value.trim();
    const role = document.getElementById("role").value;

    try {
        const res = await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ display_name, organization, role, avatar_color: selectedColor })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save profile.");
        window.location.href = "/dashboard";
    } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.querySelector(".btn-text").style.display = "inline";
        btn.querySelector(".btn-loader").style.display = "none";
    }
});
