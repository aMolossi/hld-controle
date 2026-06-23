import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { DespesaCategoria, Produto } from "../lib/types";
import { exec, query } from "../lib/db";
import { formatBRL, formatPct } from "../lib/format";
import { IconPlus, IconTrash } from "../components/icons";
import {
  appDataPath,
  exportBackup,
  listBackups,
  relaunchApp,
  restoreBackup,
} from "../lib/backup";
import { checkUpdate, downloadAndInstall, type Update } from "../lib/update";

export default function Config() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [cats, setCats] = useState<DespesaCategoria[]>([]);
  const [margem, setMargem] = useState("30");
  const [novaCat, setNovaCat] = useState("");
  const [novaCatTipo, setNovaCatTipo] = useState("variavel");
  const [msg, setMsg] = useState("");

  // backup + updates
  const [appVersion, setAppVersion] = useState("");
  const [backups, setBackups] = useState<string[]>([]);
  const [dataDir, setDataDir] = useState("");
  const [upd, setUpd] = useState<Update | null>(null);
  const [checkingUpd, setCheckingUpd] = useState(false);
  const [updMsg, setUpdMsg] = useState("");
  const [installing, setInstalling] = useState(false);
  const [pct, setPct] = useState(0);

  const loadAll = async () => {
    setProdutos(await query<Produto>("SELECT * FROM produtos ORDER BY ordem"));
    setCats(await query<DespesaCategoria>("SELECT * FROM despesa_categorias ORDER BY ordem, nome"));
    const m = await query<{ valor: string }>("SELECT valor FROM config WHERE chave='margem_meta'");
    if (m[0]) setMargem(String(Math.round((parseFloat(m[0].valor) || 0) * 100)));
  };

  useEffect(() => {
    loadAll();
    getVersion().then(setAppVersion).catch(() => {});
    listBackups().then(setBackups);
    appDataPath().then(setDataDir);
  }, []);

  const flash = (s: string) => {
    setMsg(s);
    setTimeout(() => setMsg(""), 2200);
  };

  const margemFrac = (parseFloat(margem.replace(",", ".")) || 0) / 100;

  const setProd = (id: number, patch: Partial<Produto>) =>
    setProdutos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const salvarProdutos = async () => {
    for (const p of produtos) {
      await exec("UPDATE produtos SET preco=?, custo=? WHERE id=?", [p.preco, p.custo, p.id]);
    }
    flash("Precos e custos salvos.");
  };

  const salvarMargem = async () => {
    await exec(
      "INSERT INTO config (chave,valor) VALUES ('margem_meta',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",
      [String(margemFrac)],
    );
    flash("Margem-meta salva.");
  };

  const addCat = async () => {
    const nome = novaCat.trim();
    if (!nome) return;
    await exec("INSERT OR IGNORE INTO despesa_categorias (nome,tipo,ordem) VALUES (?,?,100)", [
      nome,
      novaCatTipo,
    ]);
    setNovaCat("");
    await loadAll();
  };

  const delCat = async (c: DespesaCategoria) => {
    if (!confirm(`Remover a categoria "${c.nome}"? Despesas ja lancadas nao sao apagadas.`)) return;
    await exec("DELETE FROM despesa_categorias WHERE id=?", [c.id]);
    await loadAll();
  };

  // ---- backup ----
  const doExport = async () => {
    try {
      const p = await exportBackup();
      if (p) flash("Backup exportado com sucesso.");
    } catch (e) {
      alert("Falha ao exportar backup: " + e);
    }
  };

  const doRestore = async () => {
    try {
      const ok = await restoreBackup();
      if (ok && confirm("Backup selecionado. O app vai reiniciar para restaurar os dados. Continuar?")) {
        await relaunchApp();
      }
    } catch (e) {
      alert("Falha ao restaurar backup: " + e);
    }
  };

  // ---- updates ----
  const doCheck = async () => {
    setCheckingUpd(true);
    setUpdMsg("");
    try {
      const u = await checkUpdate();
      if (u) {
        setUpd(u);
        setUpdMsg(`Nova versao ${u.version} disponivel.`);
      } else {
        setUpdMsg("Voce esta na versao mais recente.");
      }
    } catch {
      setUpdMsg("Nao foi possivel verificar agora (sem internet ou ainda sem releases publicadas).");
    } finally {
      setCheckingUpd(false);
    }
  };

  const doInstall = async () => {
    if (!upd) return;
    setInstalling(true);
    try {
      await downloadAndInstall(upd, setPct);
    } catch (e) {
      alert("Falha ao instalar atualizacao: " + e);
      setInstalling(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Configuracoes</div>
          <div className="page-sub">Precos, custos, categorias, backup e atualizacoes</div>
        </div>
        {msg && <div className="pill pill-novo">{msg}</div>}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Precos e custos das marmitas</span>
          <button className="btn btn-primary btn-sm" onClick={salvarProdutos}>
            Salvar precos
          </button>
        </div>
        <div className="field-hint" style={{ marginBottom: 14 }}>
          O <strong>custo unitario</strong> (ingredientes + embalagem por marmita) alimenta o
          calculo de margem e o preco sugerido. O preco sugerido usa a margem-meta abaixo.
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Marmita</th>
                <th className="t-right">Preco de venda</th>
                <th className="t-right">Custo unitario</th>
                <th className="t-right">Margem atual</th>
                <th className="t-right">Preco sugerido</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const margemAtual = p.preco > 0 ? (p.preco - p.custo) / p.preco : 0;
                const sugerido = margemFrac < 1 && p.custo > 0 ? p.custo / (1 - margemFrac) : 0;
                const baixa = p.custo > 0 && margemAtual < margemFrac;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="tag-size">{p.tamanho}</span> {p.nome}
                    </td>
                    <td className="t-right">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        style={{ width: 110, textAlign: "right" }}
                        value={p.preco}
                        onChange={(e) => setProd(p.id, { preco: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="t-right">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        style={{ width: 110, textAlign: "right" }}
                        value={p.custo}
                        onChange={(e) => setProd(p.id, { custo: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className={"t-right " + (baixa ? "neg" : "pos")}>
                      {p.custo > 0 ? formatPct(margemAtual) : <span className="muted">-</span>}
                    </td>
                    <td className="t-right gold">
                      {sugerido > 0 ? formatBRL(sugerido) : <span className="muted">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2 section-gap">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Margem-meta</span>
            <button className="btn btn-primary btn-sm" onClick={salvarMargem}>
              Salvar
            </button>
          </div>
          <div className="field-hint" style={{ marginBottom: 12 }}>
            Margem de lucro desejada sobre o preco de venda. Usada para sugerir o preco ideal de
            cada marmita conforme o custo.
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Margem desejada (%)</label>
            <input
              type="number"
              step="1"
              min="0"
              max="95"
              value={margem}
              onChange={(e) => setMargem(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Categorias de despesa</span>
          </div>
          <div className="row" style={{ marginBottom: 14 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Nova categoria"
              value={novaCat}
              onChange={(e) => setNovaCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCat();
              }}
            />
            <select
              style={{ width: 120 }}
              value={novaCatTipo}
              onChange={(e) => setNovaCatTipo(e.target.value)}
            >
              <option value="variavel">Variavel</option>
              <option value="fixo">Fixo</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={addCat}>
              <IconPlus /> Add
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cats.map((c) => (
              <span
                key={c.id}
                className={"pill " + (c.tipo === "fixo" ? "pill-fixo" : "pill-var")}
                style={{ paddingRight: 4, gap: 6, display: "inline-flex", alignItems: "center" }}
              >
                {c.nome}
                <button
                  className="btn btn-icon btn-ghost"
                  style={{ padding: 2, border: "none" }}
                  onClick={() => delCat(c)}
                  title="Remover"
                >
                  <IconTrash size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2 section-gap">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Backup de dados</span>
          </div>
          <div className="field-hint" style={{ marginBottom: 12 }}>
            Backup automatico a cada abertura (mantem os 15 mais recentes). Exporte para uma pasta
            do Google Drive/OneDrive para ter copia fora do PC.
          </div>
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={doExport}>
              Exportar backup
            </button>
            <button className="btn btn-sm" onClick={doRestore}>
              Restaurar backup
            </button>
          </div>
          {dataDir && (
            <div className="field-hint" style={{ wordBreak: "break-all" }}>
              Pasta dos dados: {dataDir}
            </div>
          )}
          {backups.length > 0 && (
            <>
              <div className="field-hint" style={{ marginTop: 12, marginBottom: 6 }}>
                Backups automaticos recentes:
              </div>
              <div className="backup-list">
                {backups.slice(0, 15).map((b) => (
                  <div key={b}>{b}</div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Atualizacoes</span>
          </div>
          <div className="field-hint" style={{ marginBottom: 12 }}>
            Versao atual: <strong className="gold">{appVersion || "..."}</strong>. O app verifica
            atualizacoes automaticamente ao abrir.
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-sm" onClick={doCheck} disabled={checkingUpd}>
              {checkingUpd ? "Verificando..." : "Verificar atualizacoes"}
            </button>
            {upd && (
              <button className="btn btn-primary btn-sm" onClick={doInstall} disabled={installing}>
                {installing ? `Instalando... ${pct}%` : `Instalar ${upd.version}`}
              </button>
            )}
          </div>
          {updMsg && (
            <div className="field-hint" style={{ marginTop: 10 }}>
              {updMsg}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
