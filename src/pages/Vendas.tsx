import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cliente, Produto, Venda, VendaExtra, VendaItem } from "../lib/types";
import { BAIRROS, FORMAS_PAGAMENTO, ORIGENS, PERIODICIDADES, TIPOS_CLIENTE, TIPOS_VENDA } from "../lib/types";
import { exec, query } from "../lib/db";
import { formatBRL, formatDateBR } from "../lib/format";
import type { Period } from "../lib/dates";
import { monthRange, todayISO } from "../lib/dates";
import PeriodFilter from "../components/PeriodFilter";
import type { Preset } from "../components/PeriodFilter";
import Modal from "../components/Modal";
import { IconCart, IconEdit, IconPlus, IconTrash } from "../components/icons";
import { useConfirm } from "../components/Confirm";
import EmptyState from "../components/EmptyState";

interface ItemInput {
  tamanho: string;
  quantidade: string;
  preco: string;
}

interface ExtraInput {
  nome: string;
  quantidade: string;
  preco: string;
}

interface FormState {
  id: number | null;
  data: string;
  tipo_venda: string;
  empresa: string;
  periodicidade: string;
  cliente_nome: string;
  cliente_id: number | null;
  telefone: string;
  bairro: string;
  origem: string;
  tipo_cliente: string;
  forma_pagamento: string;
  obs: string;
  itens: ItemInput[];
  extras: ExtraInput[];
}

type FiltroStatus = "todos" | "pagos" | "fiados";

const parseValor = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;
const qNum = (s: string) => {
  const n = parseInt(String(s), 10);
  return isNaN(n) ? 0 : n;
};
const defaultSize = (prods: Produto[]) =>
  prods.find((p) => p.tamanho === "M")?.tamanho ?? prods[0]?.tamanho ?? "M";
const precoOf = (prods: Produto[], tam: string) =>
  prods.find((p) => p.tamanho === tam)?.preco ?? 0;

const statusDePagamento = (forma: string) =>
  forma === "Fiado" ? "pendente" : "pago";

const emptyForm = (prods: Produto[]): FormState => {
  const tam = defaultSize(prods);
  return {
    id: null,
    data: todayISO(),
    tipo_venda: "Avulso",
    empresa: "",
    periodicidade: "Semanal",
    cliente_nome: "",
    cliente_id: null,
    telefone: "",
    bairro: "",
    origem: "",
    tipo_cliente: "Novo",
    forma_pagamento: "PIX",
    obs: "",
    itens: [{ tamanho: tam, quantidade: "1", preco: String(precoOf(prods, tam)) }],
    extras: [],
  };
};

