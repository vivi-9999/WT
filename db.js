const { Pool } = require("pg");
const { newDb, DataType } = require("pg-mem");
const { randomUUID } = require("crypto");

function createMemoryPool() {
    const mem = newDb();
    mem.public.registerFunction({
        name: "gen_random_uuid",
        args: [],
        returns: DataType.uuid,
        implementation: () => randomUUID()
    });
    const { Pool: MemPool } = mem.adapters.createPg();
    return new MemPool();
}

const url = process.env.DATABASE_URL?.trim();
const useSsl =
    url &&
    (url.includes("sslmode=require") ||
        url.includes("neon.tech") ||
        url.includes("supabase.co"));

let pool = null;
if (!url || url.toLowerCase() === "memory") {
    pool = createMemoryPool();
} else if (url) {
    pool = new Pool({
        connectionString: url,
        ssl: useSsl ? { rejectUnauthorized: false } : false
    });
}

module.exports = pool;
