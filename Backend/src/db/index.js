import pg from "pg";

const { Pool } = pg;

function databaseUrl() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL is required");
    }

    const parsed = new URL(url);
    parsed.searchParams.set("sslmode", "require");
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
}

function poolConfig() {
    const connectionString = databaseUrl();
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

    return {
        connectionString,
        ssl: isLocal ? false : { rejectUnauthorized: false },
    };
}

const pool = new Pool(poolConfig());

export async function query(text, params) {
    return pool.query(text, params);
}

export async function connectDB() {
    const client = await pool.connect();
    try {
        await client.query("SELECT 1");
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password TEXT NOT NULL,
                refresh_token TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        const host = new URL(databaseUrl()).hostname;
        console.log(`PostgreSQL connected (${host})`);
    } finally {
        client.release();
    }
}

export { pool };
