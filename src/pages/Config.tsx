import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { DespesaCategoria, Produto } from "../lib/types";
import { exec, query } from "../lib/db";
import { formatBRL, formatPct } from "../lib/format";
import { IconPlus, IconTrash } from "../components/icons";
import { useConfirm } from "../components/Confirm";
import Modal from "../components/Modal";
import {
  appDataPath,
  exportBackup,
  listBackups,
  relaunchApp,
  restoreBackup,
} from "../lib/backup";
import { checkUpdate, downloadAndInstall, type Update } from "../lib/update";
import { readLicenseInfo } from "../lib/license";
import type { LicenseInfo } from "../lib/license";

export default function Config() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [cats, setCats] = useState<DespesaCategoria[]>([]);
  const [margem, setMargem] = useState("30");
  const [fiadoThreshold, setFiadoThreshold] = useState("200");
  const [novaCat, setNovaCat] = useState("");
  const [novaCatTipo, setNovaCatTipo] = useState("variavel");
  const [msg, setMsg] = useState("");
  const { ask, ConfirmDialog } = useConfirm();

  // backup + updates
  const [appVersion, setAppVersion] = useState("");
  const [backups, setBackups] = useState<string[]>([]);
  const [dataDir, setDataDir] = useState("");
  const [upd, setUpd] = useState<Update | null>(null);
  const [checkingUpd, setCheckingUpd] = useState(false);
  const [updMsg, setUpdMsg] = useState("");
  const [installing, setInstalling] = useState(false);
  const [pct, setPct] = useState(0);
  const [novoProdOpen, setNovoProdOpen] = useState(false);
  const [novoProd, setNovoProd] = useState({ nome: "", tamanho: "", preco: "", custo: "" });
  const [licInfo, setLicInfo] = useState<LicenseInfo | null>(null);

  const loadAll = async () => {
    setProdutos(await query<Produto>("SELECT * FROM produtos WHERE ativo = 1 ORDER BY ordem"));
    setCats(await query<DespesaCategoria>("SELECT * FROM despesa_categorias ORDER BY ordem, nome"));
    const m = await query<{ valor: string }>("SELECT valor FROM config WHERE chave='margem_meta'");
    if (m[0]) setMargem(String(Math.round((parseFloat(m[0].valor) || 0) * 100)));
    const ft = await query<{ valor: string }>("SELECT valor FROM config WHERE chave='alerta_fiado_threshold'");
    if (ft[0]) setFiadoThreshold(ft[0].valor);
  };

  useEffect(() => {
    loadAll();
    getVersion().then(setAppVersion).catch(() => {});
    listBackups().then(setBackups);
    appDataPath().then(setDataDir);
    readLicenseInfo().then(setLicInfo);
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
    flash("Preços e custos salvos.");
  };

  const toggleDisponivel = async (id: number, val: number) => {
    await exec("UPDATE produtos SET disponivel_hoje=? WHERE id=?", [val, id]);
    setProdutos((ps) => ps.map((p) => (p.id === id ? { ...p, disponivel_hoje: val } : p)));
  };

  const reordenar = async (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= produtos.length) return;
    const a = produtos[idx], b = produtos[swapIdx];
    await exec("UPDATE produtos SET ordem=? WHERE id=?", [b.ordem, a.id]);
    await exec("UPDATE produtos SET ordem=? WHERE id=?", [a.ordem, b.id]);
    await loadAll();
  };

  const desativarProd = async (p: Produto) => {
    if (!(await ask(`Desativar "${p.nome} (${p.tamanho})"? O histórico de vendas não é afetado.`))) return;
    await exec("UPDATE produtos SET ativo=0 WHERE id=?", [p.id]);
    await loadAll();
  };

  const salvarNovoProd = async () => {
    const nome = novoProd.nome.trim();
    const tamanho = novoProd.tamanho.trim();
    if (!nome || !tamanho) return;
    if (produtos.length >= 20) {
      flash("Máximo de 20 produtos ativos atingido.");
      setNovoProdOpen(false);
      return;
    }
    const maxOrdem = Math.max(0, ...produtos.map((p) => p.ordem));
    await exec(
      "INSERT INTO produtos (tamanho, nome, preco, custo, ativo, disponivel_hoje, ordem) VALUES (?,?,?,?,1,1,?)",
      [tamanho, nome, parseFloat(novoProd.preco) || 0, parseFloat(novoProd.custo) || 0, maxOrdem + 1],
    );
    setNovoProdOpen(false);
    setNovoProd({ nome: "", tamanho: "", preco: "", custo: "" });
    await loadAll();
  };

  const salvarMargem = async () => {
    await exec(
      "INSERT INTO config (chave,valor) VALUES ('margem_meta',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",
      [String(margemFrac)],
    );
    flash("Margem-meta salva.");
  };

  const salvarAlertas = async () => {
    await exec(
      "INSERT INTO config (chave,valor) VALUES ('alerta_fiado_threshold',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",
      [fiadoThreshold],
    );
    flash("Configurações de alertas salvas.");
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
    if (!(await ask(`Remover a categoria "${c.nome}"? Despesas já lançadas não são apagadas.`))) return;
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
      if (ok && (await ask("Backup selecionado. O app vai reiniciar para restaurar os dados. Continuar?"))) {
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
        setUpdMsg(`Nova versão ${u.version} disponível.`);
      } else {
        setUpdMsg("Você está na versão mais recente.");
      }
    } catch {
      setUpdMsg("Não foi possível verificar agora (sem internet ou ainda sem releases publicadas).");
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
      alert("Falha ao instalar atualização: " + e);
      setInstalling(false);
    }
  };

  return (
    <>
      {ConfirmDialog}
      <div className="page-head">
        <div>
          <div className="page-title">Configurações</div>
          <div className="page-sub">Preços, custos, categorias, backup e atualizações</div>
        </div>
        {msg && <div className="pill pill-novo">{msg}</div>}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Cardápio de produtos</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setNovoProdOpen(true)}>
              <IconPlus /> Novo produto
            </button>
            <button className="btn btn-primary btn-sm" onClick={salvarProdutos}>
              Salvar preços
            </button>
          </div>
        </div>
        <div className="field-hint" style={{ marginBottom: 14 }}>
          O <strong>custo unitário</strong> (ingredientes + embalagem por marmita) alimenta o
          cálculo de margem e o preço sugerido. O preço sugerido usa a margem-meta abaixo.
          Use <strong>Hoje</strong> para ativar/desativar um produto no formulário de vendas do dia.
          Produtos desativados (ícone lixo) não aparecem mais.
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Marmita</th>
                <th className="t-right">Preço de venda</th>
                <th className="t-right">Custo unitário</th>
                <th className="t-right">Margem atual</th>
                <th className="t-right">Preço sugerido</th>
                <th className="t-center">Hoje</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p, idx) => {
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
                    <td className="t-center">
                      <input
                        type="checkbox"
                        checked={!!p.disponivel_hoje}
                        onChange={(e) => toggleDisponivel(p.id, e.target.checked ? 1 : 0)}
                        title="Disponível hoje"
                      />
                    </td>
                    <td>
                      <div className="row" style={{ gap: 2, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={() => reordenar(idx, -1)}
                          disabled={idx === 0}
                          title="Subir"
                        >↑</button>
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={() => reordenar(idx, 1)}
                          disabled={idx === produtos.length - 1}
                          title="Descer"
                        >↓</button>
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={() => desativarProd(p)}
                          title="Desativar produto"
                        ><IconTrash size={13} /></button>
                      </div>
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
            Margem de lucro desejada sobre o preço de venda. Usada para sugerir o preço ideal de
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
              <option value="variavel">Variável</option>
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
            <span className="card-title">Alertas do Dashboard</span>
            <button className="btn btn-primary btn-sm" onClick={salvarAlertas}>
              Salvar
            </button>
          </div>
          <div className="field-hint" style={{ marginBottom: 14 }}>
            O Dashboard exibe avisos automáticos quando algo merece atenção. Configure os
            limiares abaixo para ajustar a sensibilidade.
          </div>
          <div className="field" style={{ maxWidth: 220 }}>
            <label>Limite de fiados para alerta (R$)</label>
            <input
              type="number"
              step="50"
              min="0"
              value={fiadoThreshold}
              onChange={(e) => setFiadoThreshold(e.target.value)}
            />
            <span className="field-hint">
              Alerta dispara quando o total de vendas fiadas pendentes superar este valor.
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Backup de dados</span>
          </div>
          <div className="field-hint" style={{ marginBottom: 12 }}>
            Backup automático a cada abertura (mantém os 15 mais recentes). Exporte para uma pasta
            do Google Drive/OneDrive para ter cópia fora do PC.
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
            <span className="card-title">Atualizações</span>
          </div>
          <div className="field-hint" style={{ marginBottom: 12 }}>
            Versão atual: <strong className="gold">{appVersion || "..."}</strong>. O app verifica
            atualizações automaticamente ao abrir.
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-sm" onClick={doCheck} disabled={checkingUpd}>
              {checkingUpd ? "Verificando..." : "Verificar atualizações"}
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

      {licInfo && (
        <div className="card section-gap">
          <div className="card-head">
            <span className="card-title">Licença</span>
            <span className={`pill ${licInfo.inGrace ? "pill-pendente" : licInfo.daysRemaining < 30 ? "pill-pendente" : "pill-pago"}`}>
              {licInfo.inGrace
                ? "Carência"
                : licInfo.daysRemaining < 0
                ? "Expirada"
                : licInfo.tier === "pro" ? "Pro" : "Starter"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 8 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Cliente</div>
              <div style={{ fontWeight: 600 }}>{licInfo.cliente}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Válida até</div>
              <div style={{ fontWeight: 600 }}>{licInfo.expiry}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Dias restantes</div>
              <div style={{ fontWeight: 600 }} className={licInfo.daysRemaining < 0 ? "neg" : licInfo.daysRemaining < 30 ? "gold" : "pos"}>
                {licInfo.daysRemaining < 0 ? `${Math.abs(licInfo.daysRemaining)}d expirado` : `${licInfo.daysRemaining}d`}
              </div>
            </div>
          </div>
        </div>
      )}

      {novoProdOpen && (
        <Modal
          title="Novo produto"
          onClose={() => setNovoProdOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setNovoProdOpen(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={salvarNovoProd}
                disabled={!novoProd.nome.trim() || !novoProd.tamanho.trim()}
              >
                Adicionar
              </button>
            </>
          }
        >
          <div className="field">
            <label>Nome do produto</label>
            <input
              placeholder="Ex: Marmita Vegana, Combo, Prato Executivo"
              value={novoProd.nome}
              onChange={(e) => setNovoProd((p) => ({ ...p, nome: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Tamanho / Identificador</label>
            <input
              placeholder="Ex: P, M, G, Vegana, Combo"
              value={novoProd.tamanho}
              onChange={(e) => setNovoProd((p) => ({ ...p, tamanho: e.target.value }))}
            />
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Preço de venda (R$)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={novoProd.preco}
                onChange={(e) => setNovoProd((p) => ({ ...p, preco: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Custo unitário (R$)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={novoProd.custo}
                onChange={(e) => setNovoProd((p) => ({ ...p, custo: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
