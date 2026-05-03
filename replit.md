# WVSS — Website Vulnerability Scanning System

## Architecture

**Full-stack Node.js application** with PostgreSQL database.

- **Backend:** Express.js (`server.js`) on port 5000
- **Database:** Replit PostgreSQL (`pg` driver, `DATABASE_URL` env var)
- **Auth:** JWT tokens (`jsonwebtoken`) with bcrypt password hashing
- **Scanner:** Real HTTP/HTTPS analysis via `axios` + Node.js `tls` module
- **Frontend:** Vanilla HTML/CSS/JS (no framework) served by Express

## File Structure

```
server.js               — Express server (port 5000, serves API + static files)
db.js                   — PostgreSQL connection pool
routes/
  auth.js               — POST /api/auth/register, /login, GET /api/auth/me
  profile.js            — POST/GET /api/profile
  scan.js               — POST /api/scan, GET /api/scan/history, /api/scan/:id
scanner/
  engine.js             — Real security scanning logic (headers, SSL, cookies, etc.)
public/
  index.html            — Login/signup page
  setup.html            — Profile builder (first login)
  dashboard.html        — Main app (scanner, results, history, profile tabs)
  css/auth.css          — Auth page styles
  css/app.css           — Dashboard styles
  js/auth.js            — Login/register logic
  js/setup.js           — Profile setup logic
  js/app.js             — Main app (scanner, charts, PDF export, history)
```

## Database Schema

- `users` — email, password_hash, UUID primary key
- `profiles` — display_name, organization, role, avatar_color (linked to user)
- `scan_reports` — target_url, risk_score, grade, findings (JSONB), scan_meta (JSONB)

## Scanner Checks

Real HTTP analysis — checks:
1. HTTPS enforcement & SSL certificate validity/expiry
2. Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
3. Cookie security flags: Secure, HttpOnly, SameSite
4. Information disclosure: Server header, X-Powered-By
5. CORS configuration (wildcard check)
6. robots.txt and sitemap.xml accessibility

## Features

- **Auth:** JWT-based login/register with profile building on first sign-up
- **Per-user history:** All scans stored per user in PostgreSQL
- **Charts:** Chart.js — Radar (security posture), Bar (severity), Doughnut (categories)
- **PDF export:** Two buttons — "Download Results" (PDF with charts+findings) and "Download Log" (plain text log)
- **History tab:** Searchable/filterable, per-row download buttons

## CDN Dependencies (frontend only)

- Chart.js 4.4.0 (charts)
- jsPDF 2.5.1 (PDF generation)
- html2canvas 1.4.1 (screenshot for PDF)
