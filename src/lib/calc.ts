import { query } from "./db";
import type { Period } from "./dates";

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
