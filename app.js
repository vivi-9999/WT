const FALLBACK_DATA = {
    checks: {
        missingHeaders: [
            {
                title: "Missing security header: content-security-policy",
                severity: "Medium",
                evidence: "Header not present in HTTP response.",
                recommendation: "Set a strict Content-Security-Policy header."
            },
            {
                title: "Missing security header: strict-transport-security",
                severity: "Medium",
                evidence: "Header not present in HTTP response.",
                recommendation: "Enable HSTS for HTTPS responses."
            },
            {
                title: "Missing security header: x-frame-options",
                severity: "Medium",
                evidence: "Header not present in HTTP response.",
                recommendation: "Set X-Frame-Options to DENY or SAMEORIGIN."
            },
            {
                title: "Missing security header: x-content-type-options",
                severity: "Medium",
                evidence: "Header not present in HTTP response.",
                recommendation: "Set X-Content-Type-Options to nosniff."
            },
            {
                title: "Missing security header: referrer-policy",
                severity: "Medium",
                evidence: "Header not present in HTTP response.",
                recommendation: "Set an appropriate Referrer-Policy."
            }
        ],
        robots: [
            {
                title: "robots.txt missing or inaccessible",
                severity: "Low",
                evidence: "Unable to fetch robots.txt with successful status.",
                recommendation: "Add robots.txt for crawler guidance and security hygiene."
            },
            {
                title: "sitemap.xml missing or inaccessible",
                severity: "Low",
                evidence: "Unable to fetch sitemap.xml with successful status.",
                recommendation: "Publish sitemap.xml to improve controlled indexing."
            }
        ],
        serverHeader: [
            {
                title: "Server header exposes technology",
                severity: "Low",
                evidence: "Server header shows a web server name or version.",
                recommendation: "Consider reducing server version disclosure in headers."
            }
        ],
        forms: [
            {
                title: "Forms missing autocomplete guidance",
                severity: "Low",
                evidence: "No autocomplete attributes found in form fields.",
                recommendation: "Set suitable autocomplete values for form hardening and UX."
            }
        ]
    },
    sampleReports: []
};

const STORAGE_KEY = "wvss-static-reports";
let projectData = FALLBACK_DATA;
let reports = [];
let latestReportId = null;

const elements = {
    tabs: document.querySelectorAll(".tab-button"),
    views: document.querySelectorAll(".view"),
    form: document.querySelector("#scan-form"),
    target: document.querySelector("#target"),
    scoreRing: document.querySelector("#score-ring"),
    resultTitle: document.querySelector("#result-title"),
    resultSummary: document.querySelector("#result-summary"),
    scoreBreakdown: document.querySelector("#score-breakdown"),
    findingsList: document.querySelector("#findings-list"),
    findingCount: document.querySelector("#finding-count"),
    openLatest: document.querySelector("#open-latest"),
    historyList: document.querySelector("#history-list"),
    reportDetail: document.querySelector("#report-detail"),
    clearHistory: document.querySelector("#clear-history")
};

init();

async function init() {
    projectData = await loadProjectData();
    reports = loadReports();
    bindEvents();
    renderHistory();

    if (reports.length > 0) {
        updateLatest(reports[0]);
        renderReportDetail(reports[0].id);
    }
}

async function loadProjectData() {
    try {
        const response = await fetch("data/scanner-data.json");
        if (!response.ok) {
            return FALLBACK_DATA;
        }
        return await response.json();
    } catch (error) {
        return FALLBACK_DATA;
    }
}

function bindEvents() {
    elements.tabs.forEach((tab) => {
        tab.addEventListener("click", () => switchView(tab.dataset.view));
    });

    elements.form.addEventListener("submit", (event) => {
        event.preventDefault();
        const report = runDemoScan();
        reports = [report, ...reports].slice(0, 20);
        saveReports();
        updateLatest(report);
        renderHistory();
        renderReportDetail(report.id);
    });

    elements.openLatest.addEventListener("click", () => {
        if (!latestReportId) {
            return;
        }
        switchView("reports");
        renderReportDetail(latestReportId);
    });

    elements.clearHistory.addEventListener("click", () => {
        reports = [];
        latestReportId = null;
        localStorage.removeItem(STORAGE_KEY);
        renderHistory();
        renderReportDetail(null);
        resetLatest();
    });
}

function switchView(name) {
    elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
    elements.views.forEach((view) => view.classList.toggle("active", view.id === `${name}-view`));
}

function runDemoScan() {
    const target = normalizeUrl(elements.target.value);
    const selected = [...document.querySelectorAll("input[name='issue']:checked")].map((input) => input.value);
    const findings = selected.flatMap((key) => projectData.checks[key] || []);

    if (new URL(target).protocol === "http:") {
        findings.unshift({
            title: "Target does not use HTTPS",
            severity: "High",
            evidence: "URL scheme is HTTP.",
            recommendation: "Use HTTPS to protect credentials and session traffic."
        });
    }

    const riskScore = calculateScore(findings);
    const host = new URL(target).hostname;

    return {
        id: makeId(),
        target,
        timestamp: new Date().toISOString(),
        risk_score: riskScore,
        summary: makeSummary(riskScore, findings.length),
        findings,
        integration: {
            nmap: `nmap -sV -Pn ${host}`,
            nikto: `nikto -h ${target}`,
            metasploit_hint: "msfconsole -q -x \"search type:auxiliary http; exit\"",
            note: "Manual lab use only. No automatic exploitation in this app."
        },
        meta: {
            status_code: "Demo only",
            load_error: "Static HTML version does not contact the target website."
        }
    };
}

