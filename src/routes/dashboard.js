const express = require("express");
const pool = require("../db");
const router = express.Router();

// GET /api/dashboard - consolida indicadores usados pela tela inicial.
router.get("/", async (req, res, next) => {
  try {
    const [summary, lowStock, recent] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE active = TRUE)::int AS total_items,
          COUNT(*) FILTER (WHERE active = TRUE AND item_type = 'consumivel')::int AS consumables,
          COUNT(*) FILTER (WHERE active = TRUE AND item_type = 'equipamento')::int AS equipment,
          COUNT(*) FILTER (WHERE active = TRUE AND quantity <= minimum_quantity)::int AS low_stock
        FROM items`),
      pool.query(`
        SELECT i.id, i.code, i.name, i.quantity, i.minimum_quantity, i.unit, c.name AS category
        FROM items i JOIN categories c ON c.id=i.category_id
        WHERE i.active = TRUE AND i.quantity <= i.minimum_quantity
        ORDER BY i.quantity ASC, i.name ASC LIMIT 8`),
      pool.query(`
        SELECT m.id, m.movement_type, m.quantity, m.previous_quantity, m.new_quantity,
               m.reason, m.responsible, m.created_at, i.name AS item_name, i.code,
               u.full_name AS user_name
        FROM movements m
        JOIN items i ON i.id = m.item_id
        LEFT JOIN app_users u ON u.id = m.user_id
        ORDER BY m.created_at DESC LIMIT 8`)
    ]);
    res.json({ summary: summary.rows[0], lowStock: lowStock.rows, recent: recent.rows });
  } catch (err) { next(err); }
});

module.exports = router;
