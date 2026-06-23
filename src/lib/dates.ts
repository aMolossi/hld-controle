// Todas as datas circulam como ISO local "YYYY-MM-DD".

export interface Period {
  inicio: string;
  fim: string;
}

export const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayISO = (): string => toISO(new Date());

export const dayRange = (ref: Date = new Date()): Period => {
  const iso = toISO(ref);
  return { inicio: iso, fim: iso };
};

export const lastNDays = (n: number, ref: Date = new Date()): Period => {
  const start = new Date(ref);
  start.setDate(start.getDate() - (n - 1));
  return { inicio: toISO(start), fim: toISO(ref) };
};

export const monthRange = (ref: Date = new Date()): Period => {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  return {
    inicio: toISO(new Date(y, m, 1)),
    fim: toISO(new Date(y, m + 1, 0)),
  };
};

export const yearRange = (ref: Date = new Date()): Period => {
  const y = ref.getFullYear();
  return { inicio: toISO(new Date(y, 0, 1)), fim: toISO(new Date(y, 11, 31)) };
};

/** Lista todos os dias (ISO) do periodo, inclusivo. */
export const eachDay = (p: Period): string[] => {
  const out: string[] = [];
  const e = new Date(p.fim + "T00:00:00");
  const d = new Date(p.inicio + "T00:00:00");
  while (d <= e) {
    out.push(toISO(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
};

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "2026-06-22" -> "22/06" (rotulo curto p/ eixo de grafico) */
export const shortDayLabel = (iso: string): string => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

/** "2026-06-22" -> "22 jun" */
export const dayMonthLabel = (iso: string): string => {
  const [, m, d] = iso.split("-");
  return `${d} ${MESES[Number(m) - 1]}`;
};
