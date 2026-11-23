#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        let log_file = exe_dir.join("panic.txt");
        let msg = format!("{info}\n\nBacktrace:\n{:?}", std::backtrace::Backtrace::capture());
        let _ = std::fs::write(&log_file, &msg);
        eprintln!("{msg}");
    }));

    rauhaah_management_lib::run()
}

