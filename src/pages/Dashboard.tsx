import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import type { Period } from "../lib/dates";
import { eachDay, monthRange, shortDayLabel } from "../lib/dates";
import { formatBRL, formatNum, formatPct } from "../lib/format";
import {
  getResumo,
  faturamentoPorDia,
  vendasPorTamanho,
  vendasPorOrigem,
  despesasPorCategoria,
} from "../lib/calc";
import type {
  Resumo,
  DiaPonto,
  TamanhoPonto,
  OrigemPonto,
  CategoriaPonto,
} from "../lib/calc";
import KpiCard from "../components/KpiCard";
import PeriodFilter from "../components/PeriodFilter";
import type { Preset } from "../components/PeriodFilter";
import { IconCart, IconMoney, IconUsers, IconWallet } from "../components/icons";

const GOLD = "#cfab58";
const PALETTE = [
  "#cfab58", "#fae7a3", "#966c2a", "#5bbd7e",
  "#c5341f", "#e8806f", "#b9923f", "#8a7038",
];
const axisTick = { fill: "rgba(243,234,215,0.55)", fontSize: 12 };
const tooltipStyle = {
  background: "#1b160e",
  border: "1px solid #362c1a",
  borderRadius: 10,
  color: "#f3ead7",
};

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>(monthRange());
  const [preset, setPreset] = useState<Preset>("mes");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [serieRaw, setSerieRaw] = useState<DiaPonto[]>([]);
  const [tam, setTam] = useState<TamanhoPonto[]>([]);
  const [origem, setOrigem] = useState<OrigemPonto[]>([]);
  const [despCat, setDespCat] = useState<CategoriaPonto[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getResumo(period),
      faturamentoPorDia(period),
      vendasPorTamanho(period),
      vendasPorOrigem(period),
      despesasPorCategoria(period),
    ]).then(([r, s, t, o, d]) => {
      if (!alive) return;
      setResumo(r);
      setSerieRaw(s);
      setTam(t);
      setOrigem(o);
      setDespCat(d);
    });
    return () => {
      alive = false;
    };
  }, [period]);

  const serie = useMemo(() => {
    const dias = eachDay(period);
    if (dias.length > 120) {
      return serieRaw.map((p) => ({ label: shortDayLabel(p.dia), faturamento: p.faturamento }));
    }
    const map = new Map(serieRaw.map((p) => [p.dia, p.faturamento]));
    return dias.map((d) => ({ label: shortDayLabel(d), faturamento: map.get(d) ?? 0 }));
  }, [serieRaw, period]);

  const tamData = useMemo(
    () => tam.map((t) => ({ nome: `Marmita ${t.tamanho}`, qtd: t.qtd })),
    [tam],
  );

  const r = resumo;
  const lucroPos = (r?.lucro ?? 0) >= 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visao geral do periodo selecionado</div>
        </div>
        <PeriodFilter
          period={period}
          preset={preset}
          onChange={(p, pr) => {
            setPeriod(p);
            setPreset(pr);
          }}
        />
      </div>

      <div className="kpi-grid">
        <KpiCard
          variant="gold"
          label="Faturamento"
          value={formatBRL(r?.faturamento ?? 0)}
          sub={`${formatNum(r?.pedidos ?? 0)} pedidos no periodo`}
          icon={<IconMoney />}
        />
        <KpiCard
          label="Marmitas vendidas"
          value={formatNum(r?.marmitas ?? 0)}
          sub={`${formatNum(r?.pedidos ?? 0)} pedidos`}
          icon={<IconCart />}
        />
        <KpiCard
          label="Despesas"
          value={formatBRL(r?.custos ?? 0)}
          valueClass="neg"
          sub="Total de saidas"
          icon={<IconWallet />}
        />
        <KpiCard
          variant={lucroPos ? "good" : "bad"}
          label="Lucro real"
          value={formatBRL(r?.lucro ?? 0)}
          valueClass={lucroPos ? "pos" : "neg"}
          sub="Faturamento - despesas"
          icon={<IconMoney />}
        />
        <KpiCard
          label="Margem de lucro"
          value={formatPct(r?.margem ?? 0)}
          valueClass={lucroPos ? "pos" : "neg"}
          sub="Lucro / faturamento"
        />
        <KpiCard
          label="Ticket medio"
          value={formatBRL(r?.ticketMedio ?? 0)}
          icon={<IconCart />}
        />
        <KpiCard
          label="Recorrencia"
          value={formatPct(r?.recorrencia ?? 0)}
          sub={`${formatNum(r?.novos ?? 0)} novos / ${formatNum(r?.recorrentes ?? 0)} recorrentes`}
          icon={<IconUsers />}
        />
      </div>

      <div className="card chart-card section-gap">
        <div className="card-head">
          <span className="card-title">Movimento de faturamento</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2216" vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#2a2216" }}
              minTickGap={20}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v) => formatBRL(Number(v))}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: GOLD }}
              formatter={(v) => [formatBRL(Number(v)), "Faturamento"]}
            />
            <Area
              type="monotone"
              dataKey="faturamento"
              stroke={GOLD}
              strokeWidth={2}
              fill="url(#gFat)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2 section-gap">
        <div className="card chart-card">
          <div className="card-head">
            <span className="card-title">Pedidos por tamanho</span>
          </div>
          {tamData.length === 0 ? (
            <div className="empty">Sem vendas no periodo</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tamData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#2a2216" vertical={false} />
                <XAxis dataKey="nome" tick={axisTick} tickLine={false} axisLine={{ stroke: "#2a2216" }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(207,171,88,0.08)" }}
                  formatter={(v) => [formatNum(Number(v)), "Pedidos"]}
                />
                <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                  {tamData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card chart-card">
          <div className="card-head">
            <span className="card-title">Origem dos clientes</span>
          </div>
          {origem.length === 0 ? (
            <div className="empty">Sem vendas no periodo</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={208}>
                <PieChart>
                  <Pie
                    data={origem}
                    dataKey="qtd"
                    nameKey="origem"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {origem.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v, n) => [formatNum(Number(v)), String(n)]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="legend">
                {origem.map((o, i) => (
                  <div className="legend-item" key={o.origem}>
                    <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                    {o.origem} ({o.qtd})
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {despCat.length > 0 && (
        <div className="card chart-card section-gap">
          <div className="card-head">
            <span className="card-title">Despesas por categoria</span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(180, despCat.length * 38)}>
            <BarChart data={despCat} layout="vertical" margin={{ top: 4, right: 24, left: 10, bottom: 4 }}>
              <CartesianGrid stroke="#2a2216" horizontal={false} />
              <XAxis
                type="number"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatBRL(Number(v))}
              />
              <YAxis
                type="category"
                dataKey="categoria"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={150}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(197,52,31,0.08)" }}
                formatter={(v) => [formatBRL(Number(v)), "Total"]}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="#c5341f" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}
