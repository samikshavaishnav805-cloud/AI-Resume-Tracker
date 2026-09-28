const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function connectDB() {
    const client = await pool.connect();

    try {
        await client.query("SELECT NOW()");
        console.log("Supabase PostgreSQL connected");
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    connectDB,
};