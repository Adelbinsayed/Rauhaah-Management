mod db;

use tauri::Manager;

#[tauri::command]
fn close_splashscreen(app: tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state = db::init_db().expect("Failed to initialize portable SQLite database");

    tauri::Builder::default()
        .manage(db_state)
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            db::db_query,
            db::db_execute,
            db::db_batch_tx,
            db::db_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
