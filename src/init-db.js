require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Estrutura do banco criada/verificada com sucesso.");
}

main()
  .catch((err) => {
    console.error("Falha ao criar estrutura:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
