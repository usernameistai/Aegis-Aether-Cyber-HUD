// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 1. SET THE STEALTH CLOAK FIRST
    // This must happen before the library run() starts the window
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu");

    // 2. LAUNCH THE CORE MISSION
    cyber_hud_lib::run()
}