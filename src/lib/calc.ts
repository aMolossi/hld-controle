import { query } from "./db";
import type { Period } from "./dates";
import { formatBRL, formatPct } from "./format";

export interface Resumo {
  faturamento: number;
  pedidos: number;
  marmitas: number;
  ticketMedio: number;
  custos: number;
  lucro: number;
  margem: number; // fracao (lucro / faturamento)
  novos: number;
  recorrentes: number;
  recorrencia: number; // fracao recorrentes / clientes
}

export async function getResumo(p: Period): Promise<Resumo> {
  const v = await query<{ faturamento: number; pedidos: number; marmitas: number }>(
    "SELECT COALESCE(SUM(total),0) AS faturamento, COUNT(*) AS pedidos, COALESCE(SUM(qtd_marmitas),0) AS marmitas FROM vendas WHERE data BETWEEN ? AND ?",
    [p.inicio, p.fim],
  );
  const d = await query<{ custos: number }>(
    "SELECT COALESCE(SUM(valor),0) AS custos FROM despesas WHERE data BETWEEN ? AND ?",
    [p.inicio, p.fim],
  );
  const c = await query<{ tipo_cliente: string | null; qtd: number }>(
    "SELECT tipo_cliente, COUNT(*) AS qtd FROM vendas WHERE data BETWEEN ? AND ? GROUP BY tipo_cliente",
    [p.inicio, p.fim],
  );

  const faturamento = v[0]?.faturamento ?? 0;
  const pedidos = v[0]?.pedidos ?? 0;
  const marmitas = v[0]?.marmitas ?? 0;
  const custos = d[0]?.custos ?? 0;
  const lucro = faturamento - custos;

  let novos = 0;
  let recorrentes = 0;
  for (const r of c) {
    if (r.tipo_cliente === "Recorrente") recorrentes += r.qtd;
    else if (r.tipo_cliente === "Novo") novos += r.qtd;
  }
  const baseCli = novos + recorrentes;

  return {
    faturamento,
    pedidos,
    marmitas,
    ticketMedio: pedidos ? faturamento / pedidos : 0,
    custos,
    lucro,
    margem: faturamento ? lucro / faturamento : 0,
    novos,
    recorrentes,
    recorrencia: baseCli ? recorrentes / baseCli : 0,
  };
}

export interface DiaPonto {
  dia: string;
  faturamento: number;
  pedidos: number;
}

export async function faturamentoPorDia(p: Period): Promise<DiaPonto[]> {
  return query<DiaPonto>(
    "SELECT data AS dia, COALESCE(SUM(total),0) AS faturamento, COUNT(*) AS pedidos FROM vendas WHERE data BETWEEN ? AND ? GROUP BY data ORDER BY data",
    [p.inicio, p.fim],
  );
}

export interface TamanhoPonto {
  tamanho: string;
  qtd: number;
  valor: number;
}

export async function vendasPorTamanho(p: Period): Promise<TamanhoPonto[]> {
  return query<TamanhoPonto>(
    "SELECT vi.tamanho AS tamanho, COALESCE(SUM(vi.quantidade),0) AS qtd, COALESCE(SUM(vi.subtotal),0) AS valor FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id WHERE v.data BETWEEN ? AND ? GROUP BY vi.tamanho ORDER BY vi.tamanho",
    [p.inicio, p.fim],
  );
}

export interface OrigemPonto {
  origem: string;
  qtd: number;
}

export async function vendasPorOrigem(p: Period): Promise<OrigemPonto[]> {
  return query<OrigemPonto>(
    "SELECT COALESCE(NULLIF(origem,''),'(sem origem)') AS origem, COUNT(*) AS qtd FROM vendas WHERE data BETWEEN ? AND ? GROUP BY origem ORDER BY qtd DESC",
    [p.inicio, p.fim],
  );
}

export interface CategoriaPonto {
  categoria: string;
  total: number;
}

export async function despesasPorCategoria(p: Period): Promise<CategoriaPonto[]> {
  return query<CategoriaPonto>(
    "SELECT categoria, COALESCE(SUM(valor),0) AS total FROM despesas WHERE data BETWEEN ? AND ? GROUP BY categoria ORDER BY total DESC",
    [p.inicio, p.fim],
  );
}

export async function getReceber(p: Period): Promise<number> {
  const rows = await query<{ total: number }>(
    "SELECT COALESCE(SUM(total),0) AS total FROM vendas WHERE data BETWEEN ? AND ? AND status_pagamento = 'pendente'",
    [p.inicio, p.fim],
  );
  return rows[0]?.total ?? 0;
}

export interface ClienteResumo {
  id: number;
  nome: string;
  telefone: string | null;
  bairro: string | null;
  total_pedidos: number;
  total_gasto: number;
  ultima_compra: string | null;
}

export interface Alerta {
  tipo: "equilibrio" | "margem" | "fiados" | "sem_vendas";
  severidade: "aviso" | "critico";
  mensagem: string;
  acao?: { label: string; rota: string };
}

/** Retorna os dias úteis (seg–sex) anteriores como strings ISO. */
function lastBusinessDays(n: number): string[] {
  const days: string[] = [];
  const d = new Date();
  while (days.length < n) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
  }
  return days;
}

