const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "wvss-jwt-secret-change-in-production";
const JWT_EXPIRES = "7d";

router.post("/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address." });

    try {
        const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
        if (exists.rows.length > 0) return res.status(409).json({ error: "An account with this email already exists." });

        const hash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
            [email.toLowerCase(), hash]
        );
        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        res.status(201).json({ token, userId: user.id, needsProfile: true });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: "Registration failed. Please try again." });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    try {
        const result = await pool.query(
            "SELECT u.id, u.email, u.password_hash, p.display_name FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.email = $1",
            [email.toLowerCase()]
        );
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid email or password." });

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: "Invalid email or password." });

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        res.json({ token, userId: user.id, needsProfile: !user.display_name });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed. Please try again." });
    }
});

router.get("/me", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT u.id, u.email, u.created_at, p.display_name, p.organization, p.role, p.avatar_color FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1",
            [req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found." });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch user." });
    }
});

function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required." });
    try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET);
        req.userId = payload.userId;
        req.userEmail = payload.email;
        next();
    } catch {
        res.status(401).json({ error: "Invalid or expired token." });
    }
}

module.exports = router;
module.exports.requireAuth = requireAuth;
