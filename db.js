const { Pool } = require("pg");

const url = process.env.DATABASE_URL?.trim();
const useSsl =
    url &&
    (url.includes("sslmode=require") ||
        url.includes("neon.tech") ||
        url.includes("supabase.co"));

const pool = new Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : false
});

module.exports = pool;