function normalizeUrl(value) {
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return trimmed;
}

function calculateScore(findings) {
    const total = findings.reduce((score, finding) => {
        const severity = finding.severity.toLowerCase();
        if (severity === "high") {
            return score + 20;
        }
        if (severity === "medium") {
            return score + 10;
        }
        return score + 4;
    }, 0);

    return Math.min(total, 100);
}

function makeBreakdown(findings) {
    const high = findings.filter((finding) => finding.severity.toLowerCase() === "high").length;
    const medium = findings.filter((finding) => finding.severity.toLowerCase() === "medium").length;
    const low = findings.filter((finding) => finding.severity.toLowerCase() === "low").length;

    return `Breakdown: ${high} high x 20, ${medium} medium x 10, ${low} low x 4.`;
}

function makeSummary(score, count) {
    if (count === 0) {
        return "No notable findings from baseline checks.";
    }
    if (score >= 60) {
        return "High priority remediation recommended.";
    }
    if (score >= 30) {
        return "Moderate risk findings detected.";
    }
    return "Low severity hardening opportunities detected.";
}

function makeId() {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const random = Math.random().toString(16).slice(2, 8);
    return `${stamp}-${random}`;
}

function updateLatest(report) {
    latestReportId = report.id;
    const risk = riskClass(report.risk_score);
    elements.scoreRing.textContent = report.risk_score;
    elements.scoreRing.className = `score-ring ${risk}`;
    elements.resultTitle.textContent = report.target;
    elements.resultSummary.textContent = report.summary;
    elements.scoreBreakdown.textContent = makeBreakdown(report.findings);
    elements.openLatest.disabled = false;
    renderFindings(report.findings);
}

function resetLatest() {
    elements.scoreRing.textContent = "0";
    elements.scoreRing.className = "score-ring low";
    elements.resultTitle.textContent = "No scan yet";
    elements.resultSummary.textContent = "Enter a URL and run a demo scan to create a report.";
    elements.scoreBreakdown.textContent = "Score is based on selected demo findings.";
    elements.openLatest.disabled = true;
    renderFindings([]);
}

function renderFindings(findings) {
    elements.findingCount.textContent = `${findings.length} ${findings.length === 1 ? "finding" : "findings"}`;

    if (findings.length === 0) {
        elements.findingsList.className = "findings-list empty-state";
        elements.findingsList.textContent = "Run a scan to see security findings here.";
        return;
    }

    elements.findingsList.className = "findings-list";
    elements.findingsList.innerHTML = findings.map(renderFinding).join("");
}

function renderFinding(finding) {
    const severity = finding.severity.toLowerCase();
    return `
        <article class="finding-card ${severity}">
            <h3>${escapeHtml(finding.title)}</h3>
            <p><strong>Severity:</strong> ${escapeHtml(finding.severity)}</p>
            <p><strong>Evidence:</strong> ${escapeHtml(finding.evidence)}</p>
            <p><strong>Recommendation:</strong> ${escapeHtml(finding.recommendation)}</p>
        </article>
    `;
}

function renderHistory() {
    if (reports.length === 0) {
        elements.historyList.innerHTML = '<div class="empty-state">No reports saved yet. Run a demo scan first.</div>';
        return;
    }

    elements.historyList.innerHTML = reports.map((report) => `
        <article class="history-card">
            <div>
                <h3>${escapeHtml(report.target)}</h3>
                <p class="muted">${formatDate(report.timestamp)}</p>
            </div>
            <span class="risk-badge ${riskClass(report.risk_score)}">${report.risk_score}/100</span>
            <button class="ghost-button" type="button" data-report-id="${report.id}">Open</button>
        </article>
    `).join("");

    elements.historyList.querySelectorAll("[data-report-id]").forEach((button) => {
        button.addEventListener("click", () => renderReportDetail(button.dataset.reportId));
    });
}

function renderReportDetail(id) {
    const report = reports.find((item) => item.id === id);
    if (!report) {
        elements.reportDetail.innerHTML = '<p class="muted">Choose a report from the history list to view details.</p>';
        return;
    }

    elements.reportDetail.innerHTML = `
        <p class="eyebrow">Detailed Report</p>
        <h2>${escapeHtml(report.target)}</h2>
        <p><strong>Risk Score:</strong> <span class="risk-badge ${riskClass(report.risk_score)}">${report.risk_score}/100</span></p>
        <p><strong>Summary:</strong> ${escapeHtml(report.summary)}</p>
        <p><strong>Timestamp:</strong> ${formatDate(report.timestamp)}</p>
        <h3>Findings</h3>
        <div class="findings-list">${report.findings.map(renderFinding).join("") || '<div class="empty-state">No findings.</div>'}</div>
        <h3>Manual Lab Commands</h3>
        <pre class="code-box">${escapeHtml(formatIntegration(report.integration))}</pre>
    `;
}

function formatIntegration(integration) {
    return Object.entries(integration || {})
        .map(([name, command]) => `${name}: ${command}`)
        .join("\n");
}

function loadReports() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        return projectData.sampleReports || [];
    }

    try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveReports() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function riskClass(score) {
    if (score >= 70) {
        return "high";
    }
    if (score >= 40) {
        return "medium";
    }
    return "low";
}

function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
