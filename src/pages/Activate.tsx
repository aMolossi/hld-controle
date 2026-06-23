import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { readLicenseInfo, saveLicenseInfo } from "../lib/license";
import { query } from "../lib/db";

export default function Activate() {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Redireciona se já tem licença válida
    readLicenseInfo().then((info) => {
      if (info?.valid) {
        query<{ valor: string }>("SELECT valor FROM config WHERE chave='setup_complete'").then(
          (rows) => {
            if (!rows[0] || rows[0].valor !== "true") {
              navigate("/onboarding", { replace: true });
            } else {
              navigate("/dashboard", { replace: true });
            }
          },
        );
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  const ativar = async () => {
    const k = key.trim();
    if (!k) return;
    setBusy(true);
    setError("");
    try {
      const payload = await invoke<{ cliente: string; expiry: string; tier: string }>(
        "activate_license",
        { key: k },
      );
      await saveLicenseInfo(k, payload);
      // Verifica se onboarding foi feito
      const rows = await query<{ valor: string }>(
        "SELECT valor FROM config WHERE chave='setup_complete'",
      );
      if (!rows[0] || rows[0].valor !== "true") {
        navigate("/onboarding", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (checking) return null;

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card" style={{ maxWidth: 480 }}>
        <div className="onb-brand">
          <div className="brand-mark">HC</div>
          <strong>HubControl</strong>
        </div>

        <div className="onb-body">
          <h2 style={{ marginBottom: 6 }}>Ativar licença</h2>
          <p className="muted" style={{ marginBottom: 24, fontSize: 14 }}>
            Cole abaixo a chave de licença recebida após a compra.
          </p>

          <div className="field">
            <label>Chave de licença</label>
            <textarea
              rows={3}
              placeholder="HUBCTRL-..."
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError("");
              }}
              style={{ fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ativar();
                }
              }}
            />
          </div>

          {error && (
            <div className="activate-error">
              {error}
            </div>
          )}
        </div>

        <div className="onb-footer">
          <div />
          <button className="btn btn-primary" onClick={ativar} disabled={busy || !key.trim()}>
            {busy ? "Verificando..." : "Ativar"}
          </button>
        </div>

        <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 16 }}>
          Não tem uma chave? Entre em contato pelo WhatsApp para adquirir sua licença.
        </p>
      </div>
    </div>
  );
}
