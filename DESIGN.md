# Design

## Theme

Dark, warm. Background é preto quente (#0e0b07 / #13100b) — não cinza neutro, não azul-escuro. A temperatura quente do fundo ancora a identidade dourada e distingue de qualquer SaaS genérico.

## Color Palette

### Brand tokens (em hex, commitados no theme.css)

| Token | Hex | Uso |
|---|---|---|
| `--gold` | `#cfab58` | Cor primária — acentos, ativo nav, card titles |
| `--gold-bright` | `#fae7a3` | Destaque — valores KPI gold, texto primário em fundo dourado |
| `--gold-deep` | `#966c2a` | Fundo botão primário (gradiente), linha de acento profundo |
| `--black` | `#0e0b07` | Fundo sidebar, fundo modal footer, preto base |
| `--red` | `#c5341f` | Negativo, despesa, perigo |
| `--cream` | `#f6ebd7` | Texto em fundos ouro (botão primário), headings |
| `--green` | `#5bbd7e` | Positivo, lucro, bom |

### Surface ramp

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#13100b` | Background principal da aplicação |
| `--surface` | `#1b160e` | Cards, tabelas, modais |
| `--surface-2` | `#221c12` | Botões secundários, inputs |
| `--line` | `#362c1a` | Bordas principais |
| `--line-soft` | `#2a2216` | Bordas sutis (separadores internos) |

### Text ramp

| Token | Hex/Valor | Uso |
|---|---|---|
| `--text` | `#f3ead7` | Texto corpo principal |
| `--text-dim` | `rgba(243,234,215,0.62)` | Labels, texto secundário, subtítulos |
| `--text-faint` | `rgba(243,234,215,0.38)` | Placeholders, dicas, texto terciário |

### Semantic colors (não tokenizados — usar valores diretos)

- Positivo: `var(--green)` #5bbd7e
- Negativo: `var(--red)` #c5341f / `#e8806f` (variante mais clara para pills)
- Neutro ativo: `var(--gold-bright)` #fae7a3

## Typography

### Famílias

- **Corpo**: `Calibri, "Segoe UI", system-ui` — fonte do sistema Windows, familiar e legível.
- **Display** (headings, KPI values, table headers): `"Arial", "Segoe UI"` — usado em h1–h3, card titles, KPI values.
- **Monospace**: não usado.

### Escala de tamanhos (em uso)

| Uso | Tamanho | Peso |
|---|---|---|
| Page title | 26px | 900 |
| Modal heading | 18px | 900 |
| Card title | 15px | 800 |
| Body | 15px | 400 |
| KPI value | 27px | 900 |
| Table header | 12.5px | 800 |
| Label / pill | 12px | 600–700 |
| Hint / sub | 11–12px | 400 |

### Características tipográficas

- Letter-spacing em títulos da sidebar: `3px` no nome da marca, `2px` no subtítulo
- `text-transform: uppercase` em labels, table headers, KPI labels
- `letter-spacing: 1px` em KPI labels
- `-webkit-font-smoothing: antialiased` no body

## Spacing & Layout

### App shell

- Sidebar: `248px` fixo, `22px 16px` padding
- Content: `26px 30px 48px` padding
- Grid: sidebar + content em `grid-template-columns: 248px 1fr`

### Espaçamento consistente

- Gap entre cards/seções: `14–18px`
- Gap entre itens de formulário: `14px`
- Padding interno de cards: `18px 20px`
- Padding interno de KPIs: `16px 18px`
- Gap da nav: `4px` entre items, `11px 13px` padding por item

### Border-radius scale

| Token | Valor | Uso |
|---|---|---|
| `--radius` | `14px` | Cards, tabelas, modais |
| `--radius-sm` | `9px` | Inputs, selects, botões menores |
| — | `10px` | Botões padrão, segmented control |
| — | `12px` | Brand mark |
| — | `16px` | Modal |

## Components

### Botões

4 variantes: `btn-primary` (gradiente dourado, texto escuro), `btn-ghost` (transparente), `btn-danger` (vermelho outline), padrão (surface-2 com borda).
3 tamanhos: padrão (`9px 16px`), `btn-sm` (`6px 11px`), `btn-icon` (`7px`, quadrado).

### KPI Cards

Grid auto-fit com mínimo 190px. Variantes semânticas: `gold`, `good`, `bad`.
**Nota**: atualmente usam `::before` side-stripe de 3px — deve ser removido no próximo polish.

### Tabelas

`table-wrap` com `overflow-x: auto`. Headers sticky, uppercase, dourado sobre preto.
Linhas pares com tint sutil (`rgba(..., 0.03)`), hover com tint dourado.

### Modais

Max-width configurável por instância (520px despesas, 640px padrão, 720px vendas).
Estrutura: `modal-head + modal-body (scroll) + modal-foot`.

### Pills / Tags

Sistema de pills para tipo de cliente (`pill-novo` verde, `pill-rec` dourado), tipo de despesa (`pill-fixo` vermelho, `pill-var` neutro), e tag de tamanho de marmita (`tag-size`).

### Gráficos (Recharts)

Tema customizado: grid `#2a2216`, eixos `rgba(243,234,215,0.55)`, tooltips `#1b160e` com borda `#362c1a`.
Paleta de dados: `["#cfab58","#fae7a3","#966c2a","#5bbd7e","#c5341f","#e8806f","#b9923f","#8a7038"]`.

### Formulários

Campo (`field`) = label + input/select/textarea + hint opcional.
Inputs: fundo `#0f0c07`, borda `--line`, focus: borda dourada + glow `rgba(207,171,88,0.15)`.

### Segmented control

`.seg` com botões internos; ativo: gradiente dourado (`--gold` → `--gold-deep`).

## Shadows

| Token | Valor | Uso |
|---|---|---|
| `--shadow` | `0 10px 30px rgba(0,0,0,0.45)` | Modais |
| `--shadow-sm` | `0 4px 14px rgba(0,0,0,0.3)` | Cards |

## Scrollbar customizada

Thumb `#2f2716`, hover `var(--gold-deep)`, borda `2px solid var(--bg)`. Largura 10px.

## Motion (atual — mínimo)

- Nav items: `transition: background 0.15s, color 0.15s`
- Inputs: `transition: border-color 0.15s, box-shadow 0.15s`
- Botões: `transition: filter 0.15s, background 0.15s, border-color 0.15s`
- Nenhum `@media (prefers-reduced-motion)` implementado — **a implementar**.
