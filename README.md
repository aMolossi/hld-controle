# HubControl

Aplicativo desktop (Windows) para controle de **entradas e saídas** da HLD Marmitaria
Delivery: lançamento de vendas e despesas, filtros por período, dashboard com
faturamento, **lucro real**, margem, **calculadora de precificação** com ponto de
equilíbrio e simulações de volume. Roda 100% local — sem internet, sem servidor,
sem mensalidade.

---

## Stack / arquitetura

| Camada | Tecnologia |
|---|---|
| Shell desktop | **Tauri 2** (Rust) — app nativo leve, usa o WebView2 do Windows |
| Interface | **React 19 + TypeScript + Vite** |
| Gráficos | **Recharts** |
| Navegação | **react-router-dom** (hash router) |
| Banco de dados | **SQLite** local via `tauri-plugin-sql` |
| Identidade visual | CSS com a paleta da marca (dourado/preto quente/creme) |

---

## Rodar em desenvolvimento

Pré-requisitos: Node.js, Rust (toolchain MSVC) e o WebView2 — já instalados nesta máquina.

```bash
# Rust precisa estar no PATH na sessão atual:
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

npm install          # uma vez
npm run tauri dev    # abre o app com hot-reload
```

## Gerar o instalador (.exe)

```bash
npm run tauri build
```

O instalador NSIS é gerado em:

```
src-tauri/target/release/bundle/nsis/HubControl_0.3.0_x64-setup.exe
```

---

## Publicar uma atualização (a marmitaria recebe sozinha)

Depois de corrigir o código aqui, rode **um comando**:

```bash
npm run release -- -Version 0.3.1 -Notes "O que mudou nesta versão"
```

Isso sobe a versão, compila o instalador **assinado**, gera o `latest.json` e publica em
**GitHub Releases** (`github.com/aMolossi/hld-controle`). O app instalado na marmitaria
verifica ao abrir e **se atualiza sozinho**.

- **Chave de assinatura**: `%USERPROFILE%\.tauri\hld_updater.key` (+ `.pass`). **Guarde com
  cuidado** — sem ela não é possível assinar novas atualizações. Não vai para o git.
- **Primeira vez**: instale a v0.3.0 manualmente (ela já traz o auto-update);
  da próxima em diante é automático.
- Verificação/instalação manual também em **Configurações → Atualizações**.

## Backup de dados

- **Automático**: a cada abertura do app, uma cópia datada é salva em
  `%APPDATA%\com.hubcontrol.app\backups\` (mantém as 15 mais recentes).
- **Exportar / Restaurar**: em **Configurações → Backup**. Aponte o export para uma pasta do
  Google Drive/OneDrive e tenha cópia **fora do PC**. A restauração troca o banco e reinicia
  o app.

---

## Onde ficam os dados

Banco SQLite único, criado na primeira execução em:

```
%APPDATA%\com.hubcontrol.app\hld.db
```

- **Backup**: feche o app e copie o `hld.db`.
- **Restaurar / migrar de PC**: cole o `hld.db` no mesmo caminho do outro computador.

O schema e os dados-semente (marmitas P/M/G a R$ 22/25/28 e categorias de despesa)
ficam em `src-tauri/migrations/001_init.sql`.

---

## Estrutura do projeto

```
src/
  main.tsx              rotas (hash router)
  App.tsx               shell: sidebar + navegação
  theme.css             tema da marca (tokens + componentes)
  lib/
    db.ts               conexão SQLite + helpers query/exec
    types.ts            tipos + listas (origens, bairros)
    dates.ts            períodos (hoje/7d/30d/mês/ano) e helpers ISO
    format.ts           R$, números, %, datas pt-BR
    calc.ts             agregações do dashboard (SQL)
  components/           icons, Modal, PeriodFilter, KpiCard
  pages/                Dashboard, Vendas, Despesas, Precificacao, Config
src-tauri/              backend Rust + tauri.conf.json + migrations
```

---

## Funcionalidades (v0.3.0)

- **Vendas**: lançamento com itens múltiplos (P/M/G), extras com quantidade, cliente,
  bairro, origem, tipo (Avulso/Empresa com periodicidade semanal/mensal).
- **Despesas**: lançamento por categoria (fixo/variável, recorrente), filtro por período.
- **Dashboard**: faturamento, despesas, **lucro real**, margem, ticket médio,
  recorrência; gráficos de faturamento/dia, pedidos por tamanho, origem dos clientes e
  despesas por categoria.
- **Precificação**: ponto de equilíbrio, simulação de volume (30–200 marmitas/dia),
  análise de sensibilidade de preço (-20% a +20%). Parâmetros editáveis, pré-preenchidos
  com dados reais do banco.
- **Configurações**: preço e custo unitário das marmitas (com margem atual e preço
  sugerido), margem-meta, categorias de despesa, backup e atualizações.

## Roadmap

- Importar dados reais a partir da planilha `.xlsx`.
- Exportar relatórios para Excel/PDF.
- Aba de Leads (Curiosos) com motivo de não-venda.
- Comparativo de períodos (semana/mês lado a lado).
