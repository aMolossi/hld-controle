import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Venda } from "../lib/types";
import { exec, query } from "../lib/db";
import { formatBRL } from "../lib/format";
import { todayISO } from "../lib/dates";
import { IconCalendar, IconCheck, IconPlus } from "../components/icons";
import EmptyState from "../components/EmptyState";

type FiltroHoje = "todos" | "pendentes" | "entregues" | "fiados";

interface ResumoTamanho {
  tamanho: string;
  qtd: number;
}

export default function Hoje() {
  const navigate = useNavigate();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [resumoProd, setResumoProd] = useState<ResumoTamanho[]>([]);
  const [filtro, setFiltro] = useState<FiltroHoje>("todos");
  const hoje = todayISO();

  const load = useCallback(async () => {
    const rows = await query<Venda>(
      "SELECT * FROM vendas WHERE data = ? ORDER BY COALESCE(hora_pedido,'99:99') ASC, id ASC",
      [hoje],
    );
    setVendas(rows);

    const res = await query<ResumoTamanho>(
      "SELECT vi.tamanho, COALESCE(SUM(vi.quantidade),0) AS qtd FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id WHERE v.data = ? GROUP BY vi.tamanho ORDER BY vi.tamanho",
      [hoje],
    );
    setResumoProd(res);
  }, [hoje]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleEntrega = async (v: Venda) => {
    const novo = v.status_entrega === "entregue" ? "pendente" : "entregue";
    await exec("UPDATE vendas SET status_entrega=? WHERE id=?", [novo, v.id]);
    await load();
  };

  const lista = useMemo(() => {
    switch (filtro) {
      case "pendentes":
        return vendas.filter((v) => (v.status_entrega ?? "pendente") === "pendente");
      case "entregues":
        return vendas.filter((v) => v.status_entrega === "entregue");
      case "fiados":
        return vendas.filter((v) => v.status_pagamento === "pendente");
      default:
        return vendas;
    }
  }, [vendas, filtro]);

  const totalFaturamento = vendas.reduce((s, v) => s + v.total, 0);
  const totalPendentes = vendas.filter((v) => (v.status_entrega ?? "pendente") === "pendente").length;
  const totalEntregues = vendas.filter((v) => v.status_entrega === "entregue").length;
  const totalMarmitas = vendas.reduce((s, v) => s + (v.qtd_marmitas || 0), 0);

  const resumoHeader = resumoProd.map((r) => `${r.qtd}×${r.tamanho}`).join(" · ");

  const hoje_br = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Hoje</div>
          <div className="page-sub" style={{ textTransform: "capitalize" }}>{hoje_br}</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/vendas")}>
          <IconPlus /> Novo pedido
        </button>
      </div>

      {/* Header resumo */}
      <div className="hoje-header-cards">
        <div className="hoje-stat">
          <div className="hoje-stat-val">{vendas.length}</div>
          <div className="hoje-stat-lab">pedidos</div>
        </div>
        <div className="hoje-stat">
          <div className="hoje-stat-val">{totalMarmitas}</div>
          <div className="hoje-stat-lab">marmitas</div>
        </div>
        <div className="hoje-stat">
          <div className="hoje-stat-val pos">{totalEntregues}</div>
          <div className="hoje-stat-lab">entregues</div>
        </div>
        <div className="hoje-stat">
          <div className="hoje-stat-val" style={{ color: "var(--gold)" }}>{totalPendentes}</div>
          <div className="hoje-stat-lab">pendentes</div>
        </div>
        <div className="hoje-stat" style={{ flex: 2 }}>
          <div className="hoje-stat-val gold">{formatBRL(totalFaturamento)}</div>
          <div className="hoje-stat-lab">faturamento</div>
        </div>
      </div>

      {/* Card de produção */}
      {resumoProd.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head" style={{ marginBottom: 12 }}>
            <span className="card-title">Resumo de produção</span>
            {resumoHeader && <span className="muted" style={{ fontSize: 13 }}>{resumoHeader}</span>}
          </div>
          <div className="hoje-prod-grid">
            {resumoProd.map((r) => (
              <div key={r.tamanho} className="hoje-prod-item">
                <span className="tag-size" style={{ width: 36, height: 36, fontSize: 16 }}>{r.tamanho}</span>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "var(--gold-bright)", lineHeight: 1 }}>
                    {r.qtd}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>unidades</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="btn-group">
          {(["todos", "pendentes", "entregues", "fiados"] as FiltroHoje[]).map((f) => (
            <button
              key={f}
              className={"btn btn-sm btn-ghost" + (filtro === f ? " active" : "")}
              onClick={() => setFiltro(f)}
            >
              {f === "todos" ? "Todos" : f === "pendentes" ? "Pendentes" : f === "entregues" ? "Entregues" : "Fiados"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de pedidos */}
      {vendas.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconCalendar size={48} />}
            title="Nenhum pedido hoje"
            body="Lance o primeiro pedido do dia e acompanhe entregas, pagamentos e produção em tempo real."
            action={{ label: "Novo pedido", onClick: () => navigate("/vendas") }}
          />
        </div>
      ) : lista.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconCalendar size={48} />}
            title="Nenhum pedido neste filtro"
            body="Tente outro filtro ou adicione um novo pedido."
          />
        </div>
      ) : (
        <div className="hoje-lista">
          {lista.map((v) => {
            const entregue = v.status_entrega === "entregue";
            const fiado = v.status_pagamento === "pendente";
            return (
              <div
                key={v.id}
                className={"hoje-item" + (entregue ? " hoje-item-entregue" : "")}
              >
                <button
                  className={"hoje-entrega-btn" + (entregue ? " entregue" : "")}
                  onClick={() => toggleEntrega(v)}
                  title={entregue ? "Marcar como pendente" : "Marcar como entregue"}
                >
                  {entregue ? <IconCheck /> : <span style={{ fontSize: 18, lineHeight: 1 }}>○</span>}
                </button>

                <div className="hoje-item-body">
                  <div className="hoje-item-top">
                    <span className="hoje-item-cliente">
                      {v.tipo_venda === "Empresa"
                        ? (v.empresa || "Empresa")
                        : (v.cliente_nome || <span className="muted">Cliente</span>)}
                    </span>
                    {v.hora_pedido && (
                      <span className="muted" style={{ fontSize: 12 }}>{v.hora_pedido}</span>
                    )}
                  </div>
                  <div className="hoje-item-detalhe">
                    <span>{v.itens_resumo || `${v.qtd_marmitas} marmita(s)`}</span>
                    {v.bairro && <span className="muted"> · {v.bairro}</span>}
                  </div>
                </div>

                <div className="hoje-item-right">
                  <div className="gold" style={{ fontWeight: 800, fontSize: 15 }}>
                    {formatBRL(v.total)}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {fiado ? (
                      <span className="pill pill-pendente" style={{ fontSize: 11 }}>Fiado</span>
                    ) : (
                      <span className="pill pill-pago" style={{ fontSize: 11 }}>{v.forma_pagamento ?? "PIX"}</span>
                    )}
                    {entregue ? (
                      <span className="pill pill-pago" style={{ fontSize: 11 }}>Entregue</span>
                    ) : (
                      <span className="pill pill-pendente" style={{ fontSize: 11 }}>Pendente</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
