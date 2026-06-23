import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { exec } from "./db";

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}${p(d.getSeconds())}`;
}

/** VACUUM INTO gera um snapshot integro do banco, mesmo com o app aberto. */
async function snapshotTo(path: string): Promise<void> {
  await exec("VACUUM INTO ?", [path]);
}

/** Backup automatico na pasta de dados; mantem os `keep` mais recentes. */
export async function autoBackup(keep = 15): Promise<void> {
  try {
    const path = await invoke<string>("prepare_backup_path", { nome: `hld-${stamp()}.db` });
    await snapshotTo(path);
    await invoke("prune_backups", { keep });
  } catch (e) {
    console.error("auto-backup falhou:", e);
  }
}

/** Exporta um backup para um local escolhido pelo usuario. Retorna o caminho ou null. */
export async function exportBackup(): Promise<string | null> {
  const path = await save({
    title: "Exportar backup",
    defaultPath: `hld-backup-${stamp()}.db`,
    filters: [{ name: "Banco SQLite", extensions: ["db"] }],
  });
  if (!path) return null;
  await snapshotTo(path);
  return path;
}

/** Seleciona um arquivo de backup e agenda a restauracao (efetiva no proximo start). */
export async function restoreBackup(): Promise<boolean> {
  const sel = await open({
    title: "Restaurar backup",
    multiple: false,
    directory: false,
    filters: [{ name: "Banco SQLite", extensions: ["db"] }],
  });
  if (!sel || Array.isArray(sel)) return false;
  await invoke("restore_backup", { src: sel });
  return true;
}

export async function listBackups(): Promise<string[]> {
  try {
    return await invoke<string[]>("list_backups");
  } catch {
    return [];
  }
}

export async function appDataPath(): Promise<string> {
  try {
    return await invoke<string>("app_config_path");
  } catch {
    return "";
  }
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
