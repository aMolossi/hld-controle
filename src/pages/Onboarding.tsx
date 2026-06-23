import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Produto } from "../lib/types";
import { exec, query } from "../lib/db";
import { formatBRL } from "../lib/format";

const upsertConfig = (chave: string, valor: string) =>
  exec(
    "INSERT INTO config (chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",
    [chave, valor],
  );

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nomeMarca, setNomeMarca] = useState("");
  const [cidade, setCidade] = useState("Sinop-MT");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [margem, setMargem] = useState(30);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    query<Produto>("SELECT * FROM produtos ORDER BY ordem").then(setProdutos);
  }, []);

  const setProd = (id: number, patch: Partial<Produto>) =>
    setProdutos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const concluir = async () => {
    setBusy(true);
    try {
      await upsertConfig("marca_nome", nomeMarca.trim() || "Minha Marmitaria");
      await upsertConfig("cidade", cidade.trim());
      await upsertConfig("margem_meta", String(margem / 100));
      for (const p of produtos) {
        await exec("UPDATE produtos SET nome=?, preco=?, custo=? WHERE id=?", [
          p.nome,
          p.preco,
          p.custo,
          p.id,
        ]);
      }
      await upsertConfig("setup_complete", "true");
      navigate("/dashboard");
    } finally {
      setBusy(false);
    }
  };

  const totalMC = produtos.length
    ? produtos.reduce((s, p) => s + (p.preco - p.custo), 0) / produtos.length
    : 0;
  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        {/* Marca */}
        <div className="onb-brand">
          <div className="brand-mark" style={{ width: 52, height: 52, fontSize: 18 }}>HC</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, color: "var(--gold)", letterSpacing: 3 }}>
              HubControl
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: 2, textTransform: "uppercase" }}>
              Configuração inicial
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="onb-steps">
          {[1, 2, 3].map((s) => (
            <div key={s} className={"onb-step" + (s === step ? " active" : s < step ? " done" : "")}>
              <div className="onb-step-dot">{s < step ? "✓" : s}</div>
              <div className="onb-step-label">
                {s === 1 ? "Seu negócio" : s === 2 ? "Produtos" : "Meta"}
              </div>
            </div>
          ))}
        </div>

        {/* ---- Step 1 ---- */}
        {step === 1 && (
          <div className="onb-body">
            <h2 className="onb-title">Como se chama a sua marmitaria?</h2>
            <p className="onb-sub">
              Essas informações aparecem nos relatórios e na tela principal.
            </p>
            <div className="form-grid" style={{ marginTop: 28 }}>
              <div className="field">
                <label>Nome do negócio</label>
                <input
                  value={nomeMarca}
                  onChange={(e) => setNomeMarca(e.target.value)}
                  placeholder="Ex.: HLD Marmitaria Delivery"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Cidade</label>
                <input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex.: Sinop-MT"
                />
              </div>
            </div>
          </div>
        )}

        {/* ---- Step 2 ---- */}
        {step === 2 && (
          <div className="onb-body">
            <h2 className="onb-title">Seus produtos e preços</h2>
            <p className="onb-sub">
              Revise os preços de venda e o custo por marmita (ingredientes + embalagem). Você pode
              alterar isso depois em Configurações.
            </p>
            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Marmita</th>
                    <th className="t-right">Preço de venda</th>
                    <th className="t-right">Custo unitário</th>
                    <th className="t-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => {
                    const mc = p.preco > 0 ? ((p.preco - p.custo) / p.preco) * 100 : 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="tag-size">{p.tamanho}</span>{" "}
                          <input
                            value={p.nome}
                            onChange={(e) => setProd(p.id, { nome: e.target.value })}
                            style={{ width: 160, background: "transparent", border: "none", color: "var(--text)", padding: "2px 4px" }}
                          />
                        </td>
                        <td className="t-right">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            style={{ width: 100, textAlign: "right" }}
                            value={p.preco}
                            onChange={(e) => setProd(p.id, { preco: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="t-right">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            style={{ width: 100, textAlign: "right" }}
                            value={p.custo}
                            onChange={(e) => setProd(p.id, { custo: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className={"t-right " + (mc >= 25 ? "pos" : "neg")}>
                          {p.preco > 0 ? `${mc.toFixed(0)}%` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="onb-hint">
              Margem de contribuição média estimada: <strong className="gold">{formatBRL(totalMC)}</strong> por marmita
            </div>
          </div>
        )}

        {/* ---- Step 3 ---- */}
        {step === 3 && (
          <div className="onb-body">
            <h2 className="onb-title">Qual é a sua meta de lucro?</h2>
            <p className="onb-sub">
              A margem-meta é usada para calcular o preço sugerido de cada marmita e sinalizar
              quando você está abaixo do ideal.
            </p>
            <div style={{ marginTop: 32 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 52, fontWeight: 900, color: "var(--gold-bright)", lineHeight: 1 }}>
                  {margem}%
                </span>
                <span style={{ color: "var(--text-dim)", fontSize: 14 }}>de lucro sobre o preço de venda</span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                step={1}
                value={margem}
                onChange={(e) => setMargem(Number(e.target.value))}
                className="onb-slider"
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>
                <span>10%</span>
                <span>60%</span>
              </div>
              <div className="onb-hint" style={{ marginTop: 24 }}>
                {margem < 20 && (
                  <span className="neg">
                    Margem muito baixa. Recomendamos pelo menos 30% para cobrir imprevistos.
                  </span>
                )}
                {margem >= 20 && margem < 35 && (
                  <span>
                    Razoável para começar. Acompanhe os custos para manter essa margem.
                  </span>
                )}
                {margem >= 35 && (
                  <span className="pos">
                    Ótima meta! Com {margem}% de margem, cada marmita de {produtos[0] ? formatBRL(produtos[0].preco) : "R$ 20"} gera{" "}
                    {produtos[0] ? formatBRL(produtos[0].preco * (margem / 100)) : ""} de lucro.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer / navigation */}
        <div className="onb-footer">
          {step > 1 ? (
            <button className="btn btn-ghost" onClick={prev}>
              Voltar
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {step > 1 && (
              <button
                className="btn btn-ghost"
                onClick={step === 3 ? concluir : next}
                style={{ color: "var(--text-faint)", fontSize: 13 }}
              >
                Pular
              </button>
            )}
            {step < 3 ? (
              <button className="btn btn-primary" onClick={next}>
                Próximo →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={concluir} disabled={busy}>
                {busy ? "Salvando..." : "Concluir configuração ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
