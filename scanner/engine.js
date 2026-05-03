const axios = require("axios");
const https = require("https");
const tls = require("tls");
const { URL } = require("url");

const TIMEOUT = 12000;

async function scanUrl(targetUrl) {
    const normalizedUrl = normalizeUrl(targetUrl);
    const parsed = new URL(normalizedUrl);
    const isHttps = parsed.protocol === "https:";
    const hostname = parsed.hostname;

    const findings = [];
    const scanMeta = { hostname, protocol: parsed.protocol, scanTime: new Date().toISOString() };
    const categoryScores = { https: 100, headers: 100, cookies: 100, information: 100, crawlability: 100 };

    let response = null;
    let httpResponse = null;
    let httpError = null;

    try {
        response = await axios.get(normalizedUrl, {
            timeout: TIMEOUT,
            maxRedirects: 5,
            validateStatus: () => true,
            headers: { "User-Agent": "VulnScanner/1.0 (Educational)" },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        scanMeta.statusCode = response.status;
        scanMeta.finalUrl = response.request?.res?.responseUrl || normalizedUrl;
        scanMeta.server = response.headers["server"] || null;
    } catch (err) {
        scanMeta.fetchError = err.message;
    }

    if (isHttps) {
        try {
            httpResponse = await axios.get(normalizedUrl.replace("https://", "http://"), {
                timeout: 5000,
                maxRedirects: 0,
                validateStatus: () => true,
                headers: { "User-Agent": "VulnScanner/1.0 (Educational)" }
            });
        } catch (e) {
            httpError = e.message;
        }
    }

    if (!isHttps) {
        findings.push({
            category: "HTTPS",
            severity: "Critical",
            title: "Site does not use HTTPS",
            evidence: `Protocol is ${parsed.protocol}`,
            recommendation: "Serve your site over HTTPS to protect users from eavesdropping and man-in-the-middle attacks.",
            cve: null
        });
        categoryScores.https = 0;
    } else {
        const sslInfo = await checkSsl(hostname, parsed.port || 443);
        scanMeta.ssl = sslInfo;
        if (sslInfo.error) {
            findings.push({ category: "HTTPS", severity: "High", title: "SSL/TLS certificate issue", evidence: sslInfo.error, recommendation: "Ensure your SSL certificate is valid and trusted.", cve: null });
            categoryScores.https -= 40;
        } else if (sslInfo.daysUntilExpiry !== null && sslInfo.daysUntilExpiry < 30) {
            findings.push({ category: "HTTPS", severity: "Medium", title: "SSL certificate expiring soon", evidence: `Certificate expires in ${sslInfo.daysUntilExpiry} days`, recommendation: "Renew your SSL certificate before it expires.", cve: null });
            categoryScores.https -= 20;
        }
        if (httpResponse && httpResponse.status < 400 && !(httpResponse.headers["location"] || "").startsWith("https")) {
            findings.push({ category: "HTTPS", severity: "High", title: "HTTP does not redirect to HTTPS", evidence: `HTTP version returns status ${httpResponse.status} without HTTPS redirect`, recommendation: "Configure your server to redirect all HTTP traffic to HTTPS (301 redirect).", cve: null });
            categoryScores.https -= 30;
        }
    }

    if (response) {
        const headers = response.headers;

        const headerChecks = [
            {
                header: "content-security-policy",
                title: "Missing Content-Security-Policy header",
                severity: "High",
                rec: "Set a strict Content-Security-Policy to prevent XSS and data injection attacks.",
                cat: "headers",
                penalty: 20,
                cve: "CWE-79"
            },
            {
                header: "strict-transport-security",
                title: "Missing Strict-Transport-Security (HSTS) header",
                severity: "High",
                rec: "Add HSTS with a max-age of at least 31536000 to enforce HTTPS connections.",
                cat: "headers",
                penalty: 15,
                cve: "CWE-319"
            },
            {
                header: "x-frame-options",
                title: "Missing X-Frame-Options header (Clickjacking risk)",
                severity: "Medium",
                rec: "Set X-Frame-Options to DENY or SAMEORIGIN to prevent clickjacking attacks.",
                cat: "headers",
                penalty: 10,
                cve: "CWE-1021"
            },
            {
                header: "x-content-type-options",
                title: "Missing X-Content-Type-Options header",
                severity: "Medium",
                rec: "Set X-Content-Type-Options to 'nosniff' to prevent MIME-type sniffing.",
                cat: "headers",
                penalty: 8,
                cve: "CWE-430"
            },
            {
                header: "referrer-policy",
                title: "Missing Referrer-Policy header",
                severity: "Low",
                rec: "Set Referrer-Policy to control how much referrer information is shared.",
                cat: "headers",
                penalty: 5,
                cve: null
            },
            {
                header: "permissions-policy",
                title: "Missing Permissions-Policy header",
                severity: "Low",
                rec: "Set Permissions-Policy to restrict access to browser features.",
                cat: "headers",
                penalty: 5,
                cve: null
            }
        ];

        for (const check of headerChecks) {
            if (!headers[check.header]) {
                findings.push({ category: "Security Headers", severity: check.severity, title: check.title, evidence: `Header '${check.header}' not present in HTTP response.`, recommendation: check.rec, cve: check.cve });
                categoryScores.headers -= check.penalty;
            } else {
                if (check.header === "strict-transport-security") {
                    const hsts = headers[check.header];
                    const maxAgeMatch = hsts.match(/max-age=(\d+)/i);
                    if (maxAgeMatch && parseInt(maxAgeMatch[1]) < 31536000) {
                        findings.push({ category: "Security Headers", severity: "Low", title: "HSTS max-age is too short", evidence: `max-age=${maxAgeMatch[1]} (recommended: 31536000+)`, recommendation: "Set HSTS max-age to at least 1 year (31536000 seconds).", cve: null });
                        categoryScores.headers -= 3;
                    }
                }
                if (check.header === "content-security-policy") {
                    const csp = headers[check.header];
                    if (csp.includes("unsafe-inline") || csp.includes("unsafe-eval")) {
                        findings.push({ category: "Security Headers", severity: "Medium", title: "Content-Security-Policy allows unsafe directives", evidence: `CSP contains: ${csp.includes("unsafe-inline") ? "'unsafe-inline'" : ""} ${csp.includes("unsafe-eval") ? "'unsafe-eval'" : ""}`.trim(), recommendation: "Remove 'unsafe-inline' and 'unsafe-eval' from your CSP and use nonces or hashes instead.", cve: "CWE-79" });
                        categoryScores.headers -= 8;
                    }
                }
            }
        }

        if (headers["server"]) {
            const serverVal = headers["server"];
            if (/\d/.test(serverVal) || /apache|nginx|iis|lighttpd|tomcat/i.test(serverVal)) {
                findings.push({ category: "Information Disclosure", severity: "Low", title: "Server header discloses technology and version", evidence: `Server: ${serverVal}`, recommendation: "Configure your server to hide or generalize the Server header to avoid fingerprinting.", cve: "CWE-200" });
                categoryScores.information -= 15;
            }
        }

        if (headers["x-powered-by"]) {
            findings.push({ category: "Information Disclosure", severity: "Low", title: "X-Powered-By header exposes framework information", evidence: `X-Powered-By: ${headers["x-powered-by"]}`, recommendation: "Remove the X-Powered-By header to prevent technology fingerprinting.", cve: "CWE-200" });
            categoryScores.information -= 10;
        }

        const setCookieHeaders = response.headers["set-cookie"] || [];
        if (setCookieHeaders.length > 0) {
            const cookieIssues = analyzeCookies(setCookieHeaders);
            findings.push(...cookieIssues);
            if (cookieIssues.some(f => f.severity === "High")) categoryScores.cookies -= 30;
            else if (cookieIssues.some(f => f.severity === "Medium")) categoryScores.cookies -= 15;
            else if (cookieIssues.length > 0) categoryScores.cookies -= 5;
        }

        const cors = headers["access-control-allow-origin"];
        if (cors === "*") {
            findings.push({ category: "Configuration", severity: "Medium", title: "Wildcard CORS policy (Access-Control-Allow-Origin: *)", evidence: "CORS allows any origin to make requests", recommendation: "Restrict CORS to specific trusted origins rather than allowing all origins.", cve: "CWE-942" });
            categoryScores.information -= 10;
        }
    }

    const robotsResult = await checkResource(normalizedUrl, "/robots.txt");
    const sitemapResult = await checkResource(normalizedUrl, "/sitemap.xml");
    scanMeta.robotsTxt = robotsResult;
    scanMeta.sitemapXml = sitemapResult;

    if (!robotsResult.found) {
        findings.push({ category: "Crawlability", severity: "Low", title: "robots.txt missing or inaccessible", evidence: `GET ${robotsResult.url} → ${robotsResult.status || "error"}`, recommendation: "Add a robots.txt file to guide search engine crawlers and protect sensitive paths.", cve: null });
        categoryScores.crawlability -= 10;
    }
    if (!sitemapResult.found) {
        findings.push({ category: "Crawlability", severity: "Low", title: "sitemap.xml missing or inaccessible", evidence: `GET ${sitemapResult.url} → ${sitemapResult.status || "error"}`, recommendation: "Publish a sitemap.xml to improve controlled indexing and SEO.", cve: null });
        categoryScores.crawlability -= 10;
    }

    for (const key of Object.keys(categoryScores)) {
        categoryScores[key] = Math.max(0, categoryScores[key]);
    }

    const riskScore = computeRiskScore(findings);
    const grade = computeGrade(riskScore);

    return {
        targetUrl: normalizedUrl,
        riskScore,
        grade,
        summary: makeSummary(riskScore, findings),
        findings,
        categoryScores,
        scanMeta
    };
}

function analyzeCookies(setCookieHeaders) {
    const issues = [];
    for (const cookie of setCookieHeaders) {
        const name = cookie.split("=")[0].trim();
        const lower = cookie.toLowerCase();
        const isSession = /session|token|auth|jwt|sid/i.test(name);

        if (!lower.includes("secure")) {
            issues.push({ category: "Cookie Security", severity: isSession ? "High" : "Medium", title: `Cookie '${name}' missing Secure flag`, evidence: `Set-Cookie: ${cookie.slice(0, 80)}...`, recommendation: `Set the Secure flag on cookie '${name}' to prevent transmission over HTTP.`, cve: "CWE-614" });
        }
        if (!lower.includes("httponly") && isSession) {
            issues.push({ category: "Cookie Security", severity: "High", title: `Session cookie '${name}' missing HttpOnly flag`, evidence: `Set-Cookie: ${cookie.slice(0, 80)}...`, recommendation: `Set the HttpOnly flag on '${name}' to prevent JavaScript access to session cookies.`, cve: "CWE-1004" });
        }
        if (!lower.includes("samesite")) {
            issues.push({ category: "Cookie Security", severity: "Medium", title: `Cookie '${name}' missing SameSite attribute`, evidence: `Set-Cookie: ${cookie.slice(0, 80)}...`, recommendation: `Set SameSite=Strict or SameSite=Lax on '${name}' to protect against CSRF attacks.`, cve: "CWE-352" });
        }
    }
    return issues;
}

async function checkResource(baseUrl, path) {
    const parsed = new URL(baseUrl);
    const url = `${parsed.protocol}//${parsed.hostname}${parsed.port && !["80","443"].includes(parsed.port) ? `:${parsed.port}` : ""}${path}`;
    try {
        const res = await axios.get(url, {
            timeout: 6000,
            validateStatus: () => true,
            headers: { "User-Agent": "VulnScanner/1.0 (Educational)" },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        return { url, found: res.status === 200, status: res.status };
    } catch (e) {
        return { url, found: false, status: null, error: e.message };
    }
}

async function checkSsl(hostname, port) {
    return new Promise((resolve) => {
        try {
            const socket = tls.connect({ host: hostname, port: parseInt(port) || 443, servername: hostname, rejectUnauthorized: false, timeout: 6000 }, () => {
                try {
                    const cert = socket.getPeerCertificate();
                    const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
                    const daysUntilExpiry = validTo ? Math.floor((validTo - Date.now()) / 86400000) : null;
                    resolve({ valid: socket.authorized, subject: cert.subject?.CN || null, issuer: cert.issuer?.O || null, validFrom: cert.valid_from, validTo: cert.valid_to, daysUntilExpiry, protocol: socket.getProtocol(), cipher: socket.getCipher()?.name });
                } catch (e) {
                    resolve({ error: e.message });
                } finally {
                    socket.destroy();
                }
            });
            socket.on("error", (e) => resolve({ error: e.message }));
            socket.setTimeout(6000, () => { socket.destroy(); resolve({ error: "timeout" }); });
        } catch (e) {
            resolve({ error: e.message });
        }
    });
}

function computeRiskScore(findings) {
    const weights = { Critical: 25, High: 15, Medium: 8, Low: 3, Info: 1 };
    const total = findings.reduce((sum, f) => sum + (weights[f.severity] || 0), 0);
    return Math.min(100, total);
}

function computeGrade(score) {
    if (score <= 10) return "A+";
    if (score <= 20) return "A";
    if (score <= 35) return "B";
    if (score <= 50) return "C";
    if (score <= 65) return "D";
    return "F";
}

function makeSummary(score, findings) {
    const critical = findings.filter(f => f.severity === "Critical").length;
    const high = findings.filter(f => f.severity === "High").length;
    if (critical > 0) return `Critical vulnerabilities detected — immediate remediation required.`;
    if (score <= 20) return `Strong security posture with minor hardening opportunities.`;
    if (score <= 40) return `Good security baseline with some medium-priority improvements needed.`;
    if (score <= 60) return `Moderate risk — ${high} high-severity finding${high !== 1 ? "s" : ""} require attention.`;
    return `High risk profile — multiple significant vulnerabilities detected.`;
}

function normalizeUrl(value) {
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
}

module.exports = { scanUrl };
