use crate::db::DbState;
use chrono::{DateTime, Local, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use tauri::State;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupItem {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub created_at: String,
    pub is_safety_snapshot: bool,
    pub integrity_ok: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DbHealthStats {
    pub db_size_bytes: u64,
    pub db_size_formatted: String,
    pub total_sales_count: i64,
    pub total_customers_count: i64,
    pub total_products_count: i64,
    pub integrity_status: String,
    pub last_backup_at: Option<String>,
}

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

#[tauri::command]
pub fn create_backup(
    state: State<'_, DbState>,
    label: Option<String>,
) -> Result<BackupItem, String> {
    fs::create_dir_all(&state.backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {e}"))?;

    let now_local = Local::now();
    let timestamp_str = now_local.format("%Y%m%d_%H%M%S").to_string();

    let clean_label = match label {
        Some(ref l) if !l.trim().is_empty() => {
            let sanitized: String = l
                .trim()
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect();
            format!("_{}", sanitized)
        }
        _ => "".to_string(),
    };

    let filename = format!("rauhaah_backup_{}{}.db", timestamp_str, clean_label);
    let target_path = state.backups_dir.join(&filename);
    let target_path_str = target_path.to_string_lossy().to_string().replace('\\', "/");

    // Lock DB connection and safely snapshot via VACUUM INTO
    {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Database connection lock poisoned".to_string())?;

        // Truncate WAL to ensure everything is flushed to main file
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");

        let vacuum_sql = format!("VACUUM INTO '{}';", target_path_str);
        conn.execute_batch(&vacuum_sql)
            .map_err(|e| format!("VACUUM INTO failed: {e}"))?;
    }

    // Verify integrity of the new backup file
    let integrity_ok = match Connection::open(&target_path) {
        Ok(backup_conn) => {
            let res: Result<String, _> = backup_conn.query_row("PRAGMA integrity_check;", [], |r| r.get(0));
            res.map(|s| s == "ok").unwrap_or(false)
        }
        Err(_) => false,
    };

    let meta = fs::metadata(&target_path)
        .map_err(|e| format!("Failed to read backup file metadata: {e}"))?;
    let size_bytes = meta.len();

    Ok(BackupItem {
        filename,
        path: target_path.to_string_lossy().to_string(),
        size_bytes,
        size_formatted: format_bytes(size_bytes),
        created_at: now_local.to_rfc3339(),
        is_safety_snapshot: clean_label.contains("SAFETY") || clean_label.contains("safety"),
        integrity_ok,
    })
}

#[tauri::command]
pub fn list_backups(state: State<'_, DbState>) -> Result<Vec<BackupItem>, String> {
    if !state.backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    let entries = fs::read_dir(&state.backups_dir)
        .map_err(|e| format!("Failed to read backups directory: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "db" {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    let meta = entry.metadata().ok();
                    let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);

                    let created_time: SystemTime = meta
                        .and_then(|m| m.created().or_else(|_| m.modified()).ok())
                        .unwrap_or_else(SystemTime::now);
                    let created_dt: DateTime<Local> = created_time.into();

                    let is_safety = filename.to_lowercase().contains("safety");

                    items.push(BackupItem {
                        filename,
                        path: path.to_string_lossy().to_string(),
                        size_bytes,
                        size_formatted: format_bytes(size_bytes),
                        created_at: created_dt.to_rfc3339(),
                        is_safety_snapshot: is_safety,
                        integrity_ok: true, // Existing backups assumed ok unless tested
                    });
                }
            }
        }
    }

    // Sort newest backups first
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(items)
}

