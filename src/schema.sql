-- EstoqueJá: estrutura relacional PostgreSQL.
-- Categorias e produtos são separados para garantir integridade referencial.
CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'operador'
    CHECK (role IN ('admin', 'operador', 'consulta')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  item_type VARCHAR(20) NOT NULL DEFAULT 'consumivel'
    CHECK (item_type IN ('consumivel', 'equipamento')),
  unit VARCHAR(20) NOT NULL DEFAULT 'un',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  minimum_quantity INTEGER NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
  location VARCHAR(120),
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(120),
  asset_tag VARCHAR(80) UNIQUE,
  assigned_to VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'em_uso', 'manutencao', 'baixado')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movements (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES items(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  movement_type VARCHAR(20) NOT NULL
    CHECK (movement_type IN ('entrada', 'saida', 'ajuste')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  previous_quantity INTEGER NOT NULL CHECK (previous_quantity >= 0),
  new_quantity INTEGER NOT NULL CHECK (new_quantity >= 0),
  reason VARCHAR(240) NOT NULL,
  responsible VARCHAR(120),
  user_id BIGINT REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_name ON items (name);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items (category_id);
CREATE INDEX IF NOT EXISTS idx_movements_item_created ON movements (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_low_stock ON items (quantity, minimum_quantity) WHERE active = TRUE;
