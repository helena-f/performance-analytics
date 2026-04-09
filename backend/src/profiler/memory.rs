use sysinfo::{System, Pid, ProcessRefreshKind};
use crate::models::MemorySample;

/// Memory profiler that tracks allocations and usage
pub struct MemoryProfiler {
    system: System,
    start_time: std::time::Instant,
    cumulative_allocs: u64,
    cumulative_deallocs: u64,
    prev_rss: u64,
}

impl MemoryProfiler {
    pub fn new() -> Self {
        Self {
            system: System::new(),
            start_time: std::time::Instant::now(),
            cumulative_allocs: 0,
            cumulative_deallocs: 0,
            prev_rss: 0,
        }
    }

    /// Sample memory usage for a given process
    pub fn sample(&mut self, pid: u32) -> MemorySample {
        self.system.refresh_processes_specifics(
            ProcessRefreshKind::new().with_memory(),
        );

        let (rss, virtual_mem) = if let Some(process) = self.system.process(Pid::from_u32(pid)) {
            (process.memory(), process.virtual_memory())
        } else {
            (0, 0)
        };

        // Estimate allocations based on RSS changes
        if rss > self.prev_rss {
            self.cumulative_allocs += (rss - self.prev_rss) / 4096; // rough page-based estimate
        } else if rss < self.prev_rss {
            self.cumulative_deallocs += (self.prev_rss - rss) / 4096;
        }
        self.prev_rss = rss;

        // Estimate leaks as allocs significantly exceeding deallocs
        let leak_estimate = if self.cumulative_allocs > self.cumulative_deallocs + 100 {
            (self.cumulative_allocs - self.cumulative_deallocs) * 4096
        } else {
            0
        };

        MemorySample {
            timestamp: self.start_time.elapsed().as_secs_f64(),
            rss_bytes: rss,
            virtual_bytes: virtual_mem,
            allocations: self.cumulative_allocs,
            deallocations: self.cumulative_deallocs,
            leaked_bytes: leak_estimate,
        }
    }

    /// Sample system-wide memory (when no specific PID)
    pub fn sample_system(&mut self) -> MemorySample {
        self.system.refresh_memory();

        let used = self.system.used_memory();
        let total = self.system.total_memory();

        MemorySample {
            timestamp: self.start_time.elapsed().as_secs_f64(),
            rss_bytes: used,
            virtual_bytes: total,
            allocations: self.cumulative_allocs,
            deallocations: self.cumulative_deallocs,
            leaked_bytes: 0,
        }
    }
}
