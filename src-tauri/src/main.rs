#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let _ = std::fs::write("panic.txt", format!("{}", info));
    }));

    rauhaah_management_lib::run()
}
