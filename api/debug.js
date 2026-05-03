require("dotenv").config();

module.exports = async (req, res) => {
  try {
    console.log("=== DEBUG REQUEST ===");
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
    console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
    
    // Test database connection
    const pool = require("../db");
    console.log("Pool created:", !!pool);
    
    const result = await pool.query("SELECT NOW()");
    console.log("DB Test Success:", result.rows[0]);
    
    res.json({ 
      status: "debug-success", 
      timestamp: new Date().toISOString(),
      dbTest: result.rows[0]
    });
    
  } catch (err) {
    console.error("=== DEBUG ERROR ===");
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);
    
    res.status(500).json({ 
      error: "debug-error",
      message: err.message,
      stack: err.stack
    });
  }
};
