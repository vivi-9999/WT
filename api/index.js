require("dotenv").config();

const pool = require("../db");
const { migrate } = require("../db/migrate");
const express = require("express");

const app = express();
app.use(express.json());

// Migrate once at startup
let migrated = false;
async function ensureMigrated() {
  if (!migrated) {
    try {
      await migrate(pool);
      migrated = true;
      console.log("[Perseus] Database migration completed");
    } catch (err) {
      console.error("[Perseus] Database migration failed:", err.message);
      throw err;
    }
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
app.use("/api/auth", require("../routes/auth"));
app.use("/api/profile", require("../routes/profile"));
app.use("/api/scan", require("../routes/scan"));

module.exports = async (req, res) => {
  try {
    // Ensure database is migrated
    await ensureMigrated();
    
    // Handle the request with Express app
    return app(req, res);
  } catch (err) {
    console.error("[Perseus] API Error:", err);
    return res.status(500).json({ 
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
