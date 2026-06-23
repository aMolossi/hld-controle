import { query, exec } from "./db";

export interface LicenseInfo {
  cliente: string;
  expiry: string; // YYYY-MM-DD
  tier: "starter" | "pro";
  daysRemaining: number; // negativo = expirado
  inGrace: boolean; // expirado mas dentro dos 7 dias de carência
  valid: boolean; // false se expirou além da carência
}

const GRACE_DAYS = 7;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export async function readLicenseInfo(): Promise<LicenseInfo | null> {
  const rows = await query<{ valor: string }>(
    "SELECT valor FROM config WHERE chave='license_info'",
  );
  if (!rows[0]) return null;
  try {
    const raw = JSON.parse(rows[0].valor) as { cliente: string; expiry: string; tier: string };
    const today = new Date().toISOString().slice(0, 10);
    const daysRemaining = daysBetween(today, raw.expiry);
    const inGrace = daysRemaining < 0 && daysRemaining >= -GRACE_DAYS;
    const valid = daysRemaining >= -GRACE_DAYS;
    return {
      cliente: raw.cliente,
      expiry: raw.expiry,
      tier: (raw.tier === "pro" ? "pro" : "starter") as "starter" | "pro",
      daysRemaining,
      inGrace,
      valid,
    };
  } catch {
    return null;
  }
}

export async function saveLicenseInfo(
  key: string,
  payload: { cliente: string; expiry: string; tier: string },
): Promise<void> {
  const upsert = (chave: string, valor: string) =>
    exec(
      "INSERT INTO config (chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor",
      [chave, valor],
    );
  await upsert("license_key", key);
  await upsert("license_info", JSON.stringify(payload));
  await upsert("license_valid", "true");
}
