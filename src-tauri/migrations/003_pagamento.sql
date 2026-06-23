-- Fase 1.1: rastreamento de pagamento por venda
ALTER TABLE vendas ADD COLUMN forma_pagamento TEXT NOT NULL DEFAULT 'PIX';
ALTER TABLE vendas ADD COLUMN status_pagamento TEXT NOT NULL DEFAULT 'pago';
-- forma_pagamento: 'PIX' | 'Dinheiro' | 'Cartão' | 'Fiado'
-- status_pagamento: 'pago' | 'pendente'
