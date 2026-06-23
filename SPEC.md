# HubControl — Spec de Produto

Roadmap de implementação para tornar o HubControl um produto comercial vendável para marmitarias.
Cada feature tem: problema, user stories, critérios de aceite (AC) e abordagem técnica específica para o stack **Tauri 2 + React + SQLite**.

---

## Fases

| Fase | Objetivo | Status |
|---|---|---|
| [Fase 0](#fase-0--modelo-de-negócio) | Habilitar cobrança e primeiro acesso guiado | ✅ Concluída |
| [Fase 1](#fase-1--operação-do-dia) | Funcionalidades que impedem a venda hoje | ✅ Concluída |
| [Fase 2](#fase-2--inteligência-e-retenção) | Aumentar valor percebido e retenção | ✅ Concluída |
| [Fase 3](#fase-3--expansão-de-plataforma) | Multi-dispositivo e escala | Pendente |

---

## Fase 0 — Modelo de negócio

> Sem essa fase não há produto comercial. Implementar antes de vender para qualquer cliente.

### 0.1 Sistema de licença offline

**Problema:** qualquer pessoa pode instalar e usar sem pagar.

**User stories:**
- Como vendedor, quero gerar uma chave de licença para cada cliente, para controlar quem tem acesso.
- Como usuário, quero ativar meu app com a chave que recebi, para começar a usar.
- Como usuário, quero que minha licença funcione sem internet, para não depender de conexão no dia a dia.

**Critérios de aceite:**
- [x] Ao abrir sem licença válida, o app exibe tela de ativação (não o app completo)
- [x] Campo para colar a chave + botão "Ativar"
- [x] Chave inválida: mensagem de erro clara ("Chave inválida: assinatura não confere")
- [x] Chave válida: licença salva em config, app abre normalmente
- [x] Licença com data de expiração: ao expirar, banner de renovação (não bloqueia imediatamente — 7 dias de carência)
- [x] Card "Licença" em Configurações mostra: cliente, validade, tier, dias restantes
- [x] Tier "starter" oculta Hoje e Clientes do menu lateral
- [x] Gerador de chaves: `scripts/gen-license.ps1 -Cliente "..." -Expiry "..." -Tier pro`

**Abordagem técnica:**

*Formato da chave:*
```
HUBCTRL-{BASE32(payload)}-{CHECKSUM}
payload = JSON { cliente: string, expiry: "YYYY-MM-DD", tier: "starter|pro" }
assinado com HMAC-SHA256 usando chave privada do vendedor (hardcoded no build)
```

*Validação (Rust, `src-tauri/src/lib.rs`):*
```rust
// Comando Tauri: validate_license(key: &str) -> Result<LicenseInfo, String>
// LicenseInfo { cliente, expiry, tier, valid, days_remaining }
// Usa hmac crate para verificar assinatura
```

*Gerador de chaves (fora do app — script PowerShell ou pequeno CLI):*
```powershell
# scripts/gen-license.ps1 -Cliente "HLD Marmitaria" -Expiry "2027-01-01" -Tier "pro"
```

*Storage:* tabela `config` com chaves `license_key` e `license_info` (JSON).

*Tela de ativação:* nova rota `/activate` renderizada quando `license_valid = false`. O router em `main.tsx` redireciona para `/activate` antes de qualquer outra rota.

*Tier `starter`:* Vendas, Despesas, Dashboard básico.
*Tier `pro`:* tudo + Clientes + Operações do Dia + Alertas.

---

### 0.2 Onboarding — wizard de primeiro acesso ✅

**Problema:** usuário novo abre o app e vê telas vazias sem saber o que fazer.

**Critérios de aceite:**
- [x] Na primeira abertura (após ativação), o app abre na tela de onboarding, não no Dashboard
- [x] Wizard com 3 etapas + indicador de progresso (Passo 1/3)
- [x] **Etapa 1 — Sua marmitaria:** nome do negócio, cidade. Salva em `config.marca_nome` e `config.cidade`
- [x] **Etapa 2 — Seus produtos:** tabela editável P/M/G com nome, preço de venda e custo
- [x] **Etapa 3 — Sua meta:** margem desejada (%) com slider
- [x] Botão "Concluir" salva tudo e redireciona para Dashboard
- [x] Possível pular etapas 2 e 3 ("Configurar depois")
- [x] Onboarding não aparece novamente após concluído (`config.setup_complete = "true"`)
- [ ] Acesso via Configurações: "Refazer onboarding" para usuários existentes

**Arquivos criados:** `src/pages/Onboarding.tsx` · rota `/onboarding` em `main.tsx` · redirect em `App.tsx`

---

## Fase 1 — Operação do dia ✅

> Todas as funcionalidades da Fase 1 estão implementadas.

### 1.1 Rastreamento de pagamento por venda ✅

**Critérios de aceite:**
- [x] Modal de nova/editar venda: campo "Forma de pagamento" (PIX / Dinheiro / Cartão / Fiado)
- [x] Campo "Status" automático: PIX/Dinheiro/Cartão → "Pago"; Fiado → "Pendente"
- [x] Tabela de Vendas: coluna "Pagamento" com pill colorido (Pago = verde, Pendente = dourado)
- [x] Filtro rápido na lista: "Todos / Pagos / Fiados"
- [x] Linha de fiado com destaque sutil (fundo amarelo escuro)
- [x] Ação rápida na tabela: botão "✓ Pago" sem precisar abrir o modal completo
- [x] KPI no Dashboard: "A receber (fiados)" com valor total pendente
- [x] Total do período no rodapé da tabela separa: Recebido vs. A receber

**Migration:** `003_pagamento.sql` (v3) · **Funções:** `getReceber(period)` em `calc.ts`

---

### 1.2 Cadastro de clientes (CRM leve) ✅

**Critérios de aceite:**
- [x] Nova tela `/clientes` com tabela: Nome, Telefone, Bairro, Total pedidos, Total gasto, Última compra
- [x] Ordenação padrão: maior total gasto primeiro
- [x] Busca por nome ou telefone
- [x] Ao clicar num cliente: modal com histórico de pedidos
- [x] No modal de nova venda: campo "Cliente" com autocomplete que busca em `clientes`
- [x] Ao selecionar cliente cadastrado: preenche telefone e bairro automaticamente
- [x] Ao salvar uma venda com nome de cliente novo, pergunta: "Deseja cadastrar [nome] como cliente fixo?"
- [x] Badge "Sem compras há X dias" para clientes sem pedido há mais de 30 dias
- [x] Exportar lista de clientes como CSV

**Migration:** `005_clientes.sql` (v5) · **Página:** `src/pages/Clientes.tsx` · **Funções:** `getClientesResumo()` em `calc.ts`

---

### 1.3 Tela de operação do dia ✅

**Critérios de aceite:**
- [x] Nova tela `/hoje` (ícone de calendário) como segunda entrada do menu
- [x] Header: data de hoje, total de pedidos, total a produzir (ex: "12 pedidos · 8P / 15M / 6G · R$ 870,00")
- [x] Lista de pedidos do dia: hora, cliente, itens resumidos, valor, status pagamento, status entrega
- [x] Status de entrega: "Pendente" / "Entregue" — clique para alternar
- [x] Botão "+ Novo pedido" redireciona para tela de Vendas
- [x] Card de resumo de produção: grid com P/M/G e quantidades totais
- [x] Filtro rápido: Todos / Pendentes / Entregues / Fiados
- [ ] Lista atualiza automaticamente quando uma nova venda é salva em outra aba

**Migration:** `004_entrega.sql` (v4) · **Página:** `src/pages/Hoje.tsx`

---

## Fase 2 — Inteligência e retenção

> Aumenta o valor percebido do produto. Usuário que vê alertas úteis renova a assinatura.

### 2.1 Alertas inteligentes no Dashboard ✅

**Critérios de aceite:**
- [x] Alertas aparecem como banners dismissíveis abaixo do header do Dashboard (max 2 por vez)
- [x] Cada alerta tem: ícone de severidade (⚠ amarelo / 🔴 vermelho), texto objetivo, botão de ação
- [x] Alerta é dispensável (botão X) e não volta no mesmo dia
- [x] **Tipo 1 — Abaixo do equilíbrio:** faturamento do mês < 85% do equilíbrio proporcional ao dia atual
- [x] **Tipo 2 — Margem caindo:** margem do mês atual < 80% da margem do mês anterior
- [x] **Tipo 3 — Fiados acumulados:** total `status_pagamento = 'pendente'` > threshold (default R$200)
- [x] **Tipo 4 — Sem vendas:** nenhuma venda nos últimos 2 dias úteis
- [x] Threshold de fiados configurável em Configurações

**Componente:** `src/components/AlertaBanner.tsx` · **Funções:** `getAlertas()` em `calc.ts`

---

### 2.2 Cardápio dinâmico (além de P/M/G) ✅

**Problema:** marmitarias têm combos, pratos especiais, promoções. O sistema atual só aceita P/M/G fixo.

**User stories:**
- Como dono, quero cadastrar produtos além de P/M/G (combos, marmita vegana, prato executivo), para vender variedade.
- Como dono, quero ativar/desativar um produto para o dia, para refletir o cardápio de hoje sem excluir o produto.
- Como dono, quero definir qual produto aparece por padrão no formulário de venda, para não precisar selecionar toda vez.

**Critérios de aceite:**
- [x] Em Configurações: botão "+ Novo produto" abre modal com campos: nome, tamanho (livre), preço, custo
- [x] Lista de produtos mostra todos (não só P/M/G) com toggle "Hoje" (disponivel_hoje)
- [x] Produtos com "Hoje" desmarcado não aparecem no formulário de nova venda
- [x] Campo "ordem" permite reordenar (botões ↑↓)
- [x] Ao editar produto existente: histórico de vendas não é afetado (preço unitário fica na `venda_itens`)
- [x] Máximo de 20 produtos ativos (limite prático)

**Abordagem técnica:**

*Migration `006_produtos.sql`:*
```sql
ALTER TABLE produtos ADD COLUMN disponivel_hoje INTEGER NOT NULL DEFAULT 1;
```

Em `Configurações`, refatorar a tabela de produtos para incluir o toggle "disponível hoje" e o botão de novo produto. O modal de nova venda já filtra por `ativo = 1`; adicionar `AND disponivel_hoje = 1`.

---

### 2.3 Empty states educativos ✅

**Problema:** telas vazias não ensinam o usuário o que fazer a seguir.

**Critérios de aceite:**
- [x] **Dashboard vazio:** ícone de gráfico + "Sem vendas no período" + botão "Ir para Vendas" (card acima dos gráficos quando pedidos=0)
- [x] **Vendas vazia:** ícone de sacola + "Nenhum pedido no período" + texto + botão "Nova venda"
- [x] **Despesas vazia:** ícone de carteira + "Nenhuma despesa no período" + texto + botão "Nova despesa"
- [x] **Clientes vazia:** ícone de pessoas + texto explicativo + botão "Novo cliente"
- [x] Empty states têm visual consistente: ícone 48px, título, subtexto, botão opcional
- [x] Hoje vazia: ícone de calendário + "Nenhum pedido hoje" + botão "Novo pedido"

**Abordagem técnica:**

Componente `src/components/EmptyState.tsx`:
```tsx
interface Props { icon: ReactNode; title: string; body: string; action?: { label: string; to: string } }
```
Substituir os `<div className="card empty">` atuais pelo novo componente.

---

## Fase 3 — Expansão de plataforma

> Necessário para escalar além dos primeiros clientes.

### 3.1 Dashboard web (leitura pelo celular)

**Problema:** o dono quer checar os números pelo celular, mas o app só roda em Windows.

**Critérios de aceite:**
- [ ] Em Configurações: botão "Ativar dashboard web" que inicia um servidor HTTP local na porta 7432
- [ ] Servidor serve uma SPA React (bundle estático embutido no binário Tauri) com as métricas principais
- [ ] Acesso via `http://IP-local:7432` com senha definida pelo usuário
- [ ] Tela mobile: KPIs do mês (faturamento, lucro, margem), pedidos de hoje, alertas ativos
- [ ] Atualização automática a cada 30s (polling simples)
- [ ] Servidor para quando o app fecha

**Abordagem técnica:**

Plugin Tauri `tauri-plugin-localhost` (já existe no ecossistema) ou servidor Axum embutido no `lib.rs`.

Bundle da SPA mobile compilado separadamente (Vite build `--mode mobile`) e embutido via `include_bytes!` no binário Rust.

Autenticação: token Bearer gerado aleatoriamente, armazenado em `config.web_token`. UI mostra o URL + QR code para abrir no celular.

---

### 3.2 Landing page de vendas

**Problema:** o produto não existe na internet. Impossível descobrir, testar ou comprar.

**Critérios de aceite:**
- [ ] Hero: headline focada na dor ("Pare de adivinhar se sua marmitaria está dando lucro") + CTA "Testar grátis 14 dias"
- [ ] Seção de funcionalidades: 4 cards com prints do app real
- [ ] Seção de preços: 1 plano simples (Starter R$49/mês ou Anual R$490) + link de compra via Hotmart
- [ ] Seção de depoimentos (placeholder para quando tiver clientes)
- [ ] Footer: contato (WhatsApp), versão atual
- [ ] Download do instalador da última versão direto da página
- [ ] Mobile-first

**Abordagem técnica:**

Site estático separado do repositório do app. Stack: HTML + CSS puro. Hospedagem: GitHub Pages ou Vercel free tier.

Compra via Hotmart. Após pagamento, sistema gera a chave de licença automaticamente via webhook Hotmart → script/função serverless.

---

### 3.3 Trial de 14 dias sem licença

**Problema:** usuário não compra sem testar. Sem trial, a taxa de conversão é próxima de zero.

**Critérios de aceite:**
- [ ] Na primeira abertura sem licença: opção "Ativar licença" e "Começar trial de 14 dias"
- [ ] Trial começa imediatamente ao clicar — sem e-mail, sem formulário
- [ ] Durante o trial: banner persistente no topo "Trial — X dias restantes · Comprar"
- [ ] Nos últimos 3 dias: banner mais urgente (vermelho) com CTA para compra
- [ ] Ao expirar: tela de expiração com link de compra, sem acesso ao app
- [ ] Trial é vinculado ao hardware (não pode reinstalar para ganhar mais dias)

**Abordagem técnica:**

Trial salvo em `config`: `trial_start = "YYYY-MM-DD"`, `trial_machine_id = fingerprint`.

Fingerprint do hardware: comando Rust que combina hostname + ID da CPU (via `sysinfo` crate ou `machine-uid` crate).

`trial_start` é verificado no startup. Se `trial_machine_id != current_fingerprint`, considera expirado.

---

## Banco de dados — todas as migrations

```
migrations/
  001_init.sql          ✅ v1: produtos, vendas, despesas, config
  002_multi_itens.sql   ✅ v2: venda_itens, venda_extras, tipo_venda
  003_pagamento.sql     ✅ v3 (Fase 1.1): forma_pagamento, status_pagamento
  004_entrega.sql       ✅ v4 (Fase 1.3): status_entrega, hora_pedido
  005_clientes.sql      ✅ v5 (Fase 1.2): tabela clientes, cliente_id em vendas
  006_produtos.sql      ✅ v6 (Fase 2.2): disponivel_hoje em produtos
  007_trial.sql         📋 Fase 3.3: trial_start, trial_machine_id em config
```

---

## Fora do escopo (decidido explicitamente)

| Item | Motivo |
|---|---|
| App mobile nativo | Complexidade alta; o dashboard web (Fase 3.1) cobre 80% da necessidade |
| Nota fiscal NFC-e | Integração com SEFAZ é complexa e regulatória; fora do MVP comercial |
| Integração WhatsApp direta | API oficial custa $$$; workaround via texto copiado é suficiente por enquanto |
| Multi-empresa / rede de marmitarias | Requer SaaS com backend cloud; fora do horizonte atual |
| Controle de estoque | Diferente do problema de faturamento; seria um produto separado |

---

## Ordem de implementação sugerida

```
0.2 Onboarding          ✅ concluído
0.1 Sistema de licença  ✅ concluído
1.1 Pagamento/venda     ✅ concluído
1.3 Operação do dia     ✅ concluído
1.2 Cadastro clientes   ✅ concluído
2.1 Alertas             ✅ concluído
2.2 Cardápio dinâmico   ✅ concluído
2.3 Empty states        ✅ concluído
3.3 Trial 14 dias       ← converte visitantes da landing em usuários
3.2 Landing page        ← canal de aquisição
3.1 Dashboard web       ← diferencial premium (feature de tier Pro)
```
