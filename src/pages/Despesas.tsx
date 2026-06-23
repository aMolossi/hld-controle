import { useCallback, useEffect, useMemo, useState } from "react";
import type { Despesa, DespesaCategoria } from "../lib/types";
import { exec, query } from "../lib/db";
import { formatBRL, formatDateBR } from "../lib/format";
import type { Period } from "../lib/dates";
import { monthRange, todayISO } from "../lib/dates";
import PeriodFilter from "../components/PeriodFilter";
import type { Preset } from "../components/PeriodFilter";
import Modal from "../components/Modal";
import { IconEdit, IconPlus, IconTrash, IconWallet } from "../components/icons";
import { useConfirm } from "../components/Confirm";
import EmptyState from "../components/EmptyState";

interface FormState {
  id: number | null;
  data: string;
  categoria: string;
  descricao: string;
  valor: string;
  tipo: string;
  recorrente: boolean;
}

const emptyForm = (cats: DespesaCategoria[]): FormState => ({
  id: null,
  data: todayISO(),
  categoria: cats[0]?.nome ?? "",
  descricao: "",
  valor: "",
  tipo: cats[0]?.tipo ?? "variavel",
  recorrente: false,
});

const parseValor = (s: string) => parseFloat(s.replace(",", ".")) || 0;

export default function Despesas() {
  const [period, setPeriod] = useState<Period>(monthRange());
  const [preset, setPreset] = useState<Preset>("mes");
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [cats, setCats] = useState<DespesaCategoria[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm([]));
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const { ask, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const rows = await query<Despesa>(
      "SELECT * FROM despesas WHERE data BETWEEN ? AND ? ORDER BY data DESC, id DESC",
      [period.inicio, period.fim],
    );
    setDespesas(rows);
  }, [period]);

  useEffect(() => {
    query<DespesaCategoria>("SELECT * FROM despesa_categorias ORDER BY ordem, nome").then(setCats);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm(cats));
    setOpen(true);
  };

  const openEdit = (d: Despesa) => {
    setForm({
      id: d.id,
      data: d.data,
      categoria: d.categoria,
      descricao: d.descricao ?? "",
      valor: String(d.valor).replace(".", ","),
      tipo: d.tipo,
      recorrente: !!d.recorrente,
    });
    setOpen(true);
  };

  const onCategoria = (nome: string) => {
    const c = cats.find((x) => x.nome === nome);
    setForm((f) => ({ ...f, categoria: nome, tipo: c?.tipo ?? f.tipo }));
  };

  const save = async () => {
    const valor = parseValor(form.valor);
    if (valor <= 0) {
      alert("Informe um valor maior que zero.");
      return;
    }
    if (!form.categoria) {
      alert("Selecione uma categoria.");
      return;
    }
    setBusy(true);
    try {
      if (form.id == null) {
        await exec(
          "INSERT INTO despesas (data,categoria,descricao,valor,tipo,recorrente) VALUES (?,?,?,?,?,?)",
          [form.data, form.categoria, form.descricao, valor, form.tipo, form.recorrente ? 1 : 0],
        );
      } else {
        await exec(
          "UPDATE despesas SET data=?,categoria=?,descricao=?,valor=?,tipo=?,recorrente=? WHERE id=?",
          [form.data, form.categoria, form.descricao, valor, form.tipo, form.recorrente ? 1 : 0, form.id],
        );
      }
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: Despesa) => {
    if (!(await ask(`Excluir a despesa "${d.categoria}" de ${formatBRL(d.valor)}?`))) return;
    await exec("DELETE FROM despesas WHERE id=?", [d.id]);
    await load();
  };

  const filteredDespesas = useMemo(() => {
    if (!search.trim()) return despesas;
    const q = search.toLowerCase();
    return despesas.filter(
      (d) =>
        d.categoria.toLowerCase().includes(q) ||
        (d.descricao ?? "").toLowerCase().includes(q),
    );
  }, [despesas, search]);

  const total = filteredDespesas.reduce((s, d) => s + d.valor, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Despesas</div>
          <div className="page-sub">Saídas, custos, taxas e investimentos</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <IconPlus /> Nova despesa
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
          placeholder="Buscar categoria, descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="spacer" />
        <div className="muted">
          {filteredDespesas.length} lançamento(s) &middot;{" "}
          <strong className="neg">{formatBRL(total)}</strong>
        </div>
      </div>

      {despesas.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconWallet size={48} />}
            title="Nenhuma despesa no período"
            body="Lance custos fixos (aluguel, salários) e variáveis (ingredientes, embalagens) para calcular o lucro real do negócio."
            action={{ label: "Nova despesa", onClick: openNew }}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Categoria</th>
                <th>Descricao</th>
                <th>Tipo</th>
                <th className="t-right">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDespesas.map((d) => (
                <tr key={d.id}>
                  <td className="nowrap">{formatDateBR(d.data)}</td>
                  <td>
                    {d.categoria}
                    {d.recorrente ? <span className="muted"> &middot; fixa/mes</span> : null}
                  </td>
                  <td>{d.descricao || <span className="muted">-</span>}</td>
                  <td>
                    <span className={"pill " + (d.tipo === "fixo" ? "pill-fixo" : "pill-var")}>
                      {d.tipo === "fixo" ? "Fixo" : "Variável"}
                    </span>
                  </td>
                  <td className="t-right neg">
                    <strong>{formatBRL(d.valor)}</strong>
                  </td>
                  <td>
                    <div className="t-actions">
                      <button className="btn btn-icon btn-ghost" onClick={() => openEdit(d)} title="Editar">
                        <IconEdit />
                      </button>
                      <button className="btn btn-icon btn-danger" onClick={() => remove(d)} title="Excluir">
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ConfirmDialog}

      {open && (
        <Modal
          title={form.id == null ? "Nova despesa" : "Editar despesa"}
          onClose={() => setOpen(false)}
          width={520}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Salvando..." : "Salvar despesa"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field">
              <label>Data</label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Valor</label>
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Categoria</label>
              <select value={form.categoria} onChange={(e) => onCategoria(e.target.value)}>
                {cats.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="variavel">Variável</option>
                <option value="fixo">Fixo</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Descricao (opcional)</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex.: conta de luz junho, 20kg de arroz..."
            />
          </div>

          <label className="checkrow" style={{ marginTop: 16 }}>
            <input
              type="checkbox"
              checked={form.recorrente}
              onChange={(e) => setForm({ ...form, recorrente: e.target.checked })}
            />
            Despesa recorrente (se repete todo mes)
          </label>
        </Modal>
      )}
    </>
  );
}
