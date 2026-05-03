/**
 * Ensures application tables exist. Safe to run on every server start (idempotent).
 */
async function migrate(pool) {
    const client = await pool.connect();
    try {
        const memory =
            process.env.DATABASE_URL?.trim().toLowerCase() === "memory";
        if (!memory) {
            await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
        }

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS profiles (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                display_name TEXT NOT NULL,
                organization TEXT,
                role TEXT,
                avatar_color TEXT DEFAULT '#2563eb',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS scan_reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                target_url TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                grade TEXT NOT NULL,
                summary TEXT,
                findings JSONB,
                scan_meta JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(
            `CREATE INDEX IF NOT EXISTS scan_reports_user_created_idx ON scan_reports (user_id, created_at DESC)`
        );
    } finally {
        client.release();
    }
}

module.exports = { migrate };
