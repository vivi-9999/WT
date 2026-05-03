const token = localStorage.getItem("wvss_token");
if (!token) window.location.href = "/";

let currentReport = null;
let allHistory = [];
let radarChart = null, sevChart = null, catChart = null;

async function api(path, opts = {}) {
    const res = await fetch(path, {
        ...opts,
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) }
    });
    if (res.status === 401) { logout(); return; }
    return res;
}

async function logout() {
    localStorage.removeItem("wvss_token");
    localStorage.removeItem("wvss_user_id");
    window.location.href = "/";
}

// ─── NAV ──────────────────────────────────────────────
document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        tab.classList.add("active");
        const view = tab.dataset.view + "-view";
        document.getElementById(view).classList.add("active");
        if (tab.dataset.view === "history") loadHistory();
        if (tab.dataset.view === "profile") loadProfile();
    });
});

// ─── USER INFO ────────────────────────────────────────
async function loadUserInfo() {
    try {
        const res = await api("/api/auth/me");
        if (!res) return;
        const user = await res.json();
        if (!user.display_name) {
            window.location.href = "/setup";
            return;
        }
        const initials = getInitials(user.display_name || user.email);
        const color = user.avatar_color || "#2563eb";
        document.getElementById("top-avatar").textContent = initials;
        document.getElementById("top-avatar").style.background = color;
        document.getElementById("top-name").textContent = user.display_name || user.email;
    } catch {}
}

function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
}

// ─── SCANNER ─────────────────────────────────────────
const steps = [1,2,3,4,5,6];
let stepTimer = null;

function startScanAnimation() {
    steps.forEach(i => {
        const el = document.getElementById(`step-${i}`);
        el.className = "scan-step";
    });
    let i = 0;
    stepTimer = setInterval(() => {
        if (i > 0) document.getElementById(`step-${i}`).className = "scan-step done";
        i++;
        if (i <= steps.length) {
            document.getElementById(`step-${i}`).className = "scan-step visible";
        }
        if (i >= steps.length) clearInterval(stepTimer);
    }, 1400);
}

