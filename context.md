# HubControl — Contexto do Projeto

App desktop Windows para controle de vendas, despesas e lucro da **HLD Marmitaria Delivery** (Sinop-MT).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Desktop | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| Banco | SQLite via `tauri-plugin-sql` (arquivo local) |
| Gráficos | Recharts |
| Atualizações | `tauri-plugin-updater` + minisign |
| Instalador | NSIS (Windows x64) |

---

## Identidade

- **Nome:** HubControl (antes "HLD Controle")
- **Ícone:** "HC" em dourado sobre fundo escuro arredondado
  - Gerado com `PowerShell System.Drawing` → `src-tauri/icons/source.png` (1024×1024)
  - Todos os tamanhos via `npx tauri icon src-tauri\icons\source.png`
- **Paleta CSS:**
  ```
  --gold:       #cfab58
  --gold-bright:#fae7a3
  --gold-deep:  #966c2a
  --black:      #0e0b07
  --red:        #c5341f
  --cream:      #f6ebd7
  ```
- **Sidebar:** marca "HC" + "HubControl / Gestao inteligente"

---

## Versões

| Versão | Data | O que mudou |
|---|---|---|
| 0.1.0 | — | MVP inicial (Dashboard, Vendas simples, Despesas) |
| 0.2.0 | — | Vendas multi-item, tipo Empresa, extras com quantidade |
| 0.3.0 | 2026-06-23 | Ícone HC, renomeado para HubControl, calculadora de precificação, limpeza de arquivos starter |
| 0.4.0 | 2026-06-23 | Onboarding wizard, rastreamento de pagamento (PIX/Fiado), cadastro de clientes, tela Hoje (operação do dia), alertas inteligentes no Dashboard |

---

## Arquitetura de arquivos relevantes

```
App Controle/
├── index.html                        # título <title>HubControl</title>
├── package.json                      # name:"hub-control", version:"0.3.0"
├── vite.config.ts
├── scripts/
│   └── release.ps1                   # publica release no GitHub (build + assinar + gh release)
├── src/
│   ├── main.tsx                      # router HashRouter com todas as rotas
│   ├── App.tsx                       # layout principal: sidebar + outlet
│   ├── theme.css                     # design system completo (tokens, componentes)
│   ├── components/
│   │   ├── icons.tsx                 # SVG: Dashboard, Cart, Wallet, Pricing, Gear, Calendar, Check, Users
│   │   ├── AlertaBanner.tsx          # banners dismissíveis de alertas do Dashboard (v0.4.0)
│   │   ├── KpiCard.tsx
│   │   ├── Modal.tsx
│   │   └── PeriodFilter.tsx
│   ├── lib/
│   │   ├── db.ts                     # singleton SQLite (getDb / query / exec)
│   │   ├── types.ts                  # interfaces + constantes; v0.4.0 adicionou Cliente, FORMAS_PAGAMENTO, campos em Venda
│   │   ├── calc.ts                   # funções de cálculo; v0.4.0 adicionou getReceber, getAlertas, getClientesResumo
│   │   ├── format.ts                 # formatBRL, formatPct, formatDateBR
│   │   ├── dates.ts                  # utilitários de data
│   │   ├── backup.ts                 # backup automático via VACUUM INTO
│   │   └── update.ts                 # checa e instala atualização (tauri-plugin-updater)
│   └── pages/
│       ├── Dashboard.tsx             # KPIs + gráficos + AlertaBanner + KPI "A receber"
│       ├── Onboarding.tsx            # wizard 3 etapas; rota /onboarding fora do App shell (v0.4.0)
│       ├── Hoje.tsx                  # tela /hoje: pedidos do dia, status entrega, resumo produção (v0.4.0)
│       ├── Clientes.tsx              # CRM leve: tabela, histórico, CRUD, exportar CSV (v0.4.0)
│       ├── Vendas.tsx                # CRUD de vendas; v0.4.0 adicionou pagamento, entrega, cliente_id
│       ├── Despesas.tsx              # CRUD de despesas (fixo/variável)
│       ├── Precificacao.tsx          # calculadora de precificação (v0.3.0)
│       └── Config.tsx                # configurações, backup, alertas, restauração
└── src-tauri/
    ├── tauri.conf.json               # productName, version, identifier, updater
    ├── Cargo.toml                    # crate interno (hld-controle)
    ├── icons/
    │   └── source.png                # fonte 1024×1024 para gerar todos os ícones
    ├── migrations/
    │   ├── 001_init.sql              # schema v1: produtos, vendas, despesas, config
    │   ├── 002_multi_itens.sql       # schema v2: venda_itens, extras com qtd, tipo_venda
    │   ├── 003_pagamento.sql         # schema v3 (v0.4.0): forma_pagamento, status_pagamento
    │   ├── 004_entrega.sql           # schema v4 (v0.4.0): status_entrega, hora_pedido
    │   └── 005_clientes.sql          # schema v5 (v0.4.0): tabela clientes, cliente_id em vendas
    └── src/
        └── lib.rs                    # comandos Rust: backup, restore, list_backups, prune; migrations v1–v5
```

---

## Banco de dados

