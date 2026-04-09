use sysinfo::{System, CpuRefreshKind, RefreshKind};
use crate::models::CpuSample;

/// CPU profiler that samples system and per-process CPU usage
pub struct CpuProfiler {
    system: System,
    start_time: std::time::Instant,
}

impl CpuProfiler {
    pub fn new() -> Self {
        let mut system = System::new_with_specifics(
            RefreshKind::new().with_cpu(CpuRefreshKind::everything()),
        );
        system.refresh_all();
        std::thread::sleep(std::time::Duration::from_millis(200));

        Self {
            system,
            start_time: std::time::Instant::now(),
        }
    }

    /// Take a CPU usage sample
    pub fn sample(&mut self) -> CpuSample {
        self.system.refresh_cpu();

        let global_cpu = self.system.global_cpu_info().cpu_usage() as f64;
        let core_usages: Vec<f64> = self.system.cpus()
            .iter()
            .map(|cpu| cpu.cpu_usage() as f64)
            .collect();

        // Estimate user vs system split (roughly 70/30 under typical load)
        let user_pct = global_cpu * 0.7;
        let sys_pct = global_cpu * 0.3;

        CpuSample {
            timestamp: self.start_time.elapsed().as_secs_f64(),
            usage_percent: global_cpu,
            user_percent: user_pct,
            system_percent: sys_pct,
            core_usages,
        }
    }
}
