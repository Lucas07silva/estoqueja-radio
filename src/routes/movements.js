const express = require("express");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const router = express.Router();

// GET /api/movimentacoes - lista o histórico, com filtros opcionais por produto e tipo.
router.get("/", async (req, res, next) => {
  try {
    const productId = req.query.produto ? Number(req.query.produto) : null;
    const type = String(req.query.tipo || "");
    if (productId !== null && (!Number.isInteger(productId) || productId <= 0)) {
      return res.status(400).json({ error: "Parâmetro produto inválido." });
    }
    if (type && !["entrada", "saida", "ajuste"].includes(type)) {
      return res.status(400).json({ error: "Tipo de movimentação inválido." });
    }
    const result = await pool.query(`
      SELECT m.id, m.item_id AS produto_id, i.code AS codigo, i.name AS produto,
             m.movement_type AS tipo, m.quantity AS quantidade,
             m.previous_quantity AS saldo_anterior, m.new_quantity AS saldo_atual,
             m.reason AS motivo, m.responsible AS responsavel, m.created_at AS data,
             u.full_name AS usuario,
             m.movement_type, m.quantity, m.previous_quantity, m.new_quantity,
             m.reason, m.responsible, m.created_at, i.name AS item_name, i.code,
             u.full_name AS user_name
      FROM movements m JOIN items i ON i.id=m.item_id
      LEFT JOIN app_users u ON u.id=m.user_id
      WHERE ($1::bigint IS NULL OR m.item_id=$1) AND ($2='' OR m.movement_type=$2)
      ORDER BY m.created_at DESC LIMIT 500`, [productId, type]);
    res.json({ movimentacoes: result.rows, movements: result.rows });
  } catch (err) { next(err); }
});

// POST /api/movimentacoes - atualiza o saldo e registra o histórico atomicamente.
router.post("/", requireRole("admin", "operador"), async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const body = req.body || {};
    const productId = Number(body.produto_id ?? body.item_id);
    const quantity = Number(body.quantidade ?? body.quantity);
    const type = String(body.tipo ?? body.movement_type ?? "");
    const reason = String(body.motivo ?? body.reason ?? "").trim().slice(0, 240);
    const responsible = String(body.responsavel ?? body.responsible ?? "").trim().slice(0, 120) || null;
    const date = body.data ? new Date(body.data) : new Date();
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0 ||
        !["entrada", "saida"].includes(type) || !reason || Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: "Informe produto_id, tipo (entrada/saida), quantidade inteira positiva, motivo e data válida." });
    }
    await client.query("BEGIN");
    const product = await client.query("SELECT * FROM items WHERE id=$1 AND active=TRUE FOR UPDATE", [productId]);
    if (!product.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Produto não encontrado." });
    }
    const current = product.rows[0];
    if (current.item_type === "equipamento" && quantity !== 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Equipamentos permanentes são movimentados individualmente, uma unidade por vez." });
    }
    const previous = Number(current.quantity);
    const nextQuantity = type === "entrada" ? previous + quantity : previous - quantity;
    if (nextQuantity < 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Estoque insuficiente. A saída não pode deixar o saldo negativo." });
    }
    await client.query("UPDATE items SET quantity=$1, updated_at=NOW() WHERE id=$2", [nextQuantity, productId]);
    const inserted = await client.query(`
      INSERT INTO movements (item_id, movement_type, quantity, previous_quantity, new_quantity, reason, responsible, user_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, item_id AS produto_id, movement_type AS tipo, quantity AS quantidade,
                previous_quantity AS saldo_anterior, new_quantity AS saldo_atual,
                reason AS motivo, responsible AS responsavel, created_at AS data`,
    [productId, type, quantity, previous, nextQuantity, reason, responsible, req.session.user.id, date]);
    if (current.item_type === "equipamento") {
      const isOut = type === "saida";
      await client.query("UPDATE items SET status=$1, assigned_to=$2 WHERE id=$3", [isOut ? "em_uso" : "disponivel", isOut ? responsible : null, productId]);
    }
    await client.query("COMMIT");
    res.status(201).json({ mensagem: "Movimentação registrada e estoque atualizado.", movimentacao: inserted.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client?.release(); }
});

module.exports = router;
