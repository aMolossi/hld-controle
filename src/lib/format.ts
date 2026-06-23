// Formatacao no padrao pt-BR (R$, numeros, %, datas)

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dec = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const safe = (v: number) => (Number.isFinite(v) ? v : 0);

/** 1234.5 -> "R$ 1.234,50" */
export const formatBRL = (v: number) => brl.format(safe(v));

/** 1234 -> "1.234" */
export const formatNum = (v: number) => dec.format(safe(v));

/** fracao 0.305 -> "30,5%" */
export const formatPct = (v: number) => pct.format(safe(v));

/** ISO "YYYY-MM-DD" -> "DD/MM/YYYY" */
export const formatDateBR = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
