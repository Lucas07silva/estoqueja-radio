require("dotenv").config();
const readline = require("readline");
const bcrypt = require("bcrypt");
const pool = require("./db");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  const username = (await ask("Login do administrador: ")).trim();
  const fullName = (await ask("Nome completo: ")).trim();
  const password = await ask("Senha (mínimo 10 caracteres): ");
  if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username)) throw new Error("Login inválido. Use 3-60 caracteres: letras, números, ponto, _ ou -.");
  if (!fullName) throw new Error("O nome é obrigatório.");
  if (password.length < 10) throw new Error("A senha precisa ter pelo menos 10 caracteres.");
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO app_users (username, full_name, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [username, fullName, passwordHash]
  );
  console.log("Usuário criado, caso o login ainda não existisse. Se já existia, nenhum dado foi alterado.");
}

main().catch((err) => {
  console.error("Não foi possível criar o usuário:", err.message);
  process.exitCode = 1;
}).finally(() => {
  rl.close();
  pool.end();
});
