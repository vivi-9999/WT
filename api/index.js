require("dotenv").config();

const pool = require("../db");
const { migrate } = require("../db/migrate");
const express = require("express");

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
app.use("/api/auth", require("../routes/auth"));
app.use("/api/profile", require("../routes/profile"));
app.use("/api/scan", require("../routes/scan"));

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Perseus] Express Error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Migrate once at startup
let migrationPromise = null;
async function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = migrate(pool)
      .then(() => {
        console.log("[Perseus] Database migration completed");
      })
      .catch(err => {
        console.error("[Perseus] Database migration failed:", err.message);
        throw err;
      });
  }
  return migrationPromise;
}

module.exports = async (req, res) => {
  try {
    // Ensure database is migrated
    await ensureMigrated();
    
    // Handle the request with Express app
    return app(req, res);
  } catch (err) {
    console.error("[Perseus] Handler Error:", err);
    return res.status(500).json({ 
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
