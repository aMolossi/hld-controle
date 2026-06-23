-- ============================================================
-- HLD Controle - schema inicial (v1)
-- ============================================================

-- Catalogo de marmitas: tamanho, preco de venda e custo unitario (CMV)
CREATE TABLE IF NOT EXISTS produtos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  tamanho  TEXT    NOT NULL UNIQUE,
  nome     TEXT    NOT NULL,
  preco    REAL    NOT NULL DEFAULT 0,
  custo    REAL    NOT NULL DEFAULT 0,
  ativo    INTEGER NOT NULL DEFAULT 1,
  ordem    INTEGER NOT NULL DEFAULT 0
);

-- Vendas (pedidos concluidos) - entrada de caixa
CREATE TABLE IF NOT EXISTS vendas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  data          TEXT    NOT NULL,
  cliente_nome  TEXT,
  telefone      TEXT,
  bairro        TEXT,
  origem        TEXT,
  tipo_cliente  TEXT,
  tamanho       TEXT    NOT NULL,
  valor_marmita REAL    NOT NULL DEFAULT 0,
  valor_extras  REAL    NOT NULL DEFAULT 0,
  total         REAL    NOT NULL DEFAULT 0,
  obs           TEXT,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data);

-- Itens extras de cada venda (bebidas, sobremesas, etc.)
CREATE TABLE IF NOT EXISTS venda_extras (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id  INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  nome      TEXT    NOT NULL,
  valor     REAL    NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_venda_extras_venda ON venda_extras(venda_id);

-- Despesas / saidas
CREATE TABLE IF NOT EXISTS despesas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  data        TEXT    NOT NULL,
  categoria   TEXT    NOT NULL,
  descricao   TEXT,
  valor       REAL    NOT NULL DEFAULT 0,
  tipo        TEXT    NOT NULL DEFAULT 'variavel',
  recorrente  INTEGER NOT NULL DEFAULT 0,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria);

-- Categorias de despesa (dropdown gerenciavel)
CREATE TABLE IF NOT EXISTS despesa_categorias (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT    NOT NULL UNIQUE,
  tipo  TEXT    NOT NULL DEFAULT 'variavel',
  ordem INTEGER NOT NULL DEFAULT 0
);

-- Leads / curiosos (schema pronto para uso futuro, sem UI no MVP)
CREATE TABLE IF NOT EXISTS leads (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  data      TEXT    NOT NULL,
  nome      TEXT,
  telefone  TEXT,
  bairro    TEXT,
  origem    TEXT,
  motivo    TEXT
);

-- Configuracoes chave/valor
CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

-- ============================================================
-- Seeds iniciais
-- ============================================================
INSERT OR IGNORE INTO produtos (tamanho, nome, preco, custo, ordem) VALUES
  ('P', 'Marmita P', 22, 0, 1),
  ('M', 'Marmita M', 25, 0, 2),
  ('G', 'Marmita G', 28, 0, 3);

INSERT OR IGNORE INTO despesa_categorias (nome, tipo, ordem) VALUES
  ('Ingredientes/Insumos', 'variavel', 1),
  ('Embalagens', 'variavel', 2),
  ('Impostos', 'variavel', 3),
  ('Taxas (app/cartao)', 'variavel', 4),
  ('Salarios', 'fixo', 5),
  ('Energia', 'fixo', 6),
  ('Gas', 'variavel', 7),
  ('Agua', 'fixo', 8),
  ('Aluguel', 'fixo', 9),
  ('Custos operacionais', 'variavel', 10),
  ('Utensilios', 'variavel', 11),
  ('Marketing', 'variavel', 12),
  ('Investimentos', 'variavel', 13),
  ('Perdas', 'variavel', 14),
  ('Outros', 'variavel', 15);

INSERT OR IGNORE INTO config (chave, valor) VALUES
  ('margem_meta', '0.30'),
  ('marca_nome', 'HLD Marmitaria');
