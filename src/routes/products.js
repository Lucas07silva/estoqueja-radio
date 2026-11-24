const express = require("express");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const router = express.Router();

const asText = (value, max = 160) => {
  if (value === undefined) return undefined;
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};
const asMoney = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const asInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

function normalizeProduct(row) {
  return {
    ...row,
    // Aliases em português tornam o contrato da API alinhado ao enunciado.
    nome: row.name,
    categoria_id: row.category_id,
    categoria: row.category_name,
    preco: Number(row.price),
    quantidade_estoque: row.quantity,
    estoque_minimo: row.minimum_quantity
  };
}

async function resolveCategoryId(client, body) {
  const suppliedId = body.category_id ?? body.categoria_id;
  if (suppliedId !== undefined && suppliedId !== null && suppliedId !== "") {
    const id = Number(suppliedId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const found = await client.query("SELECT id FROM categories WHERE id = $1", [id]);
    return found.rowCount ? id : null;
  }
  const categoryName = asText(body.category ?? body.categoria, 100);
  if (!categoryName) return null;
  const result = await client.query(
    "INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
    [categoryName]
  );
  return result.rows[0].id;
}

// GET /api/produtos - lista produtos. Use estoqueBaixo=true para filtrar reposições.
router.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.busca || req.query.search || "").trim().slice(0, 100);
    const lowStock = String(req.query.estoqueBaixo || "").toLowerCase() === "true";
    const categoryId = req.query.categoria ? Number(req.query.categoria) : null;
    const itemType = String(req.query.tipo || "");
    if (itemType && !["consumivel", "equipamento"].includes(itemType)) {
      return res.status(400).json({ error: "Parâmetro tipo inválido." });
    }
    if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0)) {
      return res.status(400).json({ error: "Parâmetro categoria inválido." });
    }
    const result = await pool.query(`
      SELECT i.id, i.code, i.name, i.description, i.category_id, c.name AS category_name,
             i.price, i.item_type, i.unit, i.quantity, i.minimum_quantity,
             i.location, i.brand, i.model, i.serial_number, i.asset_tag,
             i.assigned_to, i.status, i.active, i.created_at, i.updated_at
      FROM items i JOIN categories c ON c.id = i.category_id
      WHERE i.active = TRUE
        AND ($1 = '' OR i.code ILIKE '%' || $1 || '%' OR i.name ILIKE '%' || $1 || '%' OR c.name ILIKE '%' || $1 || '%' OR COALESCE(i.asset_tag,'') ILIKE '%' || $1 || '%')
        AND ($2::boolean = FALSE OR i.quantity <= i.minimum_quantity)
        AND ($3::bigint IS NULL OR i.category_id = $3)
        AND ($4 = '' OR i.item_type = $4)
      ORDER BY i.name LIMIT 500`, [search, lowStock, categoryId, itemType]);
    res.json({ produtos: result.rows.map(normalizeProduct) });
  } catch (err) { next(err); }
});

// GET /api/produtos/:id - consulta um produto.
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID de produto inválido." });
    const result = await pool.query(`
      SELECT i.*, c.name AS category_name FROM items i JOIN categories c ON c.id = i.category_id
      WHERE i.id = $1 AND i.active = TRUE`, [id]);
    if (!result.rowCount) return res.status(404).json({ error: "Produto não encontrado." });
    res.json({ produto: normalizeProduct(result.rows[0]) });
  } catch (err) { next(err); }
});

