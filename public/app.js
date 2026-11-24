const $ = (selector) => document.querySelector(selector);
const state = { user: null, items: [], categories: [], page: "dashboard", editingItemId: null, editingCategoryId: null };
const labels = { admin: "Administrador", operador: "Operador", consulta: "Consulta" };
let toastTimer;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && url !== "/api/auth/login") showLogin();
    throw new Error(data.error || "Não foi possível concluir a operação.");
  }
  return data;
}
function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = "toast", 3200);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function date(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function showLogin() {
  state.user = null;
  $("#app-shell").classList.add("hidden");
  $("#login-screen").classList.remove("hidden");
  $("#password").value = "";
}
function showApp(user) {
  state.user = user;
  $("#login-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  $("#user-name").textContent = user.fullName;
  $("#welcome-name").textContent = user.fullName.split(" ")[0];
  $("#user-role").textContent = labels[user.role] || user.role;
  $("#user-initials").textContent = user.fullName.split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  $("#today-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
  ["#quick-add", "#add-item", "#add-movement", "#add-category"].forEach(selector => $(selector).classList.remove("hidden"));
  if (user.role === "consulta") {
    $("#quick-add").classList.add("hidden");
    $("#add-item").classList.add("hidden");
    $("#add-movement").classList.add("hidden");
    $("#add-category").classList.add("hidden");
  }
  loadDashboard();
}
function goPage(page) {
  state.page = page;
  document.querySelectorAll(".page").forEach(el => el.classList.add("hidden"));
  $(`#page-${page}`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  const title = { dashboard: "Visão geral", items: "Itens e patrimônio", movements: "Movimentações", categories: "Categorias" }[page];
  $("#page-title").textContent = title;
  $("#page-eyebrow").textContent = { dashboard: "PAINEL DE CONTROLE", items: "CADASTRO E CONSULTA", movements: "HISTÓRICO DE ESTOQUE", categories: "ORGANIZAÇÃO DO ESTOQUE" }[page];
  if (page === "items") loadItems();
  if (page === "movements") loadMovements();
  if (page === "categories") loadCategories();
}
function stockBadge(item) {
  if (Number(item.quantity) <= Number(item.minimum_quantity)) return '<span class="badge amber">Estoque baixo</span>';
  return '<span class="badge green">Normal</span>';
}
function typeBadge(type) {
  return type === "equipamento" ? '<span class="badge blue">Equipamento</span>' : '<span class="badge gray">Consumível</span>';
}
function movementBadge(type) {
  const map = {
    entrada: '<span class="badge green">Entrada</span>',
    saida: '<span class="badge red">Saída</span>',
    ajuste: '<span class="badge amber">Ajuste</span>'
  };
  return map[type] || esc(type);
}
async function loadDashboard() {
  try {
    const data = await api("/api/dashboard");
    $("#stat-total").textContent = data.summary.total_items;
    $("#stat-consumables").textContent = data.summary.consumables;
    $("#stat-equipment").textContent = data.summary.equipment;
    $("#stat-low").textContent = data.summary.low_stock;
    $("#low-stock-list").innerHTML = data.lowStock.length ? `
      <table class="data-table"><thead><tr><th>ITEM</th><th>SALDO</th><th>SITUAÇÃO</th></tr></thead><tbody>
      ${data.lowStock.map(item => `<tr><td>${esc(item.name)}<br><span class="muted small">${esc(item.code)}</span></td><td>${item.quantity} ${esc(item.unit)} <span class="muted">/ mín. ${item.minimum_quantity}</span></td><td>${stockBadge(item)}</td></tr>`).join("")}
      </tbody></table>` : '<div class="empty-state">Nenhum item em estoque baixo.</div>';
    $("#recent-list").innerHTML = data.recent.length ? data.recent.map(m => `
      <div class="activity"><div class="activity-mark ${m.movement_type === "saida" ? "out" : m.movement_type === "ajuste" ? "adjust" : ""}">${m.movement_type === "entrada" ? "↓" : m.movement_type === "saida" ? "↑" : "↔"}</div>
      <div class="activity-main"><strong>${esc(m.item_name)}</strong><small>${esc(m.code)} · ${esc(m.reason)} · ${date(m.created_at)}</small></div>
      <span class="activity-qty ${m.movement_type === "saida" ? "out" : ""}">${m.movement_type === "saida" ? "−" : m.movement_type === "entrada" ? "+" : "="}${m.quantity}</span></div>`).join("") : '<div class="empty-state">As movimentações aparecerão aqui.</div>';
  } catch (err) { toast(err.message, true); }
}
async function loadItems() {
  try {
    const params = new URLSearchParams({ busca: $("#item-search").value, tipo: $("#item-type-filter").value });
    const data = await api(`/api/produtos?${params}`);
    state.items = data.produtos;
    $("#items-table").innerHTML = data.produtos.length ? `
      <table class="data-table"><thead><tr><th>PRODUTO / CATEGORIA</th><th>PREÇO</th><th>TIPO</th><th>SALDO</th><th>LOCALIZAÇÃO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>
      ${data.produtos.map(item => `<tr><td>${esc(item.name)}<br><span class="muted small">${esc(item.code)} · ${esc(item.category_name || "Sem categoria")}${item.asset_tag ? " · Patrimônio: " + esc(item.asset_tag) : ""}</span></td><td>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.price || 0))}</td><td>${typeBadge(item.item_type)}</td><td><strong>${item.quantity}</strong> ${esc(item.unit)}<br><span class="muted small">Mínimo: ${item.minimum_quantity}</span></td><td>${esc(item.location || "—")}</td><td>${item.item_type === "consumivel" ? stockBadge(item) : `<span class="badge ${item.status === "em_uso" ? "blue" : item.status === "manutencao" ? "amber" : item.status === "baixado" ? "red" : "green"}">${({ disponivel: "Disponível", em_uso: "Em uso", manutencao: "Manutenção", baixado: "Baixado" })[item.status] || item.status}</span>`}</td><td><button class="btn secondary item-move" data-id="${item.id}">Movimentar</button> ${state.user.role !== "consulta" ? `<button class="text-btn item-edit" data-id="${item.id}">Editar</button>` : ""} ${state.user.role === "admin" ? `<button class="text-btn item-deactivate" data-id="${item.id}">Excluir</button>` : ""}</td></tr>`).join("")}
      </tbody></table>` : '<div class="empty-state">Nenhum item encontrado. Cadastre o primeiro item para começar.</div>';
    $("#items-table").querySelectorAll(".item-move").forEach(btn => btn.addEventListener("click", () => openMovement(Number(btn.dataset.id))));
    $("#items-table").querySelectorAll(".item-deactivate").forEach(btn => btn.addEventListener("click", () => deactivateItem(Number(btn.dataset.id))));
    $("#items-table").querySelectorAll(".item-edit").forEach(btn => btn.addEventListener("click", () => openItemDialog(state.items.find(item => Number(item.id) === Number(btn.dataset.id)))));
    if (state.user.role === "consulta") document.querySelectorAll(".item-move").forEach(btn => btn.classList.add("hidden"));
  } catch (err) { toast(err.message, true); }
}
async function loadMovements() {
  try {
    const data = await api("/api/movimentacoes");
    $("#movements-table").innerHTML = data.movements.length ? `
      <table class="data-table"><thead><tr><th>DATA</th><th>ITEM</th><th>TIPO</th><th>QUANTIDADE</th><th>SALDO</th><th>MOTIVO / RESPONSÁVEL</th><th>REGISTRADO POR</th></tr></thead><tbody>
      ${data.movements.map(m => `<tr><td>${date(m.created_at)}</td><td>${esc(m.item_name)}<br><span class="muted small">${esc(m.code)}</span></td><td>${movementBadge(m.movement_type)}</td><td>${m.quantity}</td><td>${m.previous_quantity} → <strong>${m.new_quantity}</strong></td><td>${esc(m.reason)}<br><span class="muted small">${esc(m.responsible || "—")}</span></td><td>${esc(m.user_name || "—")}</td></tr>`).join("")}
      </tbody></table>` : '<div class="empty-state">Nenhuma movimentação registrada.</div>';
  } catch (err) { toast(err.message, true); }
}
async function openItemDialog(item = null) {
  if (!["admin", "operador"].includes(state.user.role)) return toast("Seu perfil não pode cadastrar/editar itens.", true);
  state.editingItemId = item ? item.id : null;
  $("#item-form").reset();
  $("#item-dialog").querySelector(".modal-head h2").textContent = item ? "Editar produto" : "Novo item";
  $("#item-quantity").value = item ? item.quantity : 0;
  $("#item-minimum").value = item ? item.minimum_quantity : 0;
  $("#item-price").value = item ? Number(item.price).toFixed(2) : "0.00";
  if (item) {
    const fields = { code: item.code, name: item.name, item_type: item.item_type, category: item.category_name || item.category,
      unit: item.unit, location: item.location, brand: item.brand, model: item.model,
      serial_number: item.serial_number, asset_tag: item.asset_tag, assigned_to: item.assigned_to,
      description: item.description };
    Object.entries(fields).forEach(([key, value]) => {
      const input = $("#item-form").elements.namedItem(key);
      if (input) input.value = value || "";
    });
  }
  await refreshCategoryOptions();
  $("#item-dialog").showModal();
}
async function openMovement(itemId = null) {
  if (!["admin", "operador"].includes(state.user.role)) return toast("Seu perfil não pode movimentar o estoque.", true);
  try {
    const data = await api("/api/produtos");
    state.items = data.produtos;
    const select = $("#movement-item");
    select.innerHTML = data.produtos.map(item => `<option value="${item.id}" ${item.id === itemId ? "selected" : ""}>${esc(item.code)} — ${esc(item.name)} (saldo: ${item.quantity})</option>`).join("");
    if (!data.produtos.length) return toast("Cadastre um item antes de movimentar o estoque.", true);
    $("#movement-form").reset();
    if (itemId) select.value = String(itemId);
    $("#movement-type").value = "entrada";
    $("#movement-quantity").value = 1;
    $("#movement-quantity-label").textContent = "Quantidade *";
    $("#movement-help").textContent = "As movimentações ficam registradas no histórico.";
    $("#movement-dialog").showModal();
  } catch (err) { toast(err.message, true); }
}
async function deactivateItem(id) {
  if (!confirm("Excluir este produto? Produtos com movimentações vinculadas não podem ser excluídos.")) return;
  try { await api(`/api/produtos/${id}`, { method: "DELETE" }); toast("Produto excluído."); await loadItems(); await loadDashboard(); }
  catch (err) { toast(err.message, true); }
}

async function refreshCategoryOptions() {
  const data = await api("/api/categorias");
  state.categories = data.categorias;
  $("#category-options").innerHTML = state.categories.map(category => `<option value="${esc(category.name)}"></option>`).join("");
}

async function loadCategories() {
  try {
    await refreshCategoryOptions();
    $("#categories-table").innerHTML = state.categories.length ? `
      <table class="data-table"><thead><tr><th>CATEGORIA</th><th>DESCRIÇÃO</th><th>PRODUTOS VINCULADOS</th><th>AÇÕES</th></tr></thead><tbody>
      ${state.categories.map(category => `<tr><td>${esc(category.name)}</td><td>${esc(category.description || "—")}</td><td>${category.products_count}</td><td>${state.user.role !== "consulta" ? `<button class="text-btn category-edit" data-id="${category.id}">Editar</button>` : ""} ${state.user.role === "admin" ? `<button class="text-btn category-delete" data-id="${category.id}">Excluir</button>` : ""}</td></tr>`).join("")}
      </tbody></table>` : '<div class="empty-state">Nenhuma categoria cadastrada. Crie uma categoria ou cadastre um produto para criá-la automaticamente.</div>';
    $("#categories-table").querySelectorAll(".category-edit").forEach(button => button.addEventListener("click", () => openCategoryDialog(state.categories.find(c => Number(c.id) === Number(button.dataset.id)))));
    $("#categories-table").querySelectorAll(".category-delete").forEach(button => button.addEventListener("click", () => deleteCategory(Number(button.dataset.id))));
    if (state.user.role === "consulta") $("#add-category").classList.add("hidden");
  } catch (err) { toast(err.message, true); }
}

function openCategoryDialog(category = null) {
  if (!["admin", "operador"].includes(state.user.role)) return toast("Seu perfil não pode gerenciar categorias.", true);
  state.editingCategoryId = category ? category.id : null;
  $("#category-form").reset();
  $("#category-dialog-title").textContent = category ? "Editar categoria" : "Nova categoria";
  $("#category-name").value = category?.name || "";
  $("#category-description").value = category?.description || "";
  $("#category-dialog").showModal();
}

async function deleteCategory(id) {
  if (!confirm("Excluir esta categoria? Ela não pode possuir produtos vinculados.")) return;
  try { await api(`/api/categorias/${id}`, { method: "DELETE" }); toast("Categoria excluída."); await loadCategories(); }
  catch (err) { toast(err.message, true); }
}
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#login-error").textContent = "";
  try {
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: $("#username").value.trim(), password: $("#password").value }) });
    showApp(data.user);
  } catch (err) { $("#login-error").textContent = err.message; }
});
$("#logout-btn").addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST" }); } catch {}
  showLogin();
});
document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => goPage(btn.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(btn => btn.addEventListener("click", () => goPage(btn.dataset.goto)));
$("#quick-add").addEventListener("click", () => openItemDialog());
$("#add-item").addEventListener("click", () => openItemDialog());
$("#add-movement").addEventListener("click", () => openMovement());
$("#add-category").addEventListener("click", () => openCategoryDialog());
$("#item-search").addEventListener("input", debounce(loadItems, 250));
$("#item-type-filter").addEventListener("change", loadItems);
$("#movement-type").addEventListener("change", () => {
  const adjustment = $("#movement-type").value === "ajuste";
  $("#movement-quantity-label").textContent = adjustment ? "Novo saldo *" : "Quantidade *";
  $("#movement-quantity").min = adjustment ? "0" : "1";
  $("#movement-quantity").value = adjustment ? "0" : "1";
  $("#movement-help").textContent = adjustment ? "No ajuste, informe o saldo final correto após conferência física." : "As movimentações ficam registradas no histórico.";
});
document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => $(`#${btn.dataset.close}`).close()));

