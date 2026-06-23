-- Fase 1.3: tela de operação do dia
ALTER TABLE vendas ADD COLUMN status_entrega TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE vendas ADD COLUMN hora_pedido TEXT;
-- status_entrega: 'pendente' | 'entregue'
-- hora_pedido: 'HH:MM', preenchido automaticamente no INSERT
