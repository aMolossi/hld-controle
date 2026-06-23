# HLD Controle

Aplicativo desktop (Windows) para controle de **entradas e saídas** da HLD Marmitaria
Delivery: lançamento de vendas e despesas, filtros por período e dashboard com
faturamento, **lucro real**, margem e base para precificação. Roda 100% local — sem
internet, sem servidor, sem mensalidade.

Evolução da planilha `HLD_Delivery_Metricas_v2.xlsx`: além de receita, o app passa a
controlar **custos/despesas** e calcular **lucro real** e **preço sugerido**.

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

Por que Tauri: app nativo pequeno, instalador enxuto, UI web que reproduz a identidade
da marca com fidelidade, e dados locais num único arquivo SQLite (backup = copiar o
arquivo).

---

## Rodar em desenvolvimento

Pré-requisitos: Node.js, Rust (toolchain MSVC) e o WebView2 — já instalados nesta máquina.

```bash
npm install          # uma vez
npm run tauri dev    # abre o app com hot-reload
```

## Gerar o instalador (.exe)

```bash
npm run tauri build
```

O instalador NSIS é gerado em:

```
src-tauri/target/release/bundle/nsis/HLD Controle_0.1.0_x64-setup.exe
```

Basta enviar esse `.exe` para o PC de destino e instalar com dois cliques (o WebView2 já
vem no Windows 10/11).

---

## Onde ficam os dados

Banco SQLite único, criado na primeira execução em:

```
%APPDATA%\com.hld.controle\hld.db
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
  pages/                Dashboard, Vendas, Despesas, Config
src-tauri/              backend Rust + tauri.conf.json + migrations
```

---

## Funcionalidades (MVP atual)

- **Vendas**: lançamento com tamanho (preço automático), extras dinâmicos, cliente,
  bairro, origem, tipo; lista filtrável por período; editar/excluir.
- **Despesas**: lançamento por categoria (fixo/variável, recorrente), filtro por período.
- **Dashboard**: faturamento, despesas, **lucro real**, margem, ticket médio,
  recorrência; gráficos de faturamento/dia, pedidos por tamanho, origem dos clientes e
  despesas por categoria. Filtro: hoje / 7 dias / 30 dias / mês / ano / personalizado.
- **Configurações**: preço e **custo unitário** das marmitas (com margem atual e **preço
  sugerido**), margem-meta e categorias de despesa.

## Roadmap (próximas versões)

- Calculadora de precificação completa (ponto de equilíbrio, simulações de volume).
- Importar os dados reais a partir da planilha `.xlsx`.
- Exportar relatórios para Excel/PDF.
- Aba de Leads (Curiosos) com motivo de não-venda.
- Comparativo de períodos (semana/mês lado a lado).
- Ícones e splash com a identidade da HLD.
