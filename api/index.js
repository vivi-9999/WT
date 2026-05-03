require("dotenv").config();

const pool = require("../db");
const { migrate } = require("../db/migrate");

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

module.exports = async (req, res) => {
  try {
    // Ensure database is migrated
    await ensureMigrated();

    // Route handling
    const { method, url } = req;
    
    // Health check
    if (method === 'GET' && url === '/health') {
      return res.json({ status: "ok", timestamp: new Date().toISOString() });
    }

    // Route to appropriate handler
    if (url.startsWith('/api/auth')) {
      const authHandler = require("../routes/auth");
      return authHandler(req, res);
    }
    if (url.startsWith('/api/profile')) {
      const profileHandler = require("../routes/profile");
      return profileHandler(req, res);
    }
    if (url.startsWith('/api/scan')) {
      const scanHandler = require("../routes/scan");
      return scanHandler(req, res);
    }

    // 404 for unknown routes
    return res.status(404).json({ error: "Route not found" });

  } catch (err) {
    console.error("[Perseus] API Error:", err);
    return res.status(500).json({ 
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