// POST /api/produtos - cria produto e registra o saldo inicial no histórico.
router.post("/", requireRole("admin", "operador"), async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const b = req.body || {};
    const code = asText(b.code ?? b.codigo, 40);
    const name = asText(b.name ?? b.nome, 160);
    const itemType = String(b.item_type || b.tipo_item || "consumivel");
    const price = asMoney(b.price ?? b.preco ?? 0);
    const quantity = asInteger(b.quantity ?? b.quantidade_estoque ?? 0);
    const minimum = asInteger(b.minimum_quantity ?? b.estoque_minimo ?? 0);
    if (!code || !name || price === null || quantity === null || minimum === null || !["consumivel", "equipamento"].includes(itemType)) {
      return res.status(400).json({ error: "Informe código, nome, tipo válido, preço e quantidades não negativos." });
    }
    if (itemType === "equipamento" && quantity > 1) {
      return res.status(400).json({ error: "Equipamentos permanentes devem ser cadastrados individualmente (quantidade máxima 1)." });
    }
    await client.query("BEGIN");
    const categoryId = await resolveCategoryId(client, b);
    if (!categoryId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Informe uma categoria existente ou um nome de categoria válido." });
    }
    const insert = await client.query(`
      INSERT INTO items (code, name, description, category_id, price, item_type, unit, quantity,
        minimum_quantity, location, brand, model, serial_number, asset_tag, assigned_to, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`, [
      code, name, asText(b.description ?? b.descricao, 2000) ?? null, categoryId, price, itemType,
      asText(b.unit ?? b.unidade, 20) || "un", quantity, minimum,
      asText(b.location ?? b.localizacao, 120) ?? null, asText(b.brand ?? b.marca, 100) ?? null,
      asText(b.model ?? b.modelo, 100) ?? null, asText(b.serial_number ?? b.numero_serie, 120) ?? null,
      asText(b.asset_tag ?? b.patrimonio, 80) ?? null, asText(b.assigned_to ?? b.responsavel, 120) ?? null,
      ["disponivel", "em_uso", "manutencao", "baixado"].includes(b.status) ? b.status : "disponivel"
    ]);
    if (quantity > 0) {
      await client.query(`
        INSERT INTO movements (item_id, movement_type, quantity, previous_quantity, new_quantity, reason, user_id)
        VALUES ($1, 'entrada', $2, 0, $2, 'Saldo inicial no cadastro', $3)`,
      [insert.rows[0].id, quantity, req.session.user.id]);
    }
    const complete = await client.query(`SELECT i.*, c.name AS category_name FROM items i JOIN categories c ON c.id = i.category_id WHERE i.id = $1`, [insert.rows[0].id]);
    await client.query("COMMIT");
    res.status(201).json({ mensagem: "Produto cadastrado com sucesso.", produto: normalizeProduct(complete.rows[0]) });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") return res.status(409).json({ error: "Já existe um produto com esse código, patrimônio ou número de série único." });
    next(err);
  } finally { client?.release(); }
});