export default function Vendas() {
  const [period, setPeriod] = useState<Period>(monthRange());
  const [preset, setPreset] = useState<Preset>("mes");
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm([]));
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const { ask, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const rows = await query<Venda>(
      "SELECT * FROM vendas WHERE data BETWEEN ? AND ? ORDER BY data DESC, id DESC",
      [period.inicio, period.fim],
    );
    setVendas(rows);
  }, [period]);

  const loadClientes = () =>
    query<Cliente>("SELECT * FROM clientes ORDER BY nome").then(setClientes);

  useEffect(() => {
    query<Produto>("SELECT * FROM produtos WHERE ativo = 1 AND disponivel_hoje = 1 ORDER BY ordem").then(setProdutos);
    loadClientes();
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const refreshEmpresas = async () => {
    const rows = await query<{ empresa: string }>(
      "SELECT DISTINCT empresa FROM vendas WHERE empresa IS NOT NULL AND empresa <> '' ORDER BY empresa",
    );
    setEmpresas(rows.map((r) => r.empresa));
  };

  const openNew = async () => {
    await refreshEmpresas();
    setForm(emptyForm(produtos));
    setOpen(true);
  };

  const openEdit = async (v: Venda) => {
    await refreshEmpresas();
    const its = await query<VendaItem>(
      "SELECT * FROM venda_itens WHERE venda_id=? ORDER BY id",
      [v.id],
    );
    const ex = await query<VendaExtra>(
      "SELECT * FROM venda_extras WHERE venda_id=? ORDER BY id",
      [v.id],
    );
    const tam = defaultSize(produtos);
    setForm({
      id: v.id,
      data: v.data,
      tipo_venda: v.tipo_venda || "Avulso",
      empresa: v.empresa ?? "",
      periodicidade: v.periodicidade || "Semanal",
      cliente_nome: v.cliente_nome ?? "",
      cliente_id: v.cliente_id ?? null,
      telefone: v.telefone ?? "",
      bairro: v.bairro ?? "",
      origem: v.origem ?? "",
      tipo_cliente: v.tipo_cliente ?? "Novo",
      forma_pagamento: v.forma_pagamento ?? "PIX",
      obs: v.obs ?? "",
      itens: its.length
        ? its.map((i) => ({
            tamanho: i.tamanho,
            quantidade: String(i.quantidade),
            preco: String(i.preco_unitario).replace(".", ","),
          }))
        : [{ tamanho: tam, quantidade: "1", preco: String(precoOf(produtos, tam)) }],
      extras: ex.map((e) => ({
        nome: e.nome,
        quantidade: String(e.quantidade),
        preco: String(e.preco_unitario).replace(".", ","),
      })),
    });
    setOpen(true);
  };

  const onClienteNome = (nome: string) => {
    const match = clientes.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
    setForm((f) => ({
      ...f,
      cliente_nome: nome,
      cliente_id: match ? match.id : null,
      telefone: match?.telefone ? match.telefone : f.telefone,
      bairro: match?.bairro ? match.bairro : f.bairro,
    }));
  };

  const marcarPago = async (v: Venda) => {
    await exec("UPDATE vendas SET status_pagamento='pago', forma_pagamento='PIX' WHERE id=?", [v.id]);
    await load();
  };

  // ---- itens (marmitas) ----
  const addItem = () =>
    setForm((f) => {
      const tam = defaultSize(produtos);
      return {
        ...f,
        itens: [...f.itens, { tamanho: tam, quantidade: "1", preco: String(precoOf(produtos, tam)) }],
      };
    });
  const setItem = (idx: number, patch: Partial<ItemInput>) =>
    setForm((f) => ({
      ...f,
      itens: f.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  const onItemTamanho = (idx: number, tamanho: string) =>
    setItem(idx, { tamanho, preco: String(precoOf(produtos, tamanho)) });
  const delItem = (idx: number) =>
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));

  // ---- extras ----
  const addExtra = () =>
    setForm((f) => ({ ...f, extras: [...f.extras, { nome: "", quantidade: "1", preco: "" }] }));
  const setExtra = (idx: number, patch: Partial<ExtraInput>) =>
    setForm((f) => ({
      ...f,
      extras: f.extras.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  const delExtra = (idx: number) =>
    setForm((f) => ({ ...f, extras: f.extras.filter((_, i) => i !== idx) }));

  const onTipoVenda = (tipo: string) =>
    setForm((f) => ({
      ...f,
      tipo_venda: tipo,
      tipo_cliente: tipo === "Empresa" ? "Recorrente" : f.tipo_cliente,
    }));

  const itemSubtotal = (i: ItemInput) => parseValor(i.preco) * qNum(i.quantidade);
  const extraSubtotal = (e: ExtraInput) => parseValor(e.preco) * qNum(e.quantidade);
  const valorMarmitas = form.itens.reduce((s, i) => s + itemSubtotal(i), 0);
  const valorExtras = form.extras.reduce((s, e) => s + extraSubtotal(e), 0);
  const totalForm = valorMarmitas + valorExtras;
  const qtdMarmitas = form.itens.reduce((s, i) => s + qNum(i.quantidade), 0);

  const save = async () => {
    const itens = form.itens
      .map((i) => ({
        tamanho: i.tamanho,
        quantidade: qNum(i.quantidade),
        preco_unitario: parseValor(i.preco),
      }))
      .filter((i) => i.quantidade > 0);
    if (itens.length === 0) {
      alert("Adicione pelo menos uma marmita (quantidade maior que zero).");
      return;
    }
    if (form.tipo_venda === "Empresa" && form.empresa.trim() === "") {
      alert("Informe o nome da empresa.");
      return;
    }
    const extras = form.extras
      .map((e) => ({
        nome: e.nome.trim(),
        quantidade: Math.max(1, qNum(e.quantidade)),
        preco_unitario: parseValor(e.preco),
      }))
      .filter((e) => e.nome !== "" || e.preco_unitario > 0);

    const vMarmitas = itens.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
    const vExtras = extras.reduce((s, e) => s + e.preco_unitario * e.quantidade, 0);
    const total = vMarmitas + vExtras;
    const qtd = itens.reduce((s, i) => s + i.quantidade, 0);
    const resumo = itens.map((i) => `${i.quantidade}×${i.tamanho}`).join(", ");
    const empresa = form.tipo_venda === "Empresa" ? form.empresa.trim() : null;
    const periodicidade = form.tipo_venda === "Empresa" ? form.periodicidade : null;
    const legacyTam = itens[0].tamanho;
    const statusPagamento = statusDePagamento(form.forma_pagamento);

    setBusy(true);
    try {
      let vendaId = form.id;
      let clienteId = form.cliente_id;

      if (vendaId == null) {
        const res = await exec(
          "INSERT INTO vendas (data,cliente_nome,cliente_id,telefone,bairro,origem,tipo_cliente,tipo_venda,empresa,periodicidade,tamanho,valor_marmita,valor_extras,total,qtd_marmitas,itens_resumo,obs,forma_pagamento,status_pagamento,hora_pedido) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,strftime('%H:%M','now','localtime'))",
          [
            form.data, form.cliente_nome, clienteId, form.telefone, form.bairro, form.origem,
            form.tipo_cliente, form.tipo_venda, empresa, periodicidade, legacyTam,
            vMarmitas, vExtras, total, qtd, resumo, form.obs,
            form.forma_pagamento, statusPagamento,
          ],
        );
        vendaId = res.lastInsertId as number;
      } else {
        await exec(
          "UPDATE vendas SET data=?,cliente_nome=?,cliente_id=?,telefone=?,bairro=?,origem=?,tipo_cliente=?,tipo_venda=?,empresa=?,periodicidade=?,tamanho=?,valor_marmita=?,valor_extras=?,total=?,qtd_marmitas=?,itens_resumo=?,obs=?,forma_pagamento=?,status_pagamento=? WHERE id=?",
          [
            form.data, form.cliente_nome, clienteId, form.telefone, form.bairro, form.origem,
            form.tipo_cliente, form.tipo_venda, empresa, periodicidade, legacyTam,
            vMarmitas, vExtras, total, qtd, resumo, form.obs,
            form.forma_pagamento, statusPagamento, vendaId,
          ],
        );
        await exec("DELETE FROM venda_itens WHERE venda_id=?", [vendaId]);
        await exec("DELETE FROM venda_extras WHERE venda_id=?", [vendaId]);
      }
      for (const i of itens) {
        await exec(
          "INSERT INTO venda_itens (venda_id,tamanho,quantidade,preco_unitario,subtotal) VALUES (?,?,?,?,?)",
          [vendaId, i.tamanho, i.quantidade, i.preco_unitario, i.preco_unitario * i.quantidade],
        );
      }
      for (const e of extras) {
        await exec(
          "INSERT INTO venda_extras (venda_id,nome,quantidade,preco_unitario,valor) VALUES (?,?,?,?,?)",
          [vendaId, e.nome, e.quantidade, e.preco_unitario, e.preco_unitario * e.quantidade],
        );
      }
      setOpen(false);
      await load();

      // Prompt para cadastrar novo cliente fixo
      const nomeCliente = form.cliente_nome.trim();
      if (nomeCliente && clienteId === null && form.tipo_venda !== "Empresa") {
        const jaExiste = clientes.some(
          (c) => c.nome.toLowerCase() === nomeCliente.toLowerCase(),
        );
        if (!jaExiste) {
          const cadastrar = await ask(
            `Deseja cadastrar "${nomeCliente}" como cliente fixo?`,
          );
          if (cadastrar) {
            await exec(
              "INSERT INTO clientes (nome,telefone,bairro,origem) VALUES (?,?,?,?)",
              [nomeCliente, form.telefone || null, form.bairro || null, form.origem || null],
            );
            const rows = await query<{ id: number }>(
              "SELECT id FROM clientes WHERE nome=? ORDER BY id DESC LIMIT 1",
              [nomeCliente],
            );
            if (rows[0]) {
              await exec("UPDATE vendas SET cliente_id=? WHERE id=?", [rows[0].id, vendaId]);
            }
            await loadClientes();
          }
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: Venda) => {
    if (!(await ask(`Excluir a venda de ${formatDateBR(v.data)} (${formatBRL(v.total)})?`))) return;
    await exec("DELETE FROM venda_itens WHERE venda_id=?", [v.id]);
    await exec("DELETE FROM venda_extras WHERE venda_id=?", [v.id]);
    await exec("DELETE FROM vendas WHERE id=?", [v.id]);
    await load();
  };

  const filteredVendas = useMemo(() => {
    let list = vendas;
    if (filtroStatus === "pagos") list = list.filter((v) => (v.status_pagamento ?? "pago") === "pago");
    if (filtroStatus === "fiados") list = list.filter((v) => v.status_pagamento === "pendente");
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (v) =>
        (v.cliente_nome ?? "").toLowerCase().includes(q) ||
        (v.empresa ?? "").toLowerCase().includes(q) ||
        (v.bairro ?? "").toLowerCase().includes(q) ||
        (v.origem ?? "").toLowerCase().includes(q),
    );
  }, [vendas, search, filtroStatus]);

  const totalRecebido = filteredVendas
    .filter((v) => (v.status_pagamento ?? "pago") === "pago")
    .reduce((s, v) => s + v.total, 0);
  const totalPendente = filteredVendas
    .filter((v) => v.status_pagamento === "pendente")
    .reduce((s, v) => s + v.total, 0);
  const marmitasPeriodo = filteredVendas.reduce((s, v) => s + (v.qtd_marmitas || 0), 0);
  const isEmpresa = form.tipo_venda === "Empresa";

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Vendas</div>
          <div className="page-sub">Pedidos avulsos e de empresas (contrato)</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <IconPlus /> Nova venda
        </button>
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <PeriodFilter
          period={period}
          preset={preset}
          onChange={(p, pr) => {
            setPeriod(p);
            setPreset(pr);
          }}
        />
        <input
          className="search-input"
          placeholder="Buscar cliente, empresa, bairro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="btn-group">
          {(["todos", "pagos", "fiados"] as FiltroStatus[]).map((f) => (
            <button
              key={f}
              className={"btn btn-sm btn-ghost" + (filtroStatus === f ? " active" : "")}
              onClick={() => setFiltroStatus(f)}
            >
              {f === "todos" ? "Todos" : f === "pagos" ? "Pagos" : "Fiados"}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <div className="muted">
          {filteredVendas.length} pedido(s) &middot; {marmitasPeriodo} marmita(s)
        </div>
      </div>

      {vendas.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconCart size={48} />}
            title="Nenhum pedido no período"
            body="Lance o primeiro pedido do dia. Cada venda alimenta o Dashboard, o cálculo de lucro e o histórico de clientes."
            action={{ label: "Nova venda", onClick: openNew }}
          />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente / Empresa</th>
                  <th>Tipo</th>
                  <th>Itens</th>
                  <th>Origem</th>
                  <th>Pagamento</th>
                  <th className="t-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredVendas.map((v) => {
                  const isPendente = v.status_pagamento === "pendente";
                  return (
                    <tr key={v.id} style={isPendente ? { background: "rgba(207,171,88,0.06)" } : undefined}>
                      <td className="nowrap">{formatDateBR(v.data)}</td>
                      <td>
                        {v.tipo_venda === "Empresa" ? (
                          <>
                            <strong>{v.empresa || "Empresa"}</strong>
                            {v.periodicidade ? (
                              <span className="muted"> &middot; {v.periodicidade}</span>
                            ) : null}
                          </>
                        ) : (
                          v.cliente_nome || <span className="muted">-</span>
                        )}
                      </td>
                      <td>
                        {v.tipo_venda === "Empresa" ? (
                          <span className="pill pill-rec">Empresa</span>
                        ) : (
                          <span className="pill pill-var">Avulso</span>
                        )}
                      </td>
                      <td>
                        {v.itens_resumo || `${v.qtd_marmitas} marmita(s)`}
                        {v.valor_extras > 0 ? <span className="muted"> + extras</span> : null}
                      </td>
                      <td>{v.origem || <span className="muted">-</span>}</td>
                      <td>
                        {isPendente ? (
                          <span className="pill pill-pendente">{v.forma_pagamento ?? "Fiado"}</span>
                        ) : (
                          <span className="pill pill-pago">{v.forma_pagamento ?? "PIX"}</span>
                        )}
                      </td>
                      <td className="t-right gold">
                        <strong>{formatBRL(v.total)}</strong>
                      </td>
                      <td>
                        <div className="t-actions">
                          {isPendente && (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => marcarPago(v)}
                              title="Marcar como pago"
                              style={{ fontSize: 11 }}
                            >
                              ✓ Pago
                            </button>
                          )}
                          <button className="btn btn-icon btn-ghost" onClick={() => openEdit(v)} title="Editar">
                            <IconEdit />
                          </button>
                          <button className="btn btn-icon btn-danger" onClick={() => remove(v)} title="Excluir">
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

          <div className="table-footer">
            <span className="muted">
              Recebido: <strong className="pos">{formatBRL(totalRecebido)}</strong>
            </span>
            {totalPendente > 0 && (
              <span className="muted" style={{ marginLeft: 20 }}>
                A receber (fiados): <strong style={{ color: "var(--gold)" }}>{formatBRL(totalPendente)}</strong>
              </span>
            )}
          </div>
        </>
      )}

      {ConfirmDialog}

      {open && (
        <Modal
          title={form.id == null ? "Nova venda" : "Editar venda"}
          onClose={() => setOpen(false)}
          width={720}
          footer={
            <>
              <div style={{ marginRight: "auto", alignSelf: "center" }}>
                <span className="muted">{qtdMarmitas} marmita(s) &middot; Total: </span>
                <strong className="gold" style={{ fontSize: 18 }}>{formatBRL(totalForm)}</strong>
              </div>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Salvando..." : "Salvar venda"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field">
              <label>Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="field">
              <label>Tipo de venda</label>
              <select value={form.tipo_venda} onChange={(e) => onTipoVenda(e.target.value)}>
                {TIPOS_VENDA.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tipo de cliente</label>
              <select value={form.tipo_cliente} onChange={(e) => setForm({ ...form, tipo_cliente: e.target.value })}>
                {TIPOS_CLIENTE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Forma de pagamento</label>
              <select
                value={form.forma_pagamento}
                onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}
              >
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.forma_pagamento === "Fiado" && (
            <div
              style={{
                background: "rgba(207,171,88,0.1)",
                border: "1px solid rgba(207,171,88,0.3)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--gold)",
                marginTop: 10,
              }}
            >
              Fiado — venda ficará como <strong>pendente</strong> até ser marcada como paga.
            </div>
          )}

          {isEmpresa && (
            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Empresa</label>
                <input
                  list="empresas-list"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  placeholder="Nome da empresa"
                />
                <datalist id="empresas-list">
                  {empresas.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label>Contrato</label>
                <select
                  value={form.periodicidade}
                  onChange={(e) => setForm({ ...form, periodicidade: e.target.value })}
                >
                  {PERIODICIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-grid" style={{ marginTop: 14 }}>
            <div className="field">
              <label>{isEmpresa ? "Contato (opcional)" : "Cliente"}</label>
              <input
                list="clientes-datalist"
                value={form.cliente_nome}
                onChange={(e) => onClienteNome(e.target.value)}
                placeholder={isEmpresa ? "Nome do contato" : "Nome do cliente"}
              />
              <datalist id="clientes-datalist">
                {clientes.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
              {form.cliente_id !== null && (
                <div style={{ fontSize: 11, color: "var(--green)", marginTop: 2 }}>
                  ✓ Cliente cadastrado
                </div>
              )}
            </div>
            <div className="field">
              <label>Telefone (opcional)</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(66) 9...."
              />
            </div>
            <div className="field">
              <label>Bairro</label>
              <select value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })}>
                <option value="">-</option>
                {BAIRROS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Origem</label>
              <select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })}>
                <option value="">-</option>
                {ORIGENS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Marmitas */}
          <div className="card-head" style={{ marginTop: 22, marginBottom: 8 }}>
            <span className="card-title">Marmitas do pedido</span>
            <button className="btn btn-sm" onClick={addItem}>
              <IconPlus /> Adicionar marmita
            </button>
          </div>
          <div className="row" style={{ marginBottom: 6, gap: 10 }}>
            <span className="muted" style={{ width: 170, fontSize: 12 }}>Tamanho</span>
            <span className="muted" style={{ width: 70, fontSize: 12 }}>Qtd</span>
            <span className="muted" style={{ width: 120, fontSize: 12 }}>Preco un.</span>
            <span className="muted" style={{ flex: 1, fontSize: 12, textAlign: "right" }}>Subtotal</span>
            <span style={{ width: 34 }} />
          </div>
          {form.itens.map((it, i) => (
            <div className="row" key={i} style={{ marginBottom: 8, gap: 10 }}>
              <select style={{ width: 170 }} value={it.tamanho} onChange={(e) => onItemTamanho(i, e.target.value)}>
                {produtos.map((p) => (
                  <option key={p.tamanho} value={p.tamanho}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                style={{ width: 70 }}
                value={it.quantidade}
                onChange={(e) => setItem(i, { quantidade: e.target.value })}
              />
              <input
                inputMode="decimal"
                style={{ width: 120 }}
                value={it.preco}
                onChange={(e) => setItem(i, { preco: e.target.value })}
              />
              <div style={{ flex: 1, textAlign: "right" }} className="gold">
                {formatBRL(itemSubtotal(it))}
              </div>
              <button
                className="btn btn-icon btn-danger"
                onClick={() => delItem(i)}
                title="Remover"
                disabled={form.itens.length === 1}
              >
                <IconTrash />
              </button>
            </div>
          ))}

          {/* Extras */}
          <div className="card-head" style={{ marginTop: 22, marginBottom: 8 }}>
            <span className="card-title">Itens extras</span>
            <button className="btn btn-sm" onClick={addExtra}>
              <IconPlus /> Adicionar extra
            </button>
          </div>
          {form.extras.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Sem extras. Ex.: Refrigerante lata, quantidade 2.
            </div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 6, gap: 10 }}>
                <span className="muted" style={{ flex: 1, fontSize: 12 }}>Item</span>
                <span className="muted" style={{ width: 70, fontSize: 12 }}>Qtd</span>
                <span className="muted" style={{ width: 120, fontSize: 12 }}>Preco un.</span>
                <span className="muted" style={{ width: 90, fontSize: 12, textAlign: "right" }}>Subtotal</span>
                <span style={{ width: 34 }} />
              </div>
              {form.extras.map((ex, i) => (
                <div className="row" key={i} style={{ marginBottom: 8, gap: 10 }}>
                  <input
                    style={{ flex: 1 }}
                    placeholder="Ex.: Refrigerante lata"
                    value={ex.nome}
                    onChange={(e) => setExtra(i, { nome: e.target.value })}
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    style={{ width: 70 }}
                    value={ex.quantidade}
                    onChange={(e) => setExtra(i, { quantidade: e.target.value })}
                  />
                  <input
                    inputMode="decimal"
                    style={{ width: 120 }}
                    placeholder="0,00"
                    value={ex.preco}
                    onChange={(e) => setExtra(i, { preco: e.target.value })}
                  />
                  <div style={{ width: 90, textAlign: "right" }}>{formatBRL(extraSubtotal(ex))}</div>
                  <button className="btn btn-icon btn-danger" onClick={() => delExtra(i)} title="Remover">
                    <IconTrash />
                  </button>
                </div>
              ))}
            </>
          )}

          <div className="field" style={{ marginTop: 18 }}>
            <label>Observacoes (opcional)</label>
            <textarea
              value={form.obs}
              onChange={(e) => setForm({ ...form, obs: e.target.value })}
              placeholder="Sem cebola, entrega 12h, troco para R$ 100..."
            />
          </div>
        </Modal>
      )}
    </>
  );
}
