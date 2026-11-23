mod auth;
mod backup;
mod db;
mod printer;

use tauri::Manager;

#[tauri::command]
fn close_splashscreen(app: tauri::AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

#[tauri::command]
fn export_csv_file(filename: String, content: String) -> Result<String, String> {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into());
    let mut download_dir = std::path::PathBuf::from(&user_profile).join("Downloads");
    if !download_dir.exists() {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                download_dir = parent.join("exports");
            }
        }
    }
    let _ = std::fs::create_dir_all(&download_dir);

    let clean_filename = if filename.ends_with(".csv") {
        filename
    } else {
        format!("{}.csv", filename)
    };

    let target_path = download_dir.join(&clean_filename);
    std::fs::write(&target_path, content.as_bytes())
        .map_err(|e| format!("Failed to save CSV file: {e}"))?;

    let path_str = target_path.to_string_lossy().to_string();

    Ok(path_str)
}

#[tauri::command]
fn reveal_in_explorer(path: String) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let win_path = path.trim().replace('/', "\\");
        let mut path_obj = std::path::PathBuf::from(&win_path);

        if !path_obj.exists() {
            let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into());
            let dl_path = std::path::PathBuf::from(&user_profile).join("Downloads").join(&win_path);
            if dl_path.exists() {
                path_obj = dl_path;
            }
        }

        if path_obj.exists() {
            let full_str = path_obj.to_string_lossy().to_string().replace('/', "\\");
            let _ = std::process::Command::new("explorer")
                .raw_arg(format!("/select,\"{}\"", full_str))
                .spawn();
        } else if let Some(parent) = path_obj.parent() {
            if parent.exists() {
                let parent_str = parent.to_string_lossy().to_string().replace('/', "\\");
                let _ = std::process::Command::new("explorer")
                    .raw_arg(format!("\"{}\"", parent_str))
                    .spawn();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state = db::init_db().expect("Failed to initialize portable SQLite database");

    tauri::Builder::default()
        .manage(db_state)
        .setup(|_app| {
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
