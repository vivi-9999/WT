const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("./auth");

router.post("/", requireAuth, async (req, res) => {
    const displayName = (req.body.display_name || req.body.displayName || "").trim();
    const organization = (req.body.organization || "").trim();
    const role = (req.body.role || "").trim();
    const avatarColor = req.body.avatar_color || req.body.avatarColor || "#2563eb";

    if (!displayName || displayName.length < 2) {
        return res.status(400).json({ error: "Display name must be at least 2 characters." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO profiles (user_id, display_name, organization, role, avatar_color)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET display_name=$2, organization=$3, role=$4, avatar_color=$5, updated_at=NOW()
             RETURNING *`,
            [req.userId, displayName, organization || null, role || null, avatarColor]
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