$("#item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  ["quantity", "minimum_quantity"].forEach(k => payload[k] = Number(payload[k]));
  if (payload.item_type === "equipamento" && payload.quantity > 1) return toast("Cadastre cada equipamento em um registro individual.", true);
  try {
    payload.price = Number(payload.price);
    await api(state.editingItemId ? `/api/produtos/${state.editingItemId}` : "/api/produtos", {
      method: state.editingItemId ? "PUT" : "POST", body: JSON.stringify(payload)
    });
    $("#item-dialog").close();
    toast(state.editingItemId ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
    state.editingItemId = null;
    await loadItems(); await loadDashboard();
  } catch (err) { toast(err.message, true); }
});
$("#category-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await api(state.editingCategoryId ? `/api/categorias/${state.editingCategoryId}` : "/api/categorias", {
      method: state.editingCategoryId ? "PUT" : "POST", body: JSON.stringify(payload)
    });
    $("#category-dialog").close();
    state.editingCategoryId = null;
    toast("Categoria salva com sucesso.");
    await loadCategories();
  } catch (err) { toast(err.message, true); }
});

$("#movement-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.item_id = Number(payload.item_id);
  payload.quantity = Number(payload.quantity);
  try {
    await api("/api/movimentacoes", { method: "POST", body: JSON.stringify({
      produto_id: payload.item_id, tipo: payload.movement_type, quantidade: payload.quantity,
      motivo: payload.reason, responsavel: payload.responsible
    }) });
    $("#movement-dialog").close();
    toast("Movimentação registrada.");
    await loadItems(); await loadMovements(); await loadDashboard();
  } catch (err) { toast(err.message, true); }
});
function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
async function init() {
  try {
    const data = await api("/api/auth/me");
    showApp(data.user);
  } catch { showLogin(); }
}
init();