document.getElementById("scan-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = document.getElementById("scan-url").value.trim();
    if (!url) return;

    document.getElementById("scan-error").style.display = "none";
    document.getElementById("scan-placeholder").style.display = "none";
    const overlay = document.getElementById("scanning-overlay");
    overlay.style.display = "block";
    overlay.classList.add("visible");
    document.getElementById("scan-btn").disabled = true;
    document.getElementById("scan-btn-text").textContent = "Scanning…";
    startScanAnimation();

    try {
        const res = await api("/api/scan", {
            method: "POST",
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Scan failed.");

        currentReport = data;
        overlay.style.display = "none";
        overlay.classList.remove("visible");
        clearInterval(stepTimer);

        document.querySelector("[data-view='results']").click();
        renderResults(data);
        loadHistory();
    } catch (err) {
        overlay.style.display = "none";
        overlay.classList.remove("visible");
        clearInterval(stepTimer);
        const errEl = document.getElementById("scan-error");
        errEl.textContent = "⚠ " + err.message;
        errEl.style.display = "block";
        document.getElementById("scan-placeholder").style.display = "block";
    } finally {
        document.getElementById("scan-btn").disabled = false;
        document.getElementById("scan-btn-text").textContent = "▶ Scan Now";
    }
});

// ─── RESULTS RENDER ──────────────────────────────────
function renderResults(report) {
    const meta = report.scan_meta || report.scanMeta || {};
    const catScores = meta.categoryScores || report.categoryScores || {};
    const findings = report.findings || [];
    const container = document.getElementById("results-container");

    const critCount = findings.filter(f => f.severity === "Critical").length;
    const highCount = findings.filter(f => f.severity === "High").length;
    const medCount = findings.filter(f => f.severity === "Medium").length;
    const lowCount = findings.filter(f => f.severity === "Low").length;
    const score = report.risk_score ?? report.riskScore ?? 0;
    const grade = report.grade || "F";
    const gradeColor = gradeToColor(grade);

    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
            <div>
                <h2 style="font-size:22px;font-weight:800">${escHtml(report.target_url || report.targetUrl || "")}</h2>
                <p style="color:#64748b;font-size:13px;margin-top:4px">Scanned ${formatDate(report.created_at || new Date())}</p>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn-dl results" onclick="downloadResults()">⬇ Download Results</button>
                <button class="btn-dl logs" onclick="downloadLogs()">📋 Download Log</button>
            </div>
        </div>

        <div class="grid-2" style="margin-bottom:20px">
            <div class="panel score-display" id="score-panel">
                <div class="score-ring-outer">
                    <svg class="score-ring-svg" width="160" height="160" viewBox="0 0 160 160">
                        <circle class="score-ring-bg" cx="80" cy="80" r="68"/>
                        <circle class="score-ring-fill" id="score-arc" cx="80" cy="80" r="68"
                            stroke="${gradeColor}"
                            stroke-dasharray="0 427"
                            style="transition:stroke-dasharray 1s ease"/>
                    </svg>
                    <div class="score-number">
                        <div class="score-val" style="color:${gradeColor}">${score}</div>
                        <div class="score-label">Risk Score</div>
                    </div>
                </div>
                <div class="grade-badge" style="background:${gradeColor}">${grade}</div>
                <div class="result-target">${escHtml(report.target_url || report.targetUrl || "")}</div>
                <div class="result-summary">${escHtml(report.summary || "")}</div>
                ${meta.ssl && !meta.ssl.error ? `
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0">
                    <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:8px">SSL CERTIFICATE</div>
                    <div class="ssl-info">
                        <div class="ssl-row"><span>Issuer</span><span>${escHtml(meta.ssl.issuer || "—")}</span></div>
                        <div class="ssl-row"><span>Protocol</span><span>${escHtml(meta.ssl.protocol || "—")}</span></div>
                        <div class="ssl-row"><span>Expires</span><span>${escHtml(meta.ssl.validTo || "—")}</span></div>
                        <div class="ssl-row"><span>Days Left</span><span style="color:${meta.ssl.daysUntilExpiry < 30 ? '#dc2626' : '#16a34a'}">${meta.ssl.daysUntilExpiry ?? "—"}</span></div>
                    </div>
                </div>` : ""}
            </div>

            <div class="panel">
                <div class="panel-title">Security Category Scores</div>
                <div class="category-bars" id="cat-bars">
                    ${renderCategoryBars(catScores)}
                </div>
                <div style="margin-top:24px">
                    <div class="stats-row" style="grid-template-columns:repeat(4,1fr)">
                        <div class="stat-card critical"><div class="stat-num">${critCount}</div><div class="stat-lbl">Critical</div></div>
                        <div class="stat-card high"><div class="stat-num">${highCount}</div><div class="stat-lbl">High</div></div>
                        <div class="stat-card medium"><div class="stat-num">${medCount}</div><div class="stat-lbl">Medium</div></div>
                        <div class="stat-card low"><div class="stat-num">${lowCount}</div><div class="stat-lbl">Low</div></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="chart-row" id="charts-row">
            <div class="chart-panel">
                <div class="chart-title">Security Posture Radar</div>
                <div class="chart-wrap"><canvas id="radar-chart"></canvas></div>
            </div>
            <div class="chart-panel">
                <div class="chart-title">Findings by Severity</div>
                <div class="chart-wrap"><canvas id="sev-chart"></canvas></div>
            </div>
            <div class="chart-panel">
                <div class="chart-title">Risk Score Breakdown</div>
                <div class="chart-wrap"><canvas id="cat-chart"></canvas></div>
            </div>
        </div>

        <div class="panel">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                <div class="panel-title" style="margin-bottom:0">Security Findings (${findings.length})</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${["All","Critical","High","Medium","Low"].map(s =>
                        `<button class="btn-sm" onclick="filterFindings('${s}',this)" ${s==="All"?"style='background:var(--blue);color:white;border-color:var(--blue)'":""}>${s}</button>`
                    ).join("")}
                </div>
            </div>
            <div id="findings-list">
                ${findings.length === 0
                    ? `<div class="empty-state"><div class="es-icon">✅</div><p>No security issues detected — excellent posture!</p></div>`
                    : findings.map(renderFinding).join("")}
            </div>
        </div>
    `;

    setTimeout(() => {
        const arc = document.getElementById("score-arc");
        if (arc) arc.setAttribute("stroke-dasharray", `${score / 100 * 427} 427`);
        renderCharts(catScores, critCount, highCount, medCount, lowCount, findings);
    }, 100);
}

function renderCategoryBars(catScores) {
    const cats = { https: "HTTPS", headers: "Headers", cookies: "Cookies", information: "Info Discl.", crawlability: "Crawlability" };
    return Object.entries(cats).map(([key, label]) => {
        const val = catScores[key] ?? 100;
        const color = val >= 80 ? "#16a34a" : val >= 50 ? "#d97706" : "#dc2626";
        return `<div class="cat-row">
            <div class="cat-name">${label}</div>
            <div class="cat-bar-wrap"><div class="cat-bar" style="width:${val}%;background:${color}"></div></div>
            <div class="cat-score">${val}</div>
        </div>`;
    }).join("");
}

function renderFinding(f) {
    return `<div class="finding-card ${escHtml(f.severity)}">
        <div class="finding-header">
            <div class="finding-title">${escHtml(f.title)}</div>
            <span class="sev-badge ${escHtml(f.severity)}">${escHtml(f.severity)}</span>
        </div>
        <div class="finding-row"><strong>Category:</strong> ${escHtml(f.category || "")}${f.cve ? `<span class="cve">${escHtml(f.cve)}</span>` : ""}</div>
        <div class="finding-evidence">${escHtml(f.evidence || "")}</div>
        <div class="finding-row"><strong>Recommendation:</strong> ${escHtml(f.recommendation || "")}</div>
    </div>`;
}

function filterFindings(severity, btn) {
    document.querySelectorAll("#findings-list .finding-card").forEach(card => {
        card.style.display = (severity === "All" || card.classList.contains(severity)) ? "block" : "none";
    });
    document.querySelectorAll(".panel-title ~ div .btn-sm").forEach(b => {
        b.removeAttribute("style");
    });
    btn.style.background = "var(--blue)";
    btn.style.color = "white";
    btn.style.borderColor = "var(--blue)";
}

// ─── CHARTS ──────────────────────────────────────────
function renderCharts(catScores, crit, high, med, low, findings) {
    if (radarChart) radarChart.destroy();
    if (sevChart) sevChart.destroy();
    if (catChart) catChart.destroy();

    const cats = { https: "HTTPS", headers: "Headers", cookies: "Cookies", information: "Info Discl.", crawlability: "Crawlability" };
    const labels = Object.values(cats);
    const values = Object.keys(cats).map(k => catScores[k] ?? 100);

    radarChart = new Chart(document.getElementById("radar-chart"), {
        type: "radar",
        data: {
            labels,
            datasets: [{
                label: "Security Score",
                data: values,
                backgroundColor: "rgba(37,99,235,0.15)",
                borderColor: "#2563eb",
                pointBackgroundColor: "#2563eb",
                pointRadius: 4,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, font: { size: 10 } }, pointLabels: { font: { size: 11, weight: "bold" } } } },
            plugins: { legend: { display: false } }
        }
    });

    sevChart = new Chart(document.getElementById("sev-chart"), {
        type: "bar",
        data: {
            labels: ["Critical", "High", "Medium", "Low"],
            datasets: [{
                data: [crit, high, med, low],
                backgroundColor: ["#7f1d1d","#dc2626","#d97706","#16a34a"],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    const catFindingCounts = {};
    findings.forEach(f => { catFindingCounts[f.category] = (catFindingCounts[f.category] || 0) + 1; });
    const catLabels = Object.keys(catFindingCounts);
    const catVals = Object.values(catFindingCounts);
    const palette = ["#2563eb","#dc2626","#d97706","#16a34a","#7c3aed","#0891b2"];

    catChart = new Chart(document.getElementById("cat-chart"), {
        type: "doughnut",
        data: {
            labels: catLabels.length ? catLabels : ["No findings"],
            datasets: [{
                data: catVals.length ? catVals : [1],
                backgroundColor: catLabels.length ? palette : ["#e2e8f0"],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: "60%",
            plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, padding: 10 } } }
        }
    });
}

// ─── HISTORY ─────────────────────────────────────────
async function loadHistory() {
    try {
        const res = await api("/api/scan/history");
        if (!res) return;
        allHistory = await res.json();
        renderHistoryTable(allHistory);
    } catch {}
}

function renderHistoryTable(rows) {
    const panel = document.getElementById("history-panel");
    if (!rows || rows.length === 0) {
        panel.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><p>No scans yet. Run your first scan to build history.</p></div>`;
        return;
    }
    panel.innerHTML = `
        <table class="history-table">
            <thead><tr>
                <th>Target URL</th>
                <th>Grade</th>
                <th>Risk Score</th>
                <th>Summary</th>
                <th>Date</th>
                <th>Actions</th>
            </tr></thead>
            <tbody>
                ${rows.map(r => `<tr>
                    <td><div class="history-target">${escHtml(r.target_url)}</div></td>
                    <td><span class="grade-pill" style="background:${gradeToColor(r.grade)}">${escHtml(r.grade)}</span></td>
                    <td><span class="risk-pill" style="background:${scoreColor(r.risk_score)}">${r.risk_score}/100</span></td>
                    <td class="history-date" style="max-width:220px">${escHtml(r.summary || "")}</td>
                    <td class="history-date">${formatDate(r.created_at)}</td>
                    <td style="white-space:nowrap">
                        <button class="btn-sm" onclick="openHistoryReport('${r.id}')">View</button>
                        <button class="btn-dl results" style="margin-left:4px" onclick="downloadReportById('${r.id}','results')">⬇ Results</button>
                        <button class="btn-dl logs" style="margin-left:4px" onclick="downloadReportById('${r.id}','log')">📋 Log</button>
                        <button class="btn-sm danger" style="margin-left:4px" onclick="deleteReport('${r.id}',this)">🗑</button>
                    </td>
                </tr>`).join("")}
            </tbody>
        </table>`;
}

