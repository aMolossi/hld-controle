import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  IconDashboard,
  IconCalendar,
  IconCart,
  IconUsers,
  IconWallet,
  IconPricing,
  IconGear,
} from "./components/icons";
import { autoBackup } from "./lib/backup";
import { checkUpdate, downloadAndInstall, type Update } from "./lib/update";
import { query } from "./lib/db";
import { readLicenseInfo } from "./lib/license";
import type { LicenseInfo } from "./lib/license";

const NAV_ALL = [
  { to: "/dashboard", label: "Dashboard", icon: <IconDashboard />, tier: "starter" },
  { to: "/hoje", label: "Hoje", icon: <IconCalendar />, tier: "pro" },
  { to: "/vendas", label: "Vendas", icon: <IconCart />, tier: "starter" },
  { to: "/clientes", label: "Clientes", icon: <IconUsers />, tier: "pro" },
  { to: "/despesas", label: "Despesas", icon: <IconWallet />, tier: "starter" },
  { to: "/precificacao", label: "Precificação", icon: <IconPricing />, tier: "starter" },
  { to: "/config", label: "Configurações", icon: <IconGear />, tier: "starter" },
];

export default function App() {
  const navigate = useNavigate();
  const [upd, setUpd] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [pct, setPct] = useState(0);
  const [licInfo, setLicInfo] = useState<LicenseInfo | null>(null);

  useEffect(() => {
    const init = async () => {
      // 1. Verificar licença
      const lic = await readLicenseInfo();
      if (!lic || !lic.valid) {
        navigate("/activate");
        return;
      }
      setLicInfo(lic);

      // 2. Verificar onboarding
      const rows = await query<{ valor: string }>(
        "SELECT valor FROM config WHERE chave='setup_complete'",
      );
      if (!rows[0] || rows[0].valor !== "true") {
        navigate("/onboarding");
        return;
      }

      autoBackup();
      checkUpdate()
        .then((u) => { if (u) setUpd(u); })
        .catch(() => {});
    };
    init();
  }, [navigate]);

  const nav = NAV_ALL.filter((n) => !licInfo || licInfo.tier === "pro" || n.tier === "starter");

  const instalar = async () => {
    if (!upd) return;
    setInstalling(true);
    try {
      await downloadAndInstall(upd, setPct);
    } catch (e) {
      console.error(e);
      alert("Não foi possível atualizar agora. Tente novamente mais tarde.");
      setInstalling(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">HC</div>
          <div className="brand-text">
            <strong>HubControl</strong>
            <span>Gestão inteligente</span>
          </div>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
            >
              <span className="nav-ico">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          {licInfo
            ? `${licInfo.tier === "pro" ? "Pro" : "Starter"} · dados locais`
            : "dados locais"}
        </div>
      </aside>
      <main className="content">
        {licInfo?.inGrace && (
          <div className="update-banner" style={{ background: "rgba(197,52,31,0.18)" }}>
            <span>
              Licença expirou em <strong>{licInfo.expiry}</strong>. Renove para continuar usando após o período de carência.
            </span>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={() => navigate("/activate")}>
              Renovar licença
            </button>
          </div>
        )}
        {upd && (
          <div className="update-banner">
            <span>
              Nova versao <strong>{upd.version}</strong> disponivel.
            </span>
            <span className="spacer" />
            <button className="btn btn-sm btn-primary" onClick={instalar} disabled={installing}>
              {installing ? `Instalando... ${pct}%` : "Atualizar agora"}
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
