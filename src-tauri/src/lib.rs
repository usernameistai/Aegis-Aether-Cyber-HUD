#[cfg(windows)]
use std::os::windows::process::CommandExt;

use serde::Serialize;
use std::process::Command;
use sysinfo::{System, Disks};
use std::sync::Mutex;
use tauri::State;
use battery::Manager;

#[derive(Serialize, Clone)]
pub struct NetworkConn {
    protocol: String,
    local: String,
    remote: String,
    state: String,
}

#[derive(Serialize)]
pub struct SystemStats {
    cpu_usage: f32,
    memory_usage: f32,
    disk_io: f32,      // NEW: Disk Activity
    temp: f32,         // NEW: CPU Temperature
    battery: f32,      // NEW: Battery Level
    connections: Vec<NetworkConn>,
}

// Optimized State: We now keep the Component list alive so we don't re-scan every 3 seconds
pub struct AppState {
    pub sys: Mutex<System>,
    // pub components: Mutex<Components>,
}

#[tauri::command]
fn get_system_stats(state: State<'_, AppState>) -> SystemStats {
    // 1. Refresh System Hardware Info
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_all();

    // 2. Refresh Thermals (CPU Temp)
    // let mut components = state.components.lock().unwrap();
    // components.refresh(); // Much lighter than 'new_with_refreshed_list'

    // 1. Build the "Instruction" first
    let mut cmd = Command::new("powershell");
    // Add the arguments (The "What to do")
    cmd.arg("-NoProfile")
       .arg("-Command")
       .arg("(Get-CimInstance -Query 'SELECT HighPrecisionTemperature FROM Win32_PerfRawData_Counters_ThermalZoneInformation WHERE Name LIKE \"%_TZ.TZ00%\"').HighPrecisionTemperature");

    // 2. Add the "Invisibility Cloak" (The "How to do it")
    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); 
    }

    // 3. FINALLY, call .output() to execute the command
    let temp_output = cmd.output();

    let cpu_temp = match temp_output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            // We use parse::<f32>() because we need to do math on the result
            if let Ok(raw) = stdout.parse::<f32>() {
                // Calculation: (Decikelvins / 10) - Absolute Zero
                (raw / 10.0) - 273.15
            } else {
                0.0
            }
        }
        Err(_) => 0.0,
    };

    // RECON PRINT: Verified data appearing in your terminal
    if cpu_temp > 0.0 {
        println!("MISSION STATUS: Thermal Lock Confirmed. CPU at {:.1}°C", cpu_temp);
    } else {
        println!("MISSION STATUS: Thermal Lock Failed. Check Admin Permissions.");
    }

    // 3. Hardware Vitals
    let global_cpu = sys.global_cpu_info().cpu_usage();
    let memory_usage = (sys.used_memory() as f32 / sys.total_memory() as f32) * 100.0;

    // 4. Disk I/O (Basic Activity Check)
    let disks = Disks::new_with_refreshed_list();
    let disk_percent = disks.iter().next().map(|d| {
        let total = d.total_space() as f64;
        let available = d.available_space() as f64;
        if total > 0.0 { ((total - available) / total * 100.0) as f32 } else { 0.0 }
    }).unwrap_or(0.0);

    // 5. Real Battery Logic
    let battery_level = if let Ok(manager) = Manager::new() {
        manager.batteries().ok()
            .and_then(|mut b| b.next())
            .and_then(|b| b.ok())
            .map(|b| b.state_of_charge().value * 100.0)
            .unwrap_or(100.0)
    } else { 100.0 };

    // 6. Network Connections (The Netstat Scan)
    let output = Command::new("netstat").arg("-ano").output().expect("failed netstat");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut connections = Vec::new();

    for line in stdout.lines().skip(4) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        
        // 1. Check if it's a valid line (Length check)
        if parts.len() >= 4 {
            let protocol = parts[0].to_uppercase();
            
            // 2. The Filter Logic:
            // We want all TCP that is ESTABLISHED, OR any UDP (since UDP has no state)
            let is_established = parts.contains(&"ESTABLISHED");
            let is_udp = protocol == "UDP";

            if is_established || is_udp {
                // In UDP, the PID is usually at index 3. In TCP ESTABLISHED, it's at index 4.
                let pid_str = parts[parts.len() - 1]; 
                let process_name = if let Ok(pid) = pid_str.parse::<usize>() {
                    sys.process(sysinfo::Pid::from(pid))
                        .map(|p| p.name().to_string())
                        .unwrap_or_else(|| "System Task".to_string())
                } else { 
                    "System".to_string() 
                };

                connections.push(NetworkConn {
                    // protocol: protocol.clone(),
                    protocol,
                    local: parts[1].to_string(),
                    // UDP remote is often *:* (meaning listening), let's make it look cleaner
                    remote: if parts[2] == "*:*" { "LISTENING".to_string() } else { parts[2].to_string() },
                    state: process_name, // Your state column is showing the Process Name—nice touch!
                });
            }
        }
    }

    SystemStats {
        cpu_usage: global_cpu,
        memory_usage,
        disk_io: disk_percent, 
        temp: cpu_temp,
        battery: battery_level as f32, // We will hook up the real battery sensor next
        connections,
    }
}

#[tauri::command]
fn get_startup_apps() -> Vec<String> {
    // We use PowerShell to peek at the Registry keys you identified
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg("Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name")
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|s| s.to_string())
                .take(6) // Keep the UI clean with top 6 entries
                .collect()
        }
        Err(_) => vec!["ACCESS_DENIED".to_string()],
    }
}

pub fn run() {
    tauri::Builder::default()
        // .on_window_event(|_window, _event| {})
        .manage(AppState { 
            sys: Mutex::new(System::new_all()),
            // components: Mutex::new(Components::new_with_refreshed_list()),
            // components: Mutex::new(Components::new()), // Start empty
        })
        .invoke_handler(tauri::generate_handler![get_system_stats, get_startup_apps])
        .run(tauri::generate_context!())
        .expect("error while running tauri");
}