function filterHistory() {
    const q = document.getElementById("history-search").value.toLowerCase();
    const g = document.getElementById("history-grade-filter").value;
    const filtered = allHistory.filter(r =>
        (!q || r.target_url.toLowerCase().includes(q)) &&
        (!g || r.grade === g)
    );
    renderHistoryTable(filtered);
}

async function openHistoryReport(id) {
    try {
        const res = await api(`/api/scan/${id}`);
        if (!res) return;
        const data = await res.json();
        if (!data.findings && data.findings !== null) data.findings = [];
        if (data.scan_meta && typeof data.scan_meta === "string") data.scan_meta = JSON.parse(data.scan_meta);
        if (data.findings && typeof data.findings === "string") data.findings = JSON.parse(data.findings);
        currentReport = data;
        document.querySelector("[data-view='results']").click();
        renderResults(data);
    } catch (err) { alert("Failed to load report."); }
}

async function deleteReport(id, btn) {
    if (!confirm("Delete this report?")) return;
    btn.disabled = true;
    try {
        await api(`/api/scan/${id}`, { method: "DELETE" });
        loadHistory();
    } catch { btn.disabled = false; }
}

async function downloadReportById(id, type) {
    try {
        const res = await api(`/api/scan/${id}`);
        if (!res) return;
        const data = await res.json();
        if (data.scan_meta && typeof data.scan_meta === "string") data.scan_meta = JSON.parse(data.scan_meta);
        if (data.findings && typeof data.findings === "string") data.findings = JSON.parse(data.findings);
        const prev = currentReport;
        currentReport = data;
        if (type === "results") await downloadResults(data);
        else downloadLogs(data);
        currentReport = prev;
    } catch { alert("Failed to load report for download."); }
}

