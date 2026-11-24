require("dotenv").config();
const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const helmet = require("helmet");
const path = require("path");
const pool = require("./db");
const { requireAuth } = require("./middleware/auth");

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET ausente ou muito curta. Configure uma chave aleatória com pelo menos 32 caracteres no .env.");
}

const app = express();
const port = Number(process.env.PORT) || 3000;

// Render termina o HTTPS no proxy e encaminha a requisição para este processo.
// Confiar no primeiro proxy permite que express-session reconheça HTTPS e envie
// cookies Secure quando COOKIE_SECURE=true no ambiente de produção.
app.set("trust proxy", 1);

// Segurança básica dos cabeçalhos HTTP. A política CSP fica desativada neste MVP porque
// a interface usa estilos e scripts locais com algumas dependências externas do Google Fonts.
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));

// A API recebe e valida JSON; os limites evitam corpos de requisição excessivamente grandes.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

// Sessões persistidas no próprio PostgreSQL, compartilhadas entre as instâncias da API.
app.use(session({
  name: "estoque.sid",
  store: new pgSession({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: String(process.env.COOKIE_SECURE).toLowerCase() === "true",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// Rotas públicas de autenticação; as demais rotas de negócio exigem sessão válida.
app.use("/api/auth", require("./routes/auth"));
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.use("/api/dashboard", requireAuth, require("./routes/dashboard"));
app.use("/api/categorias", requireAuth, require("./routes/categories"));
app.use("/api/produtos", requireAuth, require("./routes/products"));
app.use("/api/movimentacoes", requireAuth, require("./routes/movements"));

// Responde com JSON para caminhos de API inexistentes, evitando entregar o HTML da interface.
app.use("/api", (req, res) => res.status(404).json({ error: "Rota da API não encontrada." }));

// Arquivos estáticos da interface web.
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));

// Tratamento centralizado: detalhes técnicos ficam no terminal, não são expostos ao navegador.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Erro interno do servidor. Consulte os logs da aplicação." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`EstoqueJá disponível na porta ${port}.`);
  console.log(`No computador local: http://localhost:${port}`);
});
