import { useEffect, useMemo, useState } from "react";
import type { Cliente } from "../lib/types";
import type { ClienteResumo } from "../lib/calc";
import { getClientesResumo } from "../lib/calc";
import { exec, query } from "../lib/db";
import { formatBRL, formatDateBR } from "../lib/format";
import { IconEdit, IconPlus, IconTrash, IconUsers } from "../components/icons";
import Modal from "../components/Modal";
import { useConfirm } from "../components/Confirm";
import EmptyState from "../components/EmptyState";
import { BAIRROS, ORIGENS } from "../lib/types";

interface VendaResumoCliente {
  id: number;
  data: string;
  itens_resumo: string | null;
  qtd_marmitas: number;
  total: number;
  forma_pagamento: string;
  status_pagamento: string;
}

type ModalMode = "historico" | "editar" | "novo";

const diasSemCompra = (ultima: string | null): number => {
  if (!ultima) return Infinity;
  const diff = Date.now() - new Date(ultima + "T00:00:00").getTime();
  return Math.floor(diff / 86400000);
};

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClienteResumo | null>(null);
  const [mode, setMode] = useState<ModalMode>("historico");
  const [historico, setHistorico] = useState<VendaResumoCliente[]>([]);
  const [form, setForm] = useState<Omit<Cliente, "id" | "criado_em">>({
    nome: "",
    telefone: null,
    bairro: null,
    origem: null,
    obs: null,
  });
  const [busy, setBusy] = useState(false);
  const { ask, ConfirmDialog } = useConfirm();

  const load = async () => {
    setClientes(await getClientesResumo());
  };

  useEffect(() => {
    load();
  }, []);

  const openHistorico = async (c: ClienteResumo) => {
    setSelected(c);
    setMode("historico");
    const rows = await query<VendaResumoCliente>(
      "SELECT id, data, itens_resumo, qtd_marmitas, total, forma_pagamento, status_pagamento FROM vendas WHERE cliente_id = ? ORDER BY data DESC, id DESC LIMIT 50",
      [c.id],
    );
    setHistorico(rows);
  };

  const openEditar = (c: ClienteResumo) => {
    setSelected(c);
    setForm({
      nome: c.nome,
      telefone: c.telefone,
      bairro: c.bairro,
      origem: null,
      obs: null,
    });
    setMode("editar");
  };

  const openNovo = () => {
    setSelected(null);
    setForm({ nome: "", telefone: null, bairro: null, origem: null, obs: null });
    setMode("novo");
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      alert("Informe o nome do cliente.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "novo") {
        await exec(
          "INSERT INTO clientes (nome,telefone,bairro,origem,obs) VALUES (?,?,?,?,?)",
          [form.nome.trim(), form.telefone || null, form.bairro || null, form.origem || null, form.obs || null],
        );
      } else if (selected) {
        await exec(
          "UPDATE clientes SET nome=?,telefone=?,bairro=?,origem=?,obs=? WHERE id=?",
          [form.nome.trim(), form.telefone || null, form.bairro || null, form.origem || null, form.obs || null, selected.id],
        );
      }
      setSelected(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const excluir = async (c: ClienteResumo) => {
    if (!(await ask(`Remover "${c.nome}" do cadastro? Os pedidos vinculados não serão apagados.`))) return;
    await exec("UPDATE vendas SET cliente_id=NULL WHERE cliente_id=?", [c.id]);
    await exec("DELETE FROM clientes WHERE id=?", [c.id]);
    await load();
  };

  const exportCSV = () => {
    const header = "Nome,Telefone,Bairro,Pedidos,Total Gasto,Ultima Compra\n";
    const rows = filtered
      .map(
        (c) =>
          `"${c.nome}","${c.telefone ?? ""}","${c.bairro ?? ""}",${c.total_pedidos},${c.total_gasto.toFixed(2)},"${c.ultima_compra ?? ""}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientes-hubcontrol.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.telefone ?? "").includes(q) ||
        (c.bairro ?? "").toLowerCase().includes(q),
    );
  }, [clientes, search]);

  return (
    <>
      {ConfirmDialog}

      <div className="page-head">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-sub">Cadastro e histórico de clientes fixos</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {clientes.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
              Exportar CSV
            </button>
          )}
          <button className="btn btn-primary" onClick={openNovo}>
            <IconPlus /> Novo cliente
          </button>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <input
          className="search-input"
          placeholder="Buscar por nome, telefone ou bairro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="spacer" />
        <span className="muted">{filtered.length} cliente(s)</span>
      </div>

      {clientes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconUsers size={48} />}
            title="Nenhum cliente cadastrado"
            body="Clientes aparecem aqui automaticamente ao salvar uma venda com nome. Você também pode cadastrar manualmente."
            action={{ label: "Novo cliente", onClick: openNovo }}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>Bairro</th>
                <th className="t-right">Pedidos</th>
                <th className="t-right">Total gasto</th>
                <th>Última compra</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const dias = diasSemCompra(c.ultima_compra);
                return (
                  <tr
                    key={c.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => openHistorico(c)}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="cli-avatar">{c.nome.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.nome}</div>
                          {dias > 30 && dias !== Infinity && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--gold)",
                                marginTop: 2,
                              }}
                            >
                              Sem compras há {dias} dias
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{c.telefone || <span className="muted">-</span>}</td>
                    <td>{c.bairro || <span className="muted">-</span>}</td>
                    <td className="t-right">
                      <strong>{c.total_pedidos}</strong>
                    </td>
                    <td className="t-right gold">
                      <strong>{formatBRL(c.total_gasto)}</strong>
                    </td>
                    <td className="nowrap">
                      {c.ultima_compra ? formatDateBR(c.ultima_compra) : <span className="muted">-</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="t-actions">
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={() => openEditar(c)}
                          title="Editar"
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={() => excluir(c)}
                          title="Excluir"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal histórico */}
      {mode === "historico" && selected && (
        <Modal
          title={selected.nome}
          onClose={() => setSelected(null)}
          width={620}
        >
          <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
            {selected.telefone && (
              <div>
                <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>TELEFONE</div>
                <div>{selected.telefone}</div>
              </div>
            )}
            {selected.bairro && (
              <div>
                <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>BAIRRO</div>
                <div>{selected.bairro}</div>
              </div>
            )}
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>TOTAL GASTO</div>
              <div className="gold" style={{ fontWeight: 800 }}>{formatBRL(selected.total_gasto)}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>PEDIDOS</div>
              <div style={{ fontWeight: 700 }}>{selected.total_pedidos}</div>
            </div>
          </div>

          <div className="card-title" style={{ marginBottom: 10 }}>Histórico de pedidos</div>
          {historico.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: "20px 0" }}>
              Nenhum pedido vinculado a este cliente ainda.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Itens</th>
                    <th>Pagamento</th>
                    <th className="t-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((v) => (
                    <tr key={v.id}>
                      <td className="nowrap">{formatDateBR(v.data)}</td>
                      <td>{v.itens_resumo || `${v.qtd_marmitas} marmita(s)`}</td>
                      <td>
                        {v.status_pagamento === "pendente" ? (
                          <span className="pill pill-pendente" style={{ fontSize: 11 }}>Fiado</span>
                        ) : (
                          <span className="pill pill-pago" style={{ fontSize: 11 }}>{v.forma_pagamento}</span>
                        )}
                      </td>
                      <td className="t-right gold">
                        <strong>{formatBRL(v.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {/* Modal novo / editar */}
      {(mode === "novo" || mode === "editar") && (
        <Modal
          title={mode === "novo" ? "Novo cliente" : "Editar cliente"}
          onClose={() => { setSelected(null); setMode("historico"); }}
          width={520}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => { setSelected(null); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={salvar} disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
                autoFocus
              />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input
                value={form.telefone ?? ""}
                onChange={(e) => setForm({ ...form, telefone: e.target.value || null })}
                placeholder="(66) 9...."
              />
            </div>
            <div className="field">
              <label>Bairro</label>
              <select
                value={form.bairro ?? ""}
                onChange={(e) => setForm({ ...form, bairro: e.target.value || null })}
              >
                <option value="">-</option>
                {BAIRROS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Origem</label>
              <select
                value={form.origem ?? ""}
                onChange={(e) => setForm({ ...form, origem: e.target.value || null })}
              >
                <option value="">-</option>
                {ORIGENS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Observações</label>
              <textarea
                value={form.obs ?? ""}
                onChange={(e) => setForm({ ...form, obs: e.target.value || null })}
                placeholder="Preferências, restrições, anotações..."
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