// ─── PDF DOWNLOADS ───────────────────────────────────
async function downloadResults(report) {
    report = report || currentReport;
    if (!report) return;
    const findings = report.findings || [];
    const meta = report.scan_meta || report.scanMeta || {};
    const catScores = meta.categoryScores || report.categoryScores || {};
    const score = report.risk_score ?? report.riskScore ?? 0;
    const grade = report.grade || "F";
    const target = report.target_url || report.targetUrl || "";
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, H = 297, M = 15;

    const addHeader = (pageNum) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, W, 22, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("Perseus — Security Scan Report", M, 14);
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`Page ${pageNum}`, W - M, 14, { align: "right" });
        doc.setTextColor(0, 0, 0);
    };

    addHeader(1);
    let y = 30;

    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Target:", M, y); doc.setFont("helvetica", "normal"); doc.text(target.slice(0, 80), 40, y); y += 7;
    doc.setFont("helvetica", "bold"); doc.text("Scanned:", M, y); doc.setFont("helvetica", "normal"); doc.text(formatDate(report.created_at || new Date()), 40, y); y += 7;
    doc.setFont("helvetica", "bold"); doc.text("Grade:", M, y); doc.setFont("helvetica", "normal"); doc.text(grade, 40, y); y += 7;
    doc.setFont("helvetica", "bold"); doc.text("Risk Score:", M, y); doc.setFont("helvetica", "normal"); doc.text(`${score}/100`, 40, y); y += 7;
    doc.setFont("helvetica", "bold"); doc.text("Summary:", M, y); doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(report.summary || "", W - 55);
    doc.text(summaryLines, 40, y); y += summaryLines.length * 5 + 4;

    doc.setDrawColor(226, 232, 240); doc.line(M, y, W - M, y); y += 6;

    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("Security Category Scores", M, y); y += 6;
    const cats = { https: "HTTPS", headers: "Security Headers", cookies: "Cookie Security", information: "Information Disclosure", crawlability: "Crawlability" };
    Object.entries(cats).forEach(([key, label]) => {
        const val = catScores[key] ?? 100;
        const [r2, g2, b2] = val >= 80 ? [22,163,74] : val >= 50 ? [217,119,6] : [220,38,38];
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        doc.text(label, M, y);
        doc.setFillColor(226, 232, 240); doc.rect(60, y - 3.5, 100, 5, "F");
        doc.setFillColor(r2, g2, b2); doc.rect(60, y - 3.5, val, 5, "F");
        doc.text(`${val}/100`, 165, y); y += 7;
    });

    y += 4;
    const crit = findings.filter(f => f.severity === "Critical").length;
    const high = findings.filter(f => f.severity === "High").length;
    const med = findings.filter(f => f.severity === "Medium").length;
    const low = findings.filter(f => f.severity === "Low").length;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Findings Summary", M, y); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    [[crit, "Critical", [127,29,29]], [high, "High", [220,38,38]], [med, "Medium", [217,119,6]], [low, "Low", [22,163,74]]].forEach(([n, lbl, col]) => {
        doc.setFillColor(...col); doc.roundedRect(M + ([crit,high,med,low].indexOf(n))*40, y - 3, 36, 10, 2, 2, "F");
        doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.text(`${n} ${lbl}`, M + 18 + ([crit,high,med,low].indexOf(n))*40, y + 2.5, {align:"center"});
        doc.setTextColor(0,0,0);
    });
    y += 14;

    if (y > H - 20) { doc.addPage(); addHeader(doc.getNumberOfPages()); y = 30; }
    doc.setDrawColor(226, 232, 240); doc.line(M, y, W - M, y); y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(`Detailed Findings (${findings.length})`, M, y); y += 7;

    const sevColors = { Critical: [127,29,29], High: [220,38,38], Medium: [217,119,6], Low: [22,163,74], Info: [37,99,235] };
    findings.forEach((f, idx) => {
        const col = sevColors[f.severity] || [100,100,100];
        if (y > H - 40) { doc.addPage(); addHeader(doc.getNumberOfPages()); y = 30; }
        doc.setFillColor(...col); doc.rect(M, y - 2, 3, 14, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(0,0,0);
        doc.text(`${idx + 1}. ${f.title}`, M + 6, y + 3);
        doc.setFillColor(...col); doc.roundedRect(W - M - 22, y - 1, 22, 7, 2, 2, "F");
        doc.setTextColor(255,255,255); doc.setFontSize(7); doc.text(f.severity, W - M - 11, y + 4, {align:"center"});
        doc.setTextColor(0,0,0); y += 9;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        const evLines = doc.splitTextToSize(`Evidence: ${f.evidence}`, W - M*2 - 6);
        doc.text(evLines, M + 6, y); y += evLines.length * 4 + 2;
        const recLines = doc.splitTextToSize(`Recommendation: ${f.recommendation}`, W - M*2 - 6);
        doc.text(recLines, M + 6, y); y += recLines.length * 4 + 6;
    });

    doc.setFillColor(15,23,42); doc.rect(0, H - 10, W, 10, "F");
    doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont("helvetica","normal");
    doc.text("Generated by Perseus — For authorized security research and educational use only.", W/2, H - 3.5, {align:"center"});

    doc.save(`perseus-results-${target.replace(/[^a-z0-9]/gi,"_").slice(0,30)}-${Date.now()}.pdf`);
}

