require("dotenv").config();

const pool = require("../db");
const { migrate } = require("../db/migrate");
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("../routes/auth"));
app.use("/api/profile", require("../routes/profile"));
app.use("/api/scan", require("../routes/scan"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = async (req, res) => {
  // Ensure database is migrated
  try {
    await migrate(pool);
  } catch (err) {
    console.error("[Perseus] Database migration failed:", err.message);
    return res.status(500).json({ error: "Database migration failed" });
  }

  return app(req, res);
};