export async function getAlertas(): Promise<Alerta[]> {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const diaAtual = hoje.getDate();

  const inicioMes = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prevMesDate = new Date(y, m - 1, 1);
  const inicioPrevMes = `${prevMesDate.getFullYear()}-${String(prevMesDate.getMonth() + 1).padStart(2, "0")}-01`;
  const diasUteis = lastBusinessDays(2);

  const [fatMes, despMes, fatPrevMes, despPrevMes, fiados, produtos, cfgRows, vendasRecentes] =
    await Promise.all([
      query<{ v: number }>(
        "SELECT COALESCE(SUM(total),0) AS v FROM vendas WHERE data >= ?",
        [inicioMes],
      ),
      query<{ v: number }>(
        "SELECT COALESCE(SUM(valor),0) AS v FROM despesas WHERE data >= ?",
        [inicioMes],
      ),
      query<{ v: number }>(
        "SELECT COALESCE(SUM(total),0) AS v FROM vendas WHERE data >= ? AND data < ?",
        [inicioPrevMes, inicioMes],
      ),
      query<{ v: number }>(
        "SELECT COALESCE(SUM(valor),0) AS v FROM despesas WHERE data >= ? AND data < ?",
        [inicioPrevMes, inicioMes],
      ),
      query<{ v: number }>(
        "SELECT COALESCE(SUM(total),0) AS v FROM vendas WHERE status_pagamento='pendente'",
      ),
      query<{ preco: number; custo: number }>(
        "SELECT preco, custo FROM produtos WHERE ativo=1",
      ),
      query<{ chave: string; valor: string }>(
        "SELECT chave, valor FROM config WHERE chave LIKE 'alerta_%'",
      ),
      diasUteis.length >= 2
        ? query<{ id: number }>(
            "SELECT id FROM vendas WHERE data IN (?,?) LIMIT 1",
            [diasUteis[0], diasUteis[1]],
          )
        : Promise.resolve([{ id: 1 }]), // skip on first business days of month
    ]);

  const cfg: Record<string, string> = {};
  for (const r of cfgRows) cfg[r.chave] = r.valor;

  const alertas: Alerta[] = [];

  // ---- Tipo 3: Fiados acumulados ----
  const fiadoThreshold = parseFloat(cfg["alerta_fiado_threshold"] || "200");
  const totalFiados = fiados[0]?.v ?? 0;
  if (totalFiados > fiadoThreshold) {
    alertas.push({
      tipo: "fiados",
      severidade: totalFiados > fiadoThreshold * 3 ? "critico" : "aviso",
      mensagem: `${formatBRL(totalFiados)} em vendas fiadas pendentes de cobrança`,
      acao: { label: "Ver fiados", rota: "/vendas" },
    });
  }

  // ---- Tipo 4: Sem vendas nos últimos 2 dias úteis ----
  if (vendasRecentes.length === 0 && diaAtual > 2) {
    alertas.push({
      tipo: "sem_vendas",
      severidade: "aviso",
      mensagem: "Nenhuma venda registrada nos últimos 2 dias úteis",
      acao: { label: "Lançar venda", rota: "/vendas" },
    });
  }

  // ---- Tipo 1: Abaixo do equilíbrio ----
  if (produtos.length > 0) {
    const precoMedio = produtos.reduce((s, p) => s + p.preco, 0) / produtos.length;
    const custoVar = produtos.reduce((s, p) => s + p.custo, 0) / produtos.length;
    const mc = precoMedio - custoVar;
    const custosFixos = despMes[0]?.v ?? 0;

    if (mc > 0 && custosFixos > 0 && precoMedio > 0) {
      const peqMes = custosFixos / mc;
      const fatNecessario = peqMes * precoMedio * Math.min(diaAtual / 26, 1);
      const fatAtual = fatMes[0]?.v ?? 0;
      if (fatAtual < fatNecessario * 0.85) {
        alertas.push({
          tipo: "equilibrio",
          severidade: "critico",
          mensagem: `Abaixo do equilíbrio: ${formatBRL(fatAtual)} de ${formatBRL(fatNecessario)} esperados até hoje`,
          acao: { label: "Ver Precificação", rota: "/precificacao" },
        });
      }
    }
  }

  // ---- Tipo 2: Margem caindo ----
  const fatCurr = fatMes[0]?.v ?? 0;
  const despCurr = despMes[0]?.v ?? 0;
  const fatPrev = fatPrevMes[0]?.v ?? 0;
  const despPrev = despPrevMes[0]?.v ?? 0;

  if (fatCurr > 100 && fatPrev > 100) {
    const margemCurr = (fatCurr - despCurr) / fatCurr;
    const margemPrev = (fatPrev - despPrev) / fatPrev;
    if (margemPrev > 0 && margemCurr < margemPrev * 0.8) {
      alertas.push({
        tipo: "margem",
        severidade: "aviso",
        mensagem: `Margem caiu para ${formatPct(margemCurr)} (era ${formatPct(margemPrev)} no mês anterior, queda > 20%)`,
        acao: { label: "Ver Precificação", rota: "/precificacao" },
      });
    }
  }

  // Críticos primeiro
  alertas.sort((a, b) => (a.severidade === "critico" ? -1 : 1) - (b.severidade === "critico" ? -1 : 1));
  return alertas;
}

export async function getClientesResumo(): Promise<ClienteResumo[]> {
  return query<ClienteResumo>(
    `SELECT c.id, c.nome, c.telefone, c.bairro,
       COUNT(v.id)              AS total_pedidos,
       COALESCE(SUM(v.total),0) AS total_gasto,
       MAX(v.data)              AS ultima_compra
     FROM clientes c
     LEFT JOIN vendas v ON v.cliente_id = c.id
     GROUP BY c.id
     ORDER BY total_gasto DESC`,
  );
}