function downloadLogs(report) {
    report = report || currentReport;
    if (!report) return;
    const findings = report.findings || [];
    const meta = report.scan_meta || report.scanMeta || {};
    const catScores = meta.categoryScores || report.categoryScores || {};
    const score = report.risk_score ?? report.riskScore ?? 0;
    const target = report.target_url || report.targetUrl || "";

    const lines = [
        "═══════════════════════════════════════════════════════════════",
        "  Perseus — Website Vulnerability Scanning System",
        "  Security Scan Log",
        "═══════════════════════════════════════════════════════════════",
        "",
        `[SCAN METADATA]`,
        `Target URL    : ${target}`,
        `Scan Time     : ${formatDate(report.created_at || new Date())}`,
        `Report ID     : ${report.id || "N/A"}`,
        `Grade         : ${report.grade || "F"}`,
        `Risk Score    : ${score}/100`,
        `Summary       : ${report.summary || ""}`,
        "",
        "[SSL/TLS INFORMATION]",
        ...(meta.ssl && !meta.ssl.error ? [
            `  Certificate Subject : ${meta.ssl.subject || "N/A"}`,
            `  Issuer              : ${meta.ssl.issuer || "N/A"}`,
            `  Protocol            : ${meta.ssl.protocol || "N/A"}`,
            `  Valid From          : ${meta.ssl.validFrom || "N/A"}`,
            `  Valid To            : ${meta.ssl.validTo || "N/A"}`,
            `  Days Until Expiry   : ${meta.ssl.daysUntilExpiry ?? "N/A"}`,
            `  Cipher              : ${meta.ssl.cipher || "N/A"}`,
        ] : meta.ssl?.error ? [`  Error: ${meta.ssl.error}`] : ["  N/A (HTTP target)"]),
        "",
        "[HTTP RESPONSE METADATA]",
        `  Status Code         : ${meta.statusCode || "N/A"}`,
        `  Final URL           : ${meta.finalUrl || target}`,
        `  Server Header       : ${meta.server || "Not disclosed"}`,
        "",
        "[ROBOTS.TXT]",
        `  Found               : ${meta.robotsTxt?.found ? "Yes" : "No"}`,
        `  Status              : ${meta.robotsTxt?.status || "N/A"}`,
        "",
        "[SITEMAP.XML]",
        `  Found               : ${meta.sitemapXml?.found ? "Yes" : "No"}`,
        `  Status              : ${meta.sitemapXml?.status || "N/A"}`,
        "",
        "[CATEGORY SCORES]",
        ...Object.entries({ https:"HTTPS", headers:"Security Headers", cookies:"Cookie Security", information:"Information Disclosure", crawlability:"Crawlability" }).map(
            ([k, lbl]) => `  ${lbl.padEnd(30)} : ${catScores[k] ?? 100}/100`
        ),
        "",
        `[FINDINGS — Total: ${findings.length}]`,
        ...findings.map((f, i) => [
            ``,
            `  [${String(i+1).padStart(2,"0")}] ${f.severity.toUpperCase()} — ${f.title}`,
            `       Category       : ${f.category || "—"}`,
            f.cve ? `       CVE/CWE         : ${f.cve}` : null,
            `       Evidence        : ${f.evidence}`,
            `       Recommendation  : ${f.recommendation}`,
        ].filter(Boolean).join("\n")),
        "",
        "═══════════════════════════════════════════════════════════════",
        "  END OF LOG — For authorized security research only.",
        "═══════════════════════════════════════════════════════════════",
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `perseus-log-${target.replace(/[^a-z0-9]/gi,"_").slice(0,30)}-${Date.now()}.txt`;
    a.click();
}

// ─── PROFILE ─────────────────────────────────────────
async function loadProfile() {
    try {
        const [userRes, histRes] = await Promise.all([api("/api/auth/me"), api("/api/scan/history")]);
        if (!userRes || !histRes) return;
        const user = await userRes.json();
        const history = await histRes.json();
        const initials = getInitials(user.display_name || user.email);
        const color = user.avatar_color || "#2563eb";
        const avgScore = history.length ? Math.round(history.reduce((s,r) => s+r.risk_score, 0) / history.length) : 0;
        document.getElementById("profile-panel").innerHTML = `
            <div class="profile-card">
                <div class="profile-avatar" style="background:${color}">${initials}</div>
                <div class="profile-info">
                    <h3>${escHtml(user.display_name || "—")}</h3>
                    <div class="profile-meta">${escHtml(user.email)}</div>
                    <div class="profile-meta">${[user.role, user.organization].filter(Boolean).map(escHtml).join(" · ") || "No role/org set"}</div>
                    <div class="profile-meta" style="margin-top:4px">Member since ${formatDate(user.created_at)}</div>
                </div>
            </div>
            <div class="profile-stats">
                <div class="profile-stat"><div class="ps-num">${history.length}</div><div class="ps-lbl">Total Scans</div></div>
                <div class="profile-stat"><div class="ps-num" style="color:${scoreColor(avgScore)}">${avgScore}</div><div class="ps-lbl">Avg Risk Score</div></div>
                <div class="profile-stat"><div class="ps-num">${history.filter(r=>r.risk_score<=20).length}</div><div class="ps-lbl">Secure Sites</div></div>
            </div>`;
    } catch {}
}

// ─── UTILS ───────────────────────────────────────────
function gradeToColor(g) {
    if (!g) return "#dc2626";
    if (g.startsWith("A")) return "#16a34a";
    if (g === "B") return "#22c55e";
    if (g === "C") return "#d97706";
    if (g === "D") return "#ea580c";
    return "#dc2626";
}

function scoreColor(s) {
    if (s <= 20) return "#16a34a";
    if (s <= 40) return "#22c55e";
    if (s <= 60) return "#d97706";
    if (s <= 75) return "#ea580c";
    return "#dc2626";
}

function formatDate(d) {
    if (!d) return "—";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}

function escHtml(v) {
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

loadUserInfo();