// PUT /api/produtos/:id - atualiza dados. Alterações de saldo viram movimentação de ajuste.
router.put("/:id", requireRole("admin", "operador"), async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID de produto inválido." });
    const b = req.body || {};
    await client.query("BEGIN");
    const currentResult = await client.query("SELECT * FROM items WHERE id = $1 AND active = TRUE FOR UPDATE", [id]);
    if (!currentResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Produto não encontrado." });
    }
    const current = currentResult.rows[0];
    const categoryId = (b.category_id !== undefined || b.categoria_id !== undefined || b.category !== undefined || b.categoria !== undefined)
      ? await resolveCategoryId(client, b) : Number(current.category_id);
    const price = (b.price !== undefined || b.preco !== undefined) ? asMoney(b.price ?? b.preco) : Number(current.price);
    const quantity = (b.quantity !== undefined || b.quantidade_estoque !== undefined)
      ? asInteger(b.quantity ?? b.quantidade_estoque) : Number(current.quantity);
    const minimum = (b.minimum_quantity !== undefined || b.estoque_minimo !== undefined)
      ? asInteger(b.minimum_quantity ?? b.estoque_minimo) : Number(current.minimum_quantity);
    const itemType = String(b.item_type ?? b.tipo_item ?? current.item_type);
    const nextCode = asText(b.code ?? b.codigo ?? current.code, 40);
    const nextName = asText(b.name ?? b.nome ?? current.name, 160);
    if (!nextCode || !nextName || !categoryId || price === null || quantity === null || minimum === null || !["consumivel", "equipamento"].includes(itemType)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Categoria, preço, tipo ou quantidades inválidas. Valores não podem ser negativos." });
    }
    if (itemType === "equipamento" && quantity > 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Equipamentos permanentes são controlados individualmente (quantidade máxima 1)." });
    }
    await client.query(`
      UPDATE items SET code=$2, name=$3, description=$4, category_id=$5, price=$6,
        item_type=$7, unit=$8, quantity=$9, minimum_quantity=$10, location=$11,
        brand=$12, model=$13, serial_number=$14, asset_tag=$15, assigned_to=$16,
        status=$17, updated_at=NOW()
      WHERE id=$1 RETURNING *`, [
      id, nextCode, nextName,
      b.description !== undefined || b.descricao !== undefined ? (asText(b.description ?? b.descricao, 2000) ?? null) : current.description,
      categoryId, price, itemType, asText(b.unit ?? b.unidade ?? current.unit, 20), quantity, minimum,
      b.location !== undefined || b.localizacao !== undefined ? (asText(b.location ?? b.localizacao, 120) ?? null) : current.location,
      b.brand !== undefined || b.marca !== undefined ? (asText(b.brand ?? b.marca, 100) ?? null) : current.brand,
      b.model !== undefined || b.modelo !== undefined ? (asText(b.model ?? b.modelo, 100) ?? null) : current.model,
      b.serial_number !== undefined || b.numero_serie !== undefined ? (asText(b.serial_number ?? b.numero_serie, 120) ?? null) : current.serial_number,
      b.asset_tag !== undefined || b.patrimonio !== undefined ? (asText(b.asset_tag ?? b.patrimonio, 80) ?? null) : current.asset_tag,
      b.assigned_to !== undefined || b.responsavel !== undefined ? (asText(b.assigned_to ?? b.responsavel, 120) ?? null) : current.assigned_to,
      ["disponivel", "em_uso", "manutencao", "baixado"].includes(b.status) ? b.status : current.status
    ]);
    if (quantity !== Number(current.quantity)) {
      await client.query(`
        INSERT INTO movements (item_id, movement_type, quantity, previous_quantity, new_quantity, reason, user_id)
        VALUES ($1, 'ajuste', $2, $3, $4, 'Ajuste de saldo realizado na edição do produto', $5)`,
      [id, Math.abs(quantity - Number(current.quantity)), current.quantity, quantity, req.session.user.id]);
    }
    const complete = await client.query("SELECT i.*, c.name AS category_name FROM items i JOIN categories c ON c.id = i.category_id WHERE i.id=$1", [id]);
    await client.query("COMMIT");
    res.json({ mensagem: "Produto atualizado com sucesso.", produto: normalizeProduct(complete.rows[0]) });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") return res.status(409).json({ error: "Já existe outro produto com esse código, patrimônio ou número de série único." });
    if (err.code === "23503") return res.status(400).json({ error: "A categoria informada não existe." });
    next(err);
  } finally { client?.release(); }
});

// DELETE /api/produtos/:id - exclui apenas quando não há movimentações históricas.
router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID de produto inválido." });
    const result = await pool.query("DELETE FROM items WHERE id = $1 RETURNING id, code, name", [id]);
    if (!result.rowCount) return res.status(404).json({ error: "Produto não encontrado." });
    res.json({ mensagem: "Produto excluído com sucesso.", produto: result.rows[0] });
  } catch (err) {
    if (err.code === "23503") return res.status(409).json({ error: "Não é possível excluir um produto que possui movimentações. Preserve o histórico e mantenha o cadastro." });
    next(err);
  }
});

// GET /api/produtos/:id/movimentacoes - histórico individual do produto.
router.get("/:id/movimentacoes", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID de produto inválido." });
    const exists = await pool.query("SELECT id FROM items WHERE id=$1 AND active=TRUE", [id]);
    if (!exists.rowCount) return res.status(404).json({ error: "Produto não encontrado." });
    const result = await pool.query(`
      SELECT m.id, m.item_id AS produto_id, m.movement_type AS tipo, m.quantity AS quantidade,
             m.previous_quantity AS saldo_anterior, m.new_quantity AS saldo_atual,
             m.reason AS motivo, m.responsible AS responsavel, m.created_at AS data,
             u.full_name AS usuario
      FROM movements m LEFT JOIN app_users u ON u.id = m.user_id
      WHERE m.item_id=$1 ORDER BY m.created_at DESC`, [id]);
    res.json({ produto_id: id, movimentacoes: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
