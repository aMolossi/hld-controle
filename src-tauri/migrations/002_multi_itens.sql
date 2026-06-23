-- ============================================================
-- HLD Controle - v2: pedidos com varios itens, quantidades
-- e venda para empresa (contrato semanal/mensal)
-- ============================================================

-- Itens de marmita por venda (varios tamanhos/quantidades no mesmo pedido)
CREATE TABLE IF NOT EXISTS venda_itens (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  venda_id       INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  tamanho        TEXT    NOT NULL,
  quantidade     INTEGER NOT NULL DEFAULT 1,
  preco_unitario REAL    NOT NULL DEFAULT 0,
  subtotal       REAL    NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_venda_itens_venda ON venda_itens(venda_id);

-- Extras agora com quantidade e preco unitario.
-- A coluna 'valor' (ja existente) passa a guardar o subtotal da linha.
ALTER TABLE venda_extras ADD COLUMN quantidade INTEGER NOT NULL DEFAULT 1;
ALTER TABLE venda_extras ADD COLUMN preco_unitario REAL NOT NULL DEFAULT 0;

-- Cabecalho da venda: tipo (Avulso/Empresa), empresa e contrato.
-- 'valor_marmita' (existente) passa a ser a SOMA dos subtotais de marmitas.
-- 'tamanho' (existente) vira legado; 'itens_resumo' guarda o resumo p/ exibir.
ALTER TABLE vendas ADD COLUMN tipo_venda    TEXT    NOT NULL DEFAULT 'Avulso';
ALTER TABLE vendas ADD COLUMN empresa       TEXT;
ALTER TABLE vendas ADD COLUMN periodicidade TEXT;
ALTER TABLE vendas ADD COLUMN qtd_marmitas  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vendas ADD COLUMN itens_resumo  TEXT;
