import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import Vendas from "./pages/Vendas";
import Despesas from "./pages/Despesas";
import Precificacao from "./pages/Precificacao";
import Config from "./pages/Config";
import "./theme.css";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "vendas", element: <Vendas /> },
      { path: "despesas", element: <Despesas /> },
      { path: "precificacao", element: <Precificacao /> },
      { path: "config", element: <Config /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
