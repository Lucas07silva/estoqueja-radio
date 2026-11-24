const express = require("express");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const router = express.Router();

// GET /api/categorias - lista categorias e quantidade de produtos vinculados.
router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
             COUNT(i.id)::int AS products_count
      FROM categories c LEFT JOIN items i ON i.category_id = c.id AND i.active = TRUE
      GROUP BY c.id ORDER BY c.name`);
    res.json({ categorias: result.rows });
  } catch (err) { next(err); }
});

// GET /api/categorias/:id - consulta uma categoria específica.
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID de categoria inválido." });
    const result = await pool.query(`
      SELECT c.id, c.name, c.description, c.created_at, c.updated_at,
             COUNT(i.id)::int AS products_count
      FROM categories c LEFT JOIN items i ON i.category_id = c.id AND i.active = TRUE
      WHERE c.id = $1 GROUP BY c.id`, [id]);
    if (!result.rowCount) return res.status(404).json({ error: "Categoria não encontrada." });
    res.json({ categoria: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/categorias - cria uma categoria.
router.post("/", requireRole("admin", "operador"), async (req, res, next) => {
  try {
    const name = String(req.body.name || req.body.nome || "").trim();
    const description = String(req.body.description || req.body.descricao || "").trim() || null;
    if (!name || name.length > 100) return res.status(400).json({ error: "Informe um nome de categoria com até 100 caracteres." });
    const result = await pool.query(
      "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at, updated_at",
      [name, description]
    );
    res.status(201).json({ mensagem: "Categoria criada com sucesso.", categoria: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Já existe uma categoria com esse nome." });
    next(err);
  }
});

// PUT /api/categorias/:id - atualiza os dados da categoria.
router.put("/:id", requireRole("admin", "operador"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || req.body.nome || "").trim();
    const description = String(req.body.description || req.body.descricao || "").trim() || null;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID de categoria inválido." });
    if (!name || name.length > 100) return res.status(400).json({ error: "Informe um nome de categoria com até 100 caracteres." });
    const result = await pool.query(
      "UPDATE categories SET name = $2, description = $3, updated_at = NOW() WHERE id = $1 RETURNING id, name, description, created_at, updated_at",
      [id, name, description]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Categoria não encontrada." });
    res.json({ mensagem: "Categoria atualizada com sucesso.", categoria: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Já existe outra categoria com esse nome." });
    next(err);
  }
});

// DELETE /api/categorias/:id - impede apagar categorias ainda utilizadas.
router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID de categoria inválido." });
    const result = await pool.query("DELETE FROM categories WHERE id = $1 RETURNING id, name", [id]);
    if (!result.rowCount) return res.status(404).json({ error: "Categoria não encontrada." });
    res.json({ mensagem: "Categoria excluída com sucesso.", categoria: result.rows[0] });
  } catch (err) {
    if (err.code === "23503") return res.status(409).json({ error: "Não é possível excluir uma categoria que possui produtos vinculados." });
    next(err);
  }
});

module.exports = router;
