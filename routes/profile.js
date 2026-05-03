const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("./auth");

router.post("/", requireAuth, async (req, res) => {
    const { display_name, organization, role, avatar_color } = req.body;
    if (!display_name || display_name.trim().length < 2) return res.status(400).json({ error: "Display name must be at least 2 characters." });

    try {
        const result = await pool.query(
            `INSERT INTO profiles (user_id, display_name, organization, role, avatar_color)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET display_name=$2, organization=$3, role=$4, avatar_color=$5, updated_at=NOW()
             RETURNING *`,
            [req.userId, display_name.trim(), organization || null, role || null, avatar_color || "#2563eb"]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Profile save error:", err);
        res.status(500).json({ error: "Failed to save profile." });
    }
});

router.get("/", requireAuth, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM profiles WHERE user_id = $1", [req.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Profile not found." });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch profile." });
    }
});

module.exports = router;
