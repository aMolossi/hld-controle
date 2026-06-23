use base64::Engine;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

type HmacSha256 = Hmac<Sha256>;

// Chave secreta usada para assinar as licenças.
// Altere antes de distribuir builds para clientes diferentes.
const LICENSE_SECRET: &[u8] = b"hubcontrol-license-key-2024-hld";

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct LicensePayload {
    c: String, // cliente
    e: String, // expiry YYYY-MM-DD
    t: String, // tier: starter | pro
}

/// Valida a assinatura HMAC-SHA256 de uma chave de licença e devolve o payload decodificado.
/// Formato: HUBCTRL-<base64url_payload>.<base64url_sig>
/// Não verifica data de expiração — isso é responsabilidade do frontend.
#[tauri::command]
fn activate_license(key: String) -> Result<serde_json::Value, String> {
    let rest = key
        .trim()
        .strip_prefix("HUBCTRL-")
        .ok_or("Chave inválida: prefixo incorreto")?;

    let dot = rest
        .rfind('.')
        .ok_or("Chave inválida: formato incorreto (falta separador)")?;
    let payload_b64 = &rest[..dot];
    let sig_b64 = &rest[dot + 1..];

    // Verificar HMAC sobre o payload em base64url
    let mut mac =
        HmacSha256::new_from_slice(LICENSE_SECRET).map_err(|e| e.to_string())?;
    mac.update(payload_b64.as_bytes());

    let sig_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(sig_b64)
        .map_err(|_| "Chave inválida: assinatura corrompida")?;

    mac.verify_slice(&sig_bytes)
        .map_err(|_| "Chave inválida: assinatura não confere. Verifique a chave e tente novamente.")?;

    // Decodificar payload
    let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| "Chave inválida: payload corrompido")?;

    let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|_| "Chave inválida: dados do payload corrompidos")?;

    Ok(serde_json::json!({
        "cliente": payload.c,
        "expiry": payload.e,
        "tier": payload.t,
    }))
}

/// Caminho da pasta de dados do app (onde fica o hld.db).
#[tauri::command]
fn app_config_path(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_config_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Garante a pasta de backups e devolve o caminho completo do arquivo de backup.
#[tauri::command]
fn prepare_backup_path(app: tauri::AppHandle, nome: String) -> Result<String, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(nome).to_string_lossy().to_string())
}

/// Lista os backups (mais recentes primeiro).
#[tauri::command]
fn list_backups(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    let mut out: Vec<String> = Vec::new();
    if dir.exists() {
        for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".db") {
                    out.push(name.to_string());
                }
            }
        }
    }
    out.sort();
    out.reverse();
    Ok(out)
}

/// Mantem apenas os `keep` backups mais recentes.
#[tauri::command]
fn prune_backups(app: tauri::AppHandle, keep: usize) -> Result<(), String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    if !dir.exists() {
        return Ok(());
    }
    let mut files: Vec<std::path::PathBuf> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map(|x| x == "db").unwrap_or(false))
        .collect();
    files.sort();
    if files.len() > keep {
        for f in &files[..files.len() - keep] {
            let _ = std::fs::remove_file(f);
        }
    }
    Ok(())
}

/// Agenda a restauracao: copia o backup escolhido para hld.db.restore.
/// A troca efetiva acontece no proximo start (antes de abrir o banco).
#[tauri::command]
fn restore_backup(app: tauri::AppHandle, src: String) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::copy(&src, dir.join("hld.db.restore")).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "schema inicial",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "multi-itens, quantidades e venda para empresa",
            sql: include_str!("../migrations/002_multi_itens.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "rastreamento de pagamento por venda",
            sql: include_str!("../migrations/003_pagamento.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "status de entrega e hora do pedido",
            sql: include_str!("../migrations/004_entrega.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "cadastro de clientes e vinculo com vendas",
            sql: include_str!("../migrations/005_clientes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "cardapio dinamico — disponivel_hoje em produtos",
            sql: include_str!("../migrations/006_produtos.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:hld.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            app_config_path,
            prepare_backup_path,
            list_backups,
            prune_backups,
            restore_backup,
            activate_license
        ])
        .setup(|app| {
            // Restauracao pendente: troca o banco antes de qualquer conexao.
            if let Ok(dir) = app.path().app_config_dir() {
                let restore = dir.join("hld.db.restore");
                if restore.exists() {
                    let _ = std::fs::remove_file(dir.join("hld.db-wal"));
                    let _ = std::fs::remove_file(dir.join("hld.db-shm"));
                    if std::fs::copy(&restore, dir.join("hld.db")).is_ok() {
                        let _ = std::fs::remove_file(&restore);
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
