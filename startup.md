# Perseus — quick start

## 1. Open a terminal in this folder

```powershell
cd "d:\coding\Final Vulnerability Testing Project\WT"
```

## 2. Install dependencies (first time only)

```powershell
npm install
```

## 3. Configure the database

**Easiest (no Postgres):** create a `.env` file here with:

```env
DATABASE_URL=memory
JWT_SECRET=your-secret-key-at-least-32-chars
```

**Or** copy `.env.example` to `.env` and start Postgres (e.g. `docker compose up -d`), then use the `postgresql://...` URL in `.env`.

## 4. Start the server

```powershell
npm start
```

You should see: `Perseus server running on port 5000`.

## 5. Open the site

In your browser: **http://localhost:5000**

---

### Optional: one-liner without a `.env` file (PowerShell)

```powershell
cd "d:\coding\Final Vulnerability Testing Project\WT"
$env:DATABASE_URL="memory"; $env:JWT_SECRET="dev-secret-change-me"; npm start
```

### Change port

```powershell
$env:PORT="3000"; npm start
```
