import type { Period } from "../lib/dates";
import { dayRange, lastNDays, monthRange, yearRange } from "../lib/dates";

export type Preset = "hoje" | "7d" | "30d" | "mes" | "ano" | "custom";

interface Props {
  period: Period;
  preset: Preset;
  onChange: (period: Period, preset: Preset) => void;
}

const PRESETS: [Preset, string][] = [
  ["hoje", "Hoje"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["mes", "Mes"],
  ["ano", "Ano"],
];

export default function PeriodFilter({ period, preset, onChange }: Props) {
  const apply = (p: Preset) => {
    switch (p) {
      case "hoje":
        onChange(dayRange(), p);
        break;
      case "7d":
        onChange(lastNDays(7), p);
        break;
      case "30d":
        onChange(lastNDays(30), p);
        break;
      case "mes":
        onChange(monthRange(), p);
        break;
      case "ano":
        onChange(yearRange(), p);
        break;
      default:
        onChange(period, "custom");
    }
  };

  return (
    <div className="period">
      <div className="seg">
        {PRESETS.map(([k, l]) => (
          <button key={k} className={preset === k ? "active" : ""} onClick={() => apply(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="date-inputs">
        <input
          type="date"
          value={period.inicio}
          max={period.fim}
          onChange={(e) => onChange({ ...period, inicio: e.target.value }, "custom")}
        />
        <span>ate</span>
        <input
          type="date"
          value={period.fim}
          min={period.inicio}
          onChange={(e) => onChange({ ...period, fim: e.target.value }, "custom")}
        />
      </div>
    </div>
  );
}
