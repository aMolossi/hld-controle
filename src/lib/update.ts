import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type { Update };

/** Verifica se ha atualizacao. Retorna o objeto Update ou null. */
export async function checkUpdate(): Promise<Update | null> {
  return await check();
}

/** Baixa e instala a atualizacao, reportando progresso (0-100), e reinicia o app. */
export async function downloadAndInstall(
  update: Update,
  onProgress?: (pct: number) => void,
): Promise<void> {
  let total = 0;
  let baixado = 0;
  await update.downloadAndInstall((ev) => {
    switch (ev.event) {
      case "Started":
        total = ev.data.contentLength ?? 0;
        break;
      case "Progress":
        baixado += ev.data.chunkLength;
        if (onProgress && total > 0) onProgress(Math.min(100, Math.round((baixado / total) * 100)));
        break;
      case "Finished":
        if (onProgress) onProgress(100);
        break;
    }
  });
  await relaunch();
}
