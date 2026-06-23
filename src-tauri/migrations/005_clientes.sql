-- Fase 1.2: cadastro de clientes (CRM leve)
CREATE TABLE IF NOT EXISTS clientes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL,
  telefone    TEXT,
  bairro      TEXT,
  origem      TEXT,
  obs         TEXT,
  criado_em   TEXT    NOT NULL DEFAULT (date('now'))
);

ALTER TABLE vendas ADD COLUMN cliente_id INTEGER REFERENCES clientes(id);