**Localização:** `%APPDATA%\com.hubcontrol.app\hld.db`
**Backups:** `%APPDATA%\com.hubcontrol.app\backups\`

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `produtos` | Catálogo de marmitas (P/M/G): tamanho, nome, preco, custo, ativo, ordem |
| `vendas` | Cabeçalho de cada pedido: data, cliente, bairro, origem, tipo_venda, totais |
| `venda_itens` | Linhas da venda (vários tamanhos/qtd por pedido) |
| `venda_extras` | Extras da venda (bebida, sobremesa, etc.) com quantidade e preço unitário |
| `despesas` | Saídas financeiras: categoria, valor, tipo (fixo/variável), recorrente |
| `despesa_categorias` | Dropdown gerenciável de categorias |
| `leads` | Schema pronto, sem UI no MVP |
| `clientes` | CRM leve: nome, telefone, bairro, origem, obs, criado_em (v0.4.0) |
| `config` | Chave/valor: `margem_meta`, `marca_nome`, `setup_complete`, `alerta_*` |

### Migrações (Rust `lib.rs`)

As migrações são embutidas em tempo de compilação via `include_str!()` e executadas pelo `tauri-plugin-sql` na abertura do banco:
- `v1` — schema inicial + seeds (3 produtos padrão, 15 categorias de despesa)
- `v2` — suporte a multi-item, quantidades em extras, tipo Empresa, `qtd_marmitas`, `itens_resumo`
- `v3` — `forma_pagamento` e `status_pagamento` em `vendas` (Fase 1.1)
- `v4` — `status_entrega` e `hora_pedido` em `vendas` (Fase 1.3)
- `v5` — tabela `clientes` e `cliente_id` em `vendas` (Fase 1.2)

### Restauração de backup

Fluxo: `Config.tsx` chama `restore_backup(src)` → Rust escreve `hld.db.restore` → no próximo start, o hook `.setup()` em `lib.rs` substitui o `hld.db` antes de qualquer conexão.

---

## Telas

### Dashboard
KPIs do período (faturamento, despesas, lucro, margem, ticket médio, marmitas). Gráfico de linha Recharts. Filtro de período (Hoje / 7d / 30d / Mês / Personalizado).

### Vendas
Listagem + modal de novo pedido. Suporta:
- **Avulso:** um ou mais itens (tamanho + qtd), extras opcionais
- **Empresa:** campo empresa + periodicidade (Semanal/Mensal)
- Campos: cliente, telefone, bairro (25 bairros de Sinop-MT), origem (Meta Ads, Instagram, WhatsApp, etc.), tipo_cliente (Novo/Recorrente), obs

### Despesas
Listagem + modal. Campos: data, categoria (dropdown gerenciável), descrição, valor, tipo (fixo/variável), recorrente.

### Precificacao (v0.3.0)

Calculadora de break-even com 4 parâmetros editáveis, pré-preenchidos do banco:
- Custo fixo mensal → `SUM(despesas WHERE tipo='fixo' AND data >= -30d)`
- Custo variável/marmita → média do campo `custo` dos produtos ativos
- Preço médio → média do campo `preco` dos produtos ativos
- Volume médio diário → `AVG(qtd_marmitas por dia dos últimos 30d)`

**Fórmulas:**
```
mc      = precoMedio - custoVar
mcPct   = mc / precoMedio
peqMes  = custoFixo / mc
peqDia  = peqMes / 26          (26 dias úteis/mês)
lucro   = faturamento - custoVar*volMes - custoFixo
margem  = lucro / faturamento
folga   = volDia - peqDia
```

**Seções da tela:**
1. Card de parâmetros (4 inputs numéricos, live)
2. 4 KPIs: margem de contribuição, ponto de equilíbrio, lucro atual, folga
3. Tabela de simulação de volume (30→200 marm/dia) — linha atual verde, linha equilíbrio dourada
4. Tabela de sensibilidade de preço (-20% a +20%) — linha atual (0%) dourada

### Configurações
- Editar produtos (P/M/G: nome, preço, custo)
- Backup manual + lista de backups para restaurar
- Botão "Verificar atualizações" (usa `tauri-plugin-updater`)

---

## Build e publicação

### Pré-requisitos
```powershell
# Rust não está no PATH por padrão — injetar antes de qualquer build:
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
```

### Dev
```powershell
npm run tauri dev
```

### Publicar nova versão
```powershell
npm run release -- -Version X.Y.Z
npm run release -- -Version X.Y.Z -Notes "Descrição da mudança"
```

O script `scripts/release.ps1`:
1. Atualiza `version` em `tauri.conf.json` e `package.json`
2. Compila com `npm run tauri build` (injeta `TAURI_SIGNING_PRIVATE_KEY` da chave minisign)
3. Lê a assinatura `.sig` gerada
4. Gera `latest.json` com versão, notas, data, URL e assinatura
5. Publica `gh release create v{Version}` com os 3 assets
6. Commita e faz push do bump de versão

**Assets gerados:**
- `HubControl_X.Y.Z_x64-setup.exe` — instalador NSIS
- `HubControl_X.Y.Z_x64-setup.exe.sig` — assinatura minisign
- `latest.json` — manifesto de auto-update

### Chave de assinatura (NUNCA perder ou commitar)
```
%USERPROFILE%\.tauri\hld_updater.key
%USERPROFILE%\.tauri\hld_updater.pass
```

### Auto-update
O app verifica ao abrir se há nova versão em:
```
https://github.com/aMolossi/hld-controle/releases/latest/download/latest.json
```
Se disponível, baixa e instala silenciosamente. O usuário só precisa reabrir o app.

---

## Repositório GitHub

**Repo:** `github.com/aMolossi/hld-controle` (público — necessário para o updater)
**Identificador do app:** `com.hubcontrol.app`

> O identificador foi trocado de `com.hld.controle` (v0.2.0) para `com.hubcontrol.app` (v0.3.0). Isso cria um novo diretório de dados no AppData, efetivamente zerando o banco anterior.

---

## Instalação / implantação

1. Baixar o instalador da release mais recente no GitHub
2. Executar `HubControl_X.Y.Z_x64-setup.exe`
3. Atualizações futuras são automáticas — o app detecta e instala ao abrir

**PC de desenvolvimento:** `d:\Cliente\HLD Marmitaria\App Controle`
**PC da marmitaria:** instala via NSIS, atualiza automaticamente via GitHub Releases
