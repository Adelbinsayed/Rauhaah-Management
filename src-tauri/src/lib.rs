mod auth;
mod backup;
mod db;
mod printer;

use tauri::Manager;

#[tauri::command]
fn close_splashscreen(app: tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

#[tauri::command]
fn export_csv_file(filename: String, content: String) -> Result<String, String> {
    if filename.contains("..")
        || filename.contains('/')
        || filename.contains('\\')
        || filename.contains(':')
        || filename.contains('"')
        || filename.contains('\0')
    {
        return Err("Invalid filename".into());
    }

    let file_name = std::path::Path::new(&filename)
        .file_name()
        .and_then(|s| s.to_str())
        .map(str::trim)
        .filter(|s| {
            !s.is_empty()
                && !s.contains("..")
                && !s.contains('/')
                && !s.contains('\\')
                && !s.contains(':')
                && !s.contains('"')
                && !s.contains('\0')
        })
        .ok_or_else(|| "Invalid filename".to_string())?;

    let user_profile = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".into());
    let mut download_dir = std::path::PathBuf::from(&user_profile).join("Downloads");
    if !download_dir.exists() {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                download_dir = parent.join("exports");
            }
        }
    }
    let _ = std::fs::create_dir_all(&download_dir);

    let clean_filename = if file_name.ends_with(".csv") {
        file_name.to_string()
    } else {
        format!("{file_name}.csv")
    };

    let target_path = download_dir.join(&clean_filename);
    std::fs::write(&target_path, content.as_bytes())
        .map_err(|e| format!("Failed to save CSV file: {e}"))?;

    let path_str = target_path.to_string_lossy().to_string();

    Ok(path_str)
}

fn allowed_reveal_roots(state: &db::DbState) -> Vec<std::path::PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        candidates.push(std::path::PathBuf::from(home).join("Downloads"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("exports"));
        }
    }
    candidates.push(state.backups_dir.clone());
    candidates.push(state.data_dir.clone());
    candidates.push(state.import_dir.clone());
    if let Some(portable_root) = state.data_dir.parent() {
        candidates.push(portable_root.join("exports"));
    }

    candidates
        .into_iter()
        .filter_map(|p| std::fs::canonicalize(p).ok())
        .collect()
}

#[cfg(target_os = "windows")]
fn strip_win_unc_prefix(path: &std::path::Path) -> String {
    let raw = path.to_string_lossy().to_string();
    raw.strip_prefix(r"\\?\").unwrap_or(&raw).to_string()
}

#[tauri::command]
fn reveal_in_explorer(state: tauri::State<'_, db::DbState>, path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty()
        || trimmed.contains('"')
        || trimmed.contains('\0')
        || trimmed.contains('\r')
        || trimmed.contains('\n')
    {
        return Err("Invalid path".into());
    }

    let allowed_roots = allowed_reveal_roots(&state);

    #[cfg(target_os = "windows")]
    let mut path_obj = {
        let win_path = trimmed.replace('/', "\\");
        std::path::PathBuf::from(&win_path)
    };
    #[cfg(not(target_os = "windows"))]
    let mut path_obj = std::path::PathBuf::from(trimmed);

    if !path_obj.exists() {
        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            let dl_path = std::path::PathBuf::from(home)
                .join("Downloads")
                .join(&path_obj);
            if dl_path.exists() {
                path_obj = dl_path;
            }
        }
    }

    let canonical = std::fs::canonicalize(&path_obj)
        .map_err(|e| format!("Target path does not exist or cannot be resolved: {e}"))?;

    if !allowed_roots.iter().any(|root| canonical.starts_with(root)) {
        return Err("Access denied: path is outside allowed application directories".into());
    }

    let canonical_str = canonical.to_string_lossy();
    if canonical_str.contains('"')
        || canonical_str.contains('\0')
        || canonical_str.contains('\r')
        || canonical_str.contains('\n')
    {
        return Err("Invalid resolved path".into());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let clean_str = strip_win_unc_prefix(&canonical).replace('/', "\\");
        if canonical.is_file() {
            std::process::Command::new("explorer")
                .raw_arg(format!("/select,\"{}\"", clean_str))
                .spawn()
                .map_err(|e| format!("Failed to launch explorer: {e}"))?;
        } else {
            std::process::Command::new("explorer")
                .raw_arg(format!("\"{}\"", clean_str))
                .spawn()
                .map_err(|e| format!("Failed to launch explorer: {e}"))?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        let target = if canonical.is_file() {
            canonical.parent().unwrap_or(&canonical).to_path_buf()
        } else {
            canonical
        };
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("Failed to launch file manager: {e}"))?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state = db::init_db().expect("Failed to initialize portable SQLite database");

    tauri::Builder::default()
        .manage(db_state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(8000));
                if app_handle.get_webview_window("splash").is_some() {
                    close_splashscreen(app_handle);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            export_csv_file,
            reveal_in_explorer,
            printer::get_printers,
            printer::get_default_printer,
            printer::print_raw_escpos,
            printer::print_network_escpos,
            backup::create_backup,
            backup::list_backups,
            backup::restore_backup,
            backup::export_backup_to_downloads,
            backup::delete_backup,
            backup::get_db_health,
            db::db_query,
            db::db_execute,
            db::db_batch_tx,
            db::db_info,
            auth::hash_password,
            auth::verify_password
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
