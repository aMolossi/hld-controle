import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  variant?: "" | "gold" | "good" | "bad";
  valueClass?: "" | "pos" | "neg";
  icon?: ReactNode;
}

export default function KpiCard({
  label,
  value,
  sub,
  variant = "",
  valueClass = "",
  icon,
}: Props) {
  return (
    <div className={"kpi " + variant}>
      <div className="kpi-label">
        {icon}
        {label}
      </div>
      <div className={"kpi-value " + valueClass}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