#[tauri::command]
pub fn restore_backup(
    state: State<'_, DbState>,
    filename: String,
) -> Result<String, String> {
    // Basic sanitization
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid backup filename".into());
    }

    let backup_path = state.backups_dir.join(&filename);
    if !backup_path.exists() {
        return Err(format!("Backup file '{}' does not exist", filename));
    }

    // 1. Validate the source backup file integrity first
    let source_conn = Connection::open_with_flags(
        &backup_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_URI,
    ).map_err(|e| format!("Failed to open backup database: {e}"))?;

    let integrity_check: String = source_conn
        .query_row("PRAGMA integrity_check;", [], |r| r.get(0))
        .map_err(|e| format!("Failed to check backup file integrity: {e}"))?;

    if integrity_check != "ok" {
        return Err(format!("Backup file is corrupted: {integrity_check}"));
    }

    // 2. Lock destination connection
    let mut dest_conn = state
        .conn
        .lock()
        .map_err(|_| "Database connection lock poisoned".to_string())?;

    // 3. Take emergency safety snapshot of current DB before overwriting!
    let now_local = Local::now();
    let safety_filename = format!("rauhaah_backup_{}_PRE_RESTORE_SAFETY.db", now_local.format("%Y%m%d_%H%M%S"));
    let safety_path = state.backups_dir.join(&safety_filename);
    let safety_path_str = safety_path.to_string_lossy().to_string().replace('\\', "/");

    let _ = dest_conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    let safety_sql = format!("VACUUM INTO '{}';", safety_path_str);
    let _ = dest_conn.execute_batch(&safety_sql);

    // 4. Restore using SQLite's online backup API
    {
        let backup = rusqlite::backup::Backup::new(&source_conn, &mut *dest_conn)
            .map_err(|e| format!("Failed to initialize SQLite backup restore: {e}"))?;

        backup
            .run_to_completion(5, std::time::Duration::from_millis(100), None)
            .map_err(|e| format!("Failed during backup restore transfer: {e}"))?;
    }

    // 5. Finalize restored database
    let _ = dest_conn.execute_batch(
        "PRAGMA wal_checkpoint(TRUNCATE);
         PRAGMA optimize;",
    );

    Ok(format!(
        "Database restored successfully from '{}'! (Safety copy saved as '{}')",
        filename, safety_filename
    ))
}

#[tauri::command]
pub fn export_backup_to_downloads(
    state: State<'_, DbState>,
    filename: String,
) -> Result<String, String> {
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid backup filename".into());
    }

    let source_path = state.backups_dir.join(&filename);
    if !source_path.exists() {
        return Err(format!("Backup file '{}' not found", filename));
    }

    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into());
    let download_dir = PathBuf::from(&user_profile).join("Downloads");
    let _ = fs::create_dir_all(&download_dir);

    let target_path = download_dir.join(&filename);
    fs::copy(&source_path, &target_path)
        .map_err(|e| format!("Failed to copy backup to Downloads: {e}"))?;

    let full_str = target_path.to_string_lossy().to_string().replace('/', "\\");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", full_str))
            .spawn();
    }

    Ok(full_str)
}

#[tauri::command]
pub fn delete_backup(
    state: State<'_, DbState>,
    filename: String,
) -> Result<(), String> {
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid backup filename".into());
    }

    let target_path = state.backups_dir.join(&filename);
    if target_path.exists() {
        fs::remove_file(&target_path)
            .map_err(|e| format!("Failed to delete backup file: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_db_health(state: State<'_, DbState>) -> Result<DbHealthStats, String> {
    let db_meta = fs::metadata(&state.db_path).ok();
    let db_size_bytes = db_meta.as_ref().map(|m| m.len()).unwrap_or(0);

    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database connection lock poisoned".to_string())?;

    let integrity_status: String = conn
        .query_row("PRAGMA integrity_check;", [], |r| r.get(0))
        .unwrap_or_else(|_| "unknown".into());

    let total_sales_count: i64 = conn
        .query_row("SELECT count(*) FROM sales WHERE deleted_at IS NULL;", [], |r| r.get(0))
        .unwrap_or(0);

    let total_customers_count: i64 = conn
        .query_row("SELECT count(*) FROM customers WHERE deleted_at IS NULL;", [], |r| r.get(0))
        .unwrap_or(0);

    let total_products_count: i64 = conn
        .query_row("SELECT count(*) FROM products WHERE deleted_at IS NULL;", [], |r| r.get(0))
        .unwrap_or(0);

    // Find last backup time
    let mut last_backup_at = None;
    if state.backups_dir.exists() {
        if let Ok(entries) = fs::read_dir(&state.backups_dir) {
            let mut latest_time = SystemTime::UNIX_EPOCH;
            for entry in entries.flatten() {
                if let Ok(m) = entry.metadata() {
                    if let Ok(time) = m.created().or_else(|_| m.modified()) {
                        if time > latest_time {
                            latest_time = time;
                        }
                    }
                }
            }
            if latest_time != SystemTime::UNIX_EPOCH {
                let dt: DateTime<Utc> = latest_time.into();
                last_backup_at = Some(dt.to_rfc3339());
            }
        }
    }

    Ok(DbHealthStats {
        db_size_bytes,
        db_size_formatted: format_bytes(db_size_bytes),
        total_sales_count,
        total_customers_count,
        total_products_count,
        integrity_status,
        last_backup_at,
    })
}
