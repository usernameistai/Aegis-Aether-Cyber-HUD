import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
const appWindow = getCurrentWindow();

const ipCache: Record<string, string> = {};

const labelColors: Record<string, string> = {
  'CPU_LOAD': 'text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]',
  'MEM_UTIL': 'text-fuchsia-500 drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]',
  'DISK_I/O': 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]',
  'BATTERY': 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]',
};

function App() {            
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [stats, setStats] = useState({ 
    cpu: 0, mem: 0, net: 0, disk_io: 0, temp: 41, battery: 100, connections: [] as any[] 
  });
  const [startupApps, setStartupApps] = useState<string[]>([]);
  const [interrogationLogs, setInterrogationLogs] = useState<string[]>([
  "[SYSTEM] INITIALIZING KEMOSABE_TERMINAL...",
  "[OK] NETWORK_SCANNER_ONLINE"
]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    const fetchStats = async () => {
      try {
        const data = await invoke("get_system_stats") as any;
        const enrichedConnections = await Promise.all((data.connections || []).map(async (conn: any) => {
          const ip = conn.remote.split(':')[0].replace('[', '').replace(']', '');
          if (['127.0.0.1', '0.0.0.0', '::1'].some(local => ip.startsWith(local)) || ip.startsWith('192.168')) {
            return { ...conn, location: 'LOCAL_LOOP' };
          }
          if (ipCache[ip]) return { ...conn, location: ipCache[ip] };
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 1000);
            const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,countryCode`, { signal: controller.signal });
            const geo = await res.json();
            clearTimeout(id);
            const loc = geo.city ? `${geo.city}, ${geo.countryCode}` : 'EXTERNAL';
            ipCache[ip] = loc;
            return { ...conn, location: loc };
          } catch { return { ...conn, location: 'UNKNOWN' }; }
        }));

        // --- MISSION LOGIC START ---
        if (enrichedConnections.length > 0) {
            const target = enrichedConnections[Math.floor(Math.random() * enrichedConnections.length)];
            // Clear the error by actually using the variable in the template string
            const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // Using backticks (`) to include the timestamp variable
            const newLog = `[${timestamp}] INTEL: ${target.state.toUpperCase()} -> ${target.location} (${target.protocol})`;
            
            setInterrogationLogs(prev => [newLog, ...prev].slice(0, 10));
        }
        // --- MISSION LOGIC END ----

        setStats({
          cpu: data.cpu_usage, 
          mem: data.memory_usage, 
          net: 0, 
          disk_io: data.disk_io,
          temp: data.temp, 
          battery: data.battery, 
          connections: enrichedConnections,
        });
      } catch (err) { console.error("STATS_ERROR", err); }
    };
    
    fetchStats();
    const statsInterval = setInterval(fetchStats, 7000);
    return () => { clearInterval(timer); clearInterval(statsInterval); };
  }, []);

  useEffect(() => {
    const fetchStartup = async () => {
      try {
        const apps = await invoke("get_startup_apps") as string[];
        setStartupApps(apps);
      } catch (err) { console.error("REG_ERROR", err); }
    };
    fetchStartup();
  }, []);

  return (
    <div className="relative h-screen w-screen flex flex-col p-6 overflow-hidden rounded font-mono text-fuchsia-500 selection:bg-cyan-500/30">

      {/* SYNTHWAVE GRID BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* The Grid Layer */}
        <div className="cyber-grid-floor" />
        
        {/* The "Horizon Fade" - This creates the dark haze at the top */}
        <div className="absolute inset-0 bg-linear-to-b from-[#0d0221] via-transparent to-transparent z-10" />
      </div>

      <div className="scanline-beam" />

      {/* HEADER */}
      <div 
        style={{ WebkitAppRegion: 'drag' } as any}
        className="flex justify-between items-start border-b border-cyan-500/40 pb-4 mb-6 relative z-50 cursor-grab active:cursor-grabbing"
      >
        {/* Wrap the text in pointer-events-none so it doesn't interfere with the drag */}
        <div className="space-y-1 pointer-events-none">
          <h1 className="text-3xl font-black italic tracking-tighter text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]">
            CYBER_HUD <span className="text-sm not-italic font-light opacity-50">v1.1.0</span>
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-cyan-500/70">
            NODE_LOAD: {stats.cpu.toFixed(1)}%
          </span>
        </div>
        
        {/* CLOCK & CONTROLS SECTION */}
        <div className="flex items-start gap-6">
          <div className="text-right pointer-events-none">
            <div className="text-2xl text-cyan-300 tabular-nums leading-none">{time}</div>
            <div className="text-[10px] text-green-400 font-bold tracking-tighter uppercase flex items-center justify-end gap-2 mt-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Kemosabe_Terminal
            </div>
          </div>

          {/* BUTTONS: Explicitly set to NO-DRAG and ensure they have a high Z-Index */}
          <div 
            style={{ WebkitAppRegion: 'no-drag' } as any} 
            className="flex gap-2 relative z-100 pointer-events-auto"
          >
            <button 
              onClick={() => appWindow.minimize()}
              className="px-3 py-1 rounded-sm bg-cyan-500/10 hover:bg-cyan-300/20 border border-cyan-500/30 text-cyan-400 transition-all cursor-pointer"
            >
              _
            </button>
            <button 
              onClick={() => appWindow.close()}
              className="px-3 py-1 rounded-sm bg-fuchsia-500/10 hover:bg-red-500/40 border border-fuchsia-500/30 text-fuchsia-400 transition-all cursor-pointer"
            >
              X
            </button>
          </div>
        </div>
      </div>

      {/* MAIN INTERFACE */}
      <div className="grow flex gap-4 overflow-hidden relative z-10" style={{ WebkitAppRegion: 'no-drag' } as any}>
        
        {/* NETWORK INTELLIGENCE */}
        <div className="w-2/3 border border-fuchsia-500/30 bg-black/60 rounded-lg p-4 relative flex flex-col group">
          <div className="grid grid-cols-5 text-[10px] text-fuchsia-400/60 uppercase border-b border-fuchsia-500/20 pb-2 mb-2 font-black tracking-widest">
            <span>Prot</span><span>Local</span><span>Remote</span><span>Intelligence</span><span>State</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
            {stats.connections.slice(0, 20).map((conn, i) => (
              <div key={i} className="grid grid-cols-5 text-[11px] hover:bg-fuchsia-500/10 p-1.5 rounded transition-all border-l-2 border-transparent hover:border-cyan-400">
                <span className={conn.protocol === 'UDP' ? 'text-amber-400' : 'text-emerald-400'}>{conn.protocol}</span>
                <span className="truncate opacity-70">{conn.local}</span>
                <span className="text-fuchsia-400 truncate font-bold">{conn.remote}</span>
                <span className="truncate text-[9px] text-cyan-300 uppercase">{conn.location}</span>
                <span className="text-cyan-500/80 font-black truncate">{conn.state}</span>
              </div>
            ))}
          </div>

          {/* BOTTOM SECTION OF NETWORK INTELLIGENCE */}
          <div className="border-t border-fuchsia-500/20 pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 bg-cyan-500 rounded-full animate-ping"></span>
                <span className="text-[9px] text-cyan-400 font-black uppercase tracking-[0.2em]">Live_Interrogation_Stream</span>
              </div>
              <span className="text-[8px] text-fuchsia-500/40 tabular-nums">SEC_STATUS: ACTIVE</span>
            </div>
            
            <div className="h-24 font-mono text-[10px] space-y-1 overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded">
              {interrogationLogs.map((log, i) => (
                <div 
                  key={i} 
                  className={`${i === 0 ? "text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" : "text-cyan-900/60"} transition-all duration-500`}
                >
                  {log}
                </div>
              ))}
              {/* A blinking cursor at the bottom to show it's "thinking" */}
              <div className="text-cyan-500/20 animate-pulse">_</div>
            </div>
          </div>

        </div>
        
        
        {/* VITALS & STARTUP */}
        <div className="w-1/3 flex flex-col gap-6">
          <div className="flex gap-2 mb-2">
            <span className="text-[8px] px-1 border border-red-500 text-red-500 animate-pulse font-bold">SECURE_BOOT: OFF</span>
            <span className="text-[8px] px-1 border border-orange-500 text-orange-500 font-bold">DMA_PROT: DISABLED</span>
          </div>
          <div className="h-1/2 border border-cyan-500/30 bg-black/60 rounded-lg p-5 relative">
            <div className="absolute -top-3 left-4 bg-[#0d0221] px-2 text-[10px] text-cyan-400 font-black tracking-widest border border-cyan-500/30">HARDWARE_METRICS</div>
            <div className={`absolute top-3 right-5 text-[10px] font-black italic ${stats.temp > 90 ? 'text-red-500' : 'text-amber-500'}`}>
              CORE_TEMP: {Math.round(stats.temp)}°C
            </div>
            
            <div className="space-y-6 mt-4 px-1">
              {[
                { label: 'CPU_LOAD', value: stats.cpu, color: 'from-cyan-400 to-blue-600' },
                { label: 'MEM_UTIL', value: stats.mem, color: 'from-fuchsia-500 to-purple-800' }, 
                { label: 'DISK_I/O', value: stats.disk_io, color: 'from-amber-400 to-orange-600' },
                { label: 'BATTERY', value: stats.battery, color: 'from-emerald-400 to-green-700' }
              ].map((item) => {
                // Hard clamp: ensures value is between 0 and 100
                const clampedValue = Math.max(0, Math.min(item.value, 100));
                
                return (
                  <div key={item.label} className="w-full">
                    <div className="flex justify-between text-[10px] mb-2 font-black tracking-tighter">
                      <span className={labelColors[item.label]}>{item.label}</span>
                      <span className="text-white/90">{Math.floor(clampedValue)}%</span>
                    </div>
                    
                    {/* The Outer Frame */}
                    <div className="relative h-3 w-full bg-black/60 border border-fuchsia-500/30 p-px overflow-hidden">
                      {/* The Inner Track (Fixes the "overflowing" look) */}
                      <div className="h-full w-full bg-black/20 overflow-hidden relative">
                        <div 
                          className={`h-full bg-linear-to-r ${item.color} transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(217,70,239,0.4)]`} 
                          style={{ width: `${clampedValue}%` }}
                        />
                        
                        {/* Optional: Cyber-Grid Overlay on the bar itself */}
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[4px_100%] pointer-events-none" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-1/2 border border-fuchsia-500/30 bg-fuchsia-950/5 rounded-lg p-5 overflow-visible flex flex-col relative">
            <div className="absolute -top-3 left-4 bg-[#0d0221] px-2 text-[10px] text-fuchsia-500 font-black tracking-widest border border-fuchsia-500/30">STARTUP_SENTINEL</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar mt-2 pr-2 space-y-3">
              {startupApps.map((app, i) => (
                <div key={i} className="flex justify-between border-b border-fuchsia-500/10 pb-2 items-center group">
                  <span className="text-[10px] text-fuchsia-400 truncate uppercase w-3/4 group-hover:text-cyan-300 transition-colors">{app.replace('PS', '')}</span>
                  <span className="text-[8px] px-1 bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-400 font-black rounded">WATCHING</span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM SECTION: THE SENTINEL TERMINAL */}
          <div className="h-32 border border-cyan-500/30 bg-black/80 rounded-lg p-3 relative overflow-hidden flex flex-col">
            <div className="absolute -top-px left-10 bg-cyan-500 h-0.5 w-20 shadow-[0_0_10px_#22d3ee]"></div>
            <div className="text-[9px] uppercase text-cyan-400/60 mb-2 tracking-[0.2em] flex justify-between">
              <span>Live_Interrogation_Log</span>
              <span className="animate-pulse">System_Ready</span>
            </div>
            
            <div className="flex-1 font-mono text-[10px] space-y-1 overflow-y-auto custom-scrollbar">
              <div className="text-cyan-300/80">[SYSTEM] Initializing Kemosabe_Logic_Bridge...</div>
              <div className="text-green-400/80">[OK] Secure_Boot Check: <span className="text-red-500 animate-pulse underline">VULNERABLE</span></div>
              <div className="text-fuchsia-400">[INTEL] Watching 24 Active Connections...</div>
              {/* This is where we will map live event logs later */}
              <div className="text-cyan-500/40 animate-pulse">_</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
