-- Fase 2.2: cardápio dinâmico — produtos além de P/M/G
-- disponivel_hoje permite ativar/desativar um produto para o dia corrente
-- sem excluir do histórico de vendas.
ALTER TABLE produtos ADD COLUMN disponivel_hoje INTEGER NOT NULL DEFAULT 1;
