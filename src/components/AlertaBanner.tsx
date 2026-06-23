import { useNavigate } from "react-router-dom";
import type { Alerta } from "../lib/calc";

interface Props {
  alertas: Alerta[];
  onDismiss: (tipo: string) => void;
}

const ICON: Record<string, string> = {
  critico: "🔴",
  aviso: "⚠️",
};

export default function AlertaBanner({ alertas, onDismiss }: Props) {
  const navigate = useNavigate();
  if (alertas.length === 0) return null;

  return (
    <div className="alerta-stack">
      {alertas.slice(0, 2).map((a) => (
        <div key={a.tipo} className={`alerta-banner alerta-${a.severidade}`}>
          <span className="alerta-icon" aria-hidden="true">
            {ICON[a.severidade]}
          </span>
          <span className="alerta-msg">{a.mensagem}</span>
          <div className="alerta-actions">
            {a.acao && (
              <button
                className="btn btn-sm btn-ghost"
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => navigate(a.acao!.rota)}
              >
                {a.acao.label} →
              </button>
            )}
            <button
              className="alerta-dismiss"
              onClick={() => onDismiss(a.tipo)}
              title="Dispensar por hoje"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
