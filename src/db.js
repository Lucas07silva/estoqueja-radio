require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Configure a URL do PostgreSQL hospedado no arquivo .env.");
}

// A URL fornecida pelo Neon/Supabase deve exigir TLS (normalmente termina com sslmode=require).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  application_name: "estoqueja-api"
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool PostgreSQL:", err.message);
});

module.exports = pool;
