const express = require("express");
const router = express.Router();
const pool = require("../db");
const { scanUrl } = require("../scanner/engine");
const { requireAuth } = require("./auth");

router.post("/", requireAuth, async (req, res) => {
    const { url } = req.body;
    if (!url || url.trim().length < 4) return res.status(400).json({ error: "A valid URL is required." });

    try {
        const result = await scanUrl(url.trim());

        const saved = await pool.query(
            `INSERT INTO scan_reports (user_id, target_url, risk_score, grade, summary, findings, scan_meta)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
            [req.userId, result.targetUrl, result.riskScore, result.grade, result.summary,
             JSON.stringify(result.findings), JSON.stringify({ ...result.scanMeta, categoryScores: result.categoryScores })]
        );

        res.json({ ...result, id: saved.rows[0].id, created_at: saved.rows[0].created_at });
    } catch (err) {
        console.error("Scan error:", err);
        res.status(500).json({ error: "Scan failed: " + err.message });
    }
});

router.get("/history", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, target_url, risk_score, grade, summary, created_at
             FROM scan_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history." });
    }
});

router.get("/:id", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM scan_reports WHERE id = $1 AND user_id = $2",
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Report not found." });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch report." });
    }
});

router.delete("/:id", requireAuth, async (req, res) => {
    try {
        await pool.query("DELETE FROM scan_reports WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete report." });
    }
});

module.exports = router;
