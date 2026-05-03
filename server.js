require("dotenv").config();

const pool = require("./db");

const { migrate } = require("./db/migrate");
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/scan", require("./routes/scan"));

app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/setup", (req, res) => res.sendFile(path.join(__dirname, "public", "setup.html")));
app.get("/{*path}", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function start() {
    try {
        await migrate(pool);
    } catch (err) {
        console.error("[Perseus] Database migration failed:", err.message);
        process.exit(1);
    }
    const configuredDb = process.env.DATABASE_URL?.trim().toLowerCase();
    const dbMode =
        !configuredDb || configuredDb === "memory"
            ? "in-memory (default fallback; data is lost on restart)"
            : "PostgreSQL";
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Perseus server running on port ${PORT} (database: ${dbMode})`);
    });
}

start();
