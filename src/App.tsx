import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  IconDashboard,
  IconCart,
  IconWallet,
  IconPricing,
  IconGear,
} from "./components/icons";
import { autoBackup } from "./lib/backup";
import { checkUpdate, downloadAndInstall, type Update } from "./lib/update";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: <IconDashboard /> },
  { to: "/vendas", label: "Vendas", icon: <IconCart /> },
  { to: "/despesas", label: "Despesas", icon: <IconWallet /> },
  { to: "/precificacao", label: "Precificacao", icon: <IconPricing /> },
  { to: "/config", label: "Configuracoes", icon: <IconGear /> },
];

export default function App() {
  const [upd, setUpd] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    // backup automatico a cada abertura
    autoBackup();
    // checagem silenciosa de atualizacao (ignora erros em dev/sem internet)
    checkUpdate()
      .then((u) => {
        if (u) setUpd(u);
      })
      .catch(() => {});
  }, []);

  const instalar = async () => {
    if (!upd) return;
    setInstalling(true);
    try {
      await downloadAndInstall(upd, setPct);
    } catch (e) {
      console.error(e);
      alert("Nao foi possivel atualizar agora. Tente novamente mais tarde.");
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
            <span>Gestao inteligente</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
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
        <div className="sidebar-foot">v0.3 &middot; dados locais</div>
      </aside>
      <main className="content">
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
