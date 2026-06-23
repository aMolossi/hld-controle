import { useEffect, useState } from "react";
import { query } from "../lib/db";
import { formatBRL, formatPct } from "../lib/format";
import type { Produto } from "../lib/types";

const DIAS = 26;
const VOLS = [30, 50, 75, 100, 125, 150, 175, 200];
const DELTAS = [-20, -15, -10, -5, 0, 5, 10, 15, 20];

export default function Precificacao() {
  const [custoFixo, setCustoFixo] = useState("0");
  const [custoVar, setCustoVar] = useState("0");
  const [precoMedio, setPrecoMedio] = useState("0");
  const [volDia, setVolDia] = useState("100");

  useEffect(() => {
    async function prefill() {
      const prods = await query<Produto>(
        "SELECT * FROM produtos WHERE ativo=1 ORDER BY ordem"
      );
      if (prods.length) {
        const ap = prods.reduce((s, p) => s + p.preco, 0) / prods.length;
        const ac = prods.reduce((s, p) => s + p.custo, 0) / prods.length;
        setPrecoMedio(ap.toFixed(2));
        setCustoVar(ac.toFixed(2));
      }

      const cfRows = await query<{ total: number }>(
        "SELECT COALESCE(SUM(valor),0) as total FROM despesas WHERE tipo='fixo' AND data >= date('now','-30 days')"
      );
      if ((cfRows[0]?.total ?? 0) > 0) setCustoFixo(cfRows[0].total.toFixed(2));

      const vdRows = await query<{ m: number }>(
        "SELECT COALESCE(AVG(d),0) as m FROM (SELECT data, SUM(qtd_marmitas) as d FROM vendas WHERE data >= date('now','-30 days') GROUP BY data)"
      );
      if ((vdRows[0]?.m ?? 0) > 0) setVolDia(Math.round(vdRows[0].m).toString());
    }
    prefill();
  }, []);

  const cf = parseFloat(custoFixo.replace(",", ".")) || 0;
  const cv = parseFloat(custoVar.replace(",", ".")) || 0;
  const pm = parseFloat(precoMedio.replace(",", ".")) || 0;
  const vd = parseFloat(volDia.replace(",", ".")) || 0;

  const mc = pm - cv;
  const mcPct = pm > 0 ? mc / pm : 0;
  const peqMes = mc > 0 && cf > 0 ? cf / mc : 0;
  const peqDia = peqMes / DIAS;

  const volMes = vd * DIAS;
  const fat = pm * volMes;
  const cvTot = cv * volMes;
  const lucro = fat - cvTot - cf;
  const margem = fat > 0 ? lucro / fat : 0;
  const folga = peqDia > 0 ? vd - peqDia : 0;

  const nearestPeqVol =
    peqDia > 0
      ? VOLS.reduce((a, b) =>
          Math.abs(b - peqDia) < Math.abs(a - peqDia) ? b : a
        )
      : -1;

  function simRow(vol: number) {
    const vm = vol * DIAS;
    const f = pm * vm;
    const l = f - cv * vm - cf;
    return { vol, vm, f, l, m: f > 0 ? l / f : 0 };
  }

  function priceRow(delta: number) {
    const p = pm * (1 + delta / 100);
    const f = p * volMes;
    const l = f - cvTot - cf;
    return { delta, p, f, l, m: f > 0 ? l / f : 0 };
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Precificação</div>
          <div className="page-sub">
            Ponto de equilíbrio, simulação de volume e sensibilidade de preço
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Parâmetros</span>
          <span className="field-hint">
            Pré-preenchido com dados atuais — ajuste conforme necessário
          </span>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Custos fixos mensais (R$)</label>
            <input
              type="number"
              step="50"
              min="0"
              value={custoFixo}
              onChange={(e) => setCustoFixo(e.target.value)}
            />
            <span className="field-hint">
              Aluguel, salarios, energia, gas, etc.
            </span>
          </div>
          <div className="field">
            <label>Custo variável por marmita (R$)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={custoVar}
              onChange={(e) => setCustoVar(e.target.value)}
            />
            <span className="field-hint">Ingredientes + embalagem (média)</span>
          </div>
          <div className="field">
            <label>Preco medio por marmita (R$)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={precoMedio}
              onChange={(e) => setPrecoMedio(e.target.value)}
            />
            <span className="field-hint">Média ponderada P/M/G</span>
          </div>
          <div className="field">
            <label>Volume médio diário (marmitas/dia)</label>
            <input
              type="number"
              step="5"
              min="1"
              value={volDia}
              onChange={(e) => setVolDia(e.target.value)}
            />
            <span className="field-hint">Vendas médias por dia ({DIAS} dias úteis/mês)</span>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className={"kpi " + (mc > 0 ? "gold" : mc < 0 ? "bad" : "")}>
          <div className="kpi-label">Margem de contribuição</div>
          <div className="kpi-value">{pm > 0 ? formatBRL(mc) : "—"}</div>
          <div className="kpi-sub">
            {pm > 0
              ? formatPct(mcPct) + " sobre o preço de venda"
              : "Informe preço e custo"}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Ponto de equilíbrio</div>
          <div className="kpi-value">
            {peqDia > 0 ? Math.ceil(peqDia) + " /dia" : "—"}
          </div>
          <div className="kpi-sub">
            {peqMes > 0
              ? Math.ceil(peqMes) + " marmitas/mês · " + DIAS + " dias úteis"
              : cf === 0
              ? "Informe o custo fixo mensal"
              : mc <= 0
              ? "Custo variável ≥ preço — impossível"
              : "—"}
          </div>
        </div>

        <div
          className={
            "kpi " + (lucro > 0 ? "good" : lucro < 0 ? "bad" : "")
          }
        >
          <div className="kpi-label">Lucro no volume atual</div>
          <div className={"kpi-value " + (lucro >= 0 ? "pos" : "neg")}>
            {fat > 0 ? formatBRL(lucro) : "—"}
          </div>
          <div className="kpi-sub">
            {fat > 0
              ? formatPct(margem) +
                " margem · " +
                Math.round(vd) +
                " marm/dia"
              : "Informe os parâmetros"}
          </div>
        </div>

        <div
          className={
            "kpi " + (folga > 0 ? "good" : folga < 0 ? "bad" : "")
          }
        >
          <div className="kpi-label">Folga sobre equilíbrio</div>
          <div
            className={
              "kpi-value " +
              (folga > 0 ? "pos" : folga < 0 ? "neg" : "")
            }
          >
            {peqDia > 0
              ? (folga >= 0 ? "+" : "") + Math.round(folga) + " /dia"
              : "—"}
          </div>
          <div className="kpi-sub">
            {peqDia > 0
              ? folga >= 0
                ? "Acima do equilíbrio"
                : "Abaixo do equilíbrio — prejuízo"
              : ""}
          </div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-head">
          <span className="card-title">Simulação de volume</span>
          <span className="field-hint">
            Resultado projetado para diferentes volumes diários ({DIAS} dias/mês)
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Marm./dia</th>
                <th className="t-right">Marm./mes</th>
                <th className="t-right">Faturamento</th>
                <th className="t-right">Custo variavel</th>
                <th className="t-right">Custo fixo</th>
                <th className="t-right">Lucro</th>
                <th className="t-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {VOLS.map((vol) => {
                const row = simRow(vol);
                const isCurrent = Math.round(vd) === vol;
                const isPeq = nearestPeqVol === vol;
                return (
                  <tr
                    key={vol}
                    style={{
                      background: isCurrent
                        ? "rgba(91,189,126,0.07)"
                        : isPeq
                        ? "rgba(207,171,88,0.09)"
                        : undefined,
                    }}
                  >
                    <td>
                      <strong
                        style={{
                          color: isCurrent
                            ? "var(--gold-bright)"
                            : undefined,
                        }}
                      >
                        {vol}
                      </strong>
                      {isCurrent && (
                        <span
                          className="pill pill-rec"
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            padding: "1px 6px",
                          }}
                        >
                          atual
                        </span>
                      )}
                      {isPeq && !isCurrent && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            padding: "1px 6px",
                            display: "inline-flex",
                            alignItems: "center",
                            background: "rgba(207,171,88,0.18)",
                            color: "var(--gold)",
                            border: "1px solid rgba(207,171,88,0.4)",
                            borderRadius: 999,
                            fontWeight: 700,
                          }}
                        >
                          equilibrio
                        </span>
                      )}
                    </td>
                    <td className="t-right muted">{row.vm}</td>
                    <td className="t-right">{formatBRL(row.f)}</td>
                    <td className="t-right muted">{formatBRL(cv * row.vm)}</td>
                    <td className="t-right muted">{formatBRL(cf)}</td>
                    <td
                      className={
                        "t-right " + (row.l >= 0 ? "pos" : "neg")
                      }
                    >
                      {row.l >= 0 ? "+" : ""}
                      {formatBRL(row.l)}
                    </td>
                    <td
                      className={
                        "t-right " + (row.m >= 0 ? "pos" : "neg")
                      }
                    >
                      {formatPct(row.m)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-head">
          <span className="card-title">Sensibilidade de preço</span>
          <span className="field-hint">
            Impacto de variações no preço médio com volume fixo de{" "}
            {Math.round(vd)} marmitas/dia
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Variacao</th>
                <th className="t-right">Preco medio</th>
                <th className="t-right">Faturamento</th>
                <th className="t-right">Lucro</th>
                <th className="t-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {DELTAS.map((d) => {
                const row = priceRow(d);
                return (
                  <tr
                    key={d}
                    style={{
                      background:
                        d === 0
                          ? "rgba(207,171,88,0.08)"
                          : undefined,
                    }}
                  >
                    <td>
                      <span
                        className={
                          d < 0 ? "neg" : d > 0 ? "pos" : "muted"
                        }
                      >
                        {d > 0 ? "+" : ""}
                        {d}%
                      </span>
                      {d === 0 && (
                        <span
                          className="pill pill-rec"
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            padding: "1px 6px",
                          }}
                        >
                          atual
                        </span>
                      )}
                    </td>
                    <td className="t-right">{formatBRL(row.p)}</td>
                    <td className="t-right">{formatBRL(row.f)}</td>
                    <td
                      className={
                        "t-right " + (row.l >= 0 ? "pos" : "neg")
                      }
                    >
                      {row.l >= 0 ? "+" : ""}
                      {formatBRL(row.l)}
                    </td>
                    <td
                      className={
                        "t-right " + (row.m >= 0 ? "pos" : "neg")
                      }
                    >
                      {formatPct(row.m)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
