use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A single CPU usage sample at a point in time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuSample {
    pub timestamp: f64, // seconds since profiling start
    pub usage_percent: f64,
    pub user_percent: f64,
    pub system_percent: f64,
    pub core_usages: Vec<f64>,
}

/// A single memory usage sample
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySample {
    pub timestamp: f64,
    pub rss_bytes: u64,         // resident set size
    pub virtual_bytes: u64,     // virtual memory
    pub allocations: u64,       // cumulative allocation count
    pub deallocations: u64,     // cumulative deallocation count
    pub leaked_bytes: u64,      // estimated leaked memory
}

/// A stack frame in a call stack
#[derive(Debug, Clone, Serialize, Deserialize, Eq, PartialEq, Hash)]
pub struct StackFrame {
    pub function_name: String,
    pub module: String,
    pub file: Option<String>,
    pub line: Option<u32>,
}

/// A captured call stack sample
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackSample {
    pub timestamp: f64,
    pub thread_id: u64,
    pub thread_name: String,
    pub frames: Vec<StackFrame>,
    pub weight: u64, // number of times this stack was seen
}

/// A node in the flame graph tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlameNode {
    pub name: String,
    pub module: String,
    pub value: u64,        // self time (samples)
    pub total: u64,        // total time including children
    pub children: Vec<FlameNode>,
}

/// Detected SwiftUI inefficiency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwiftUIIssue {
    pub timestamp: f64,
    pub view_name: String,
    pub issue_type: SwiftUIIssueType,
    pub description: String,
    pub severity: Severity,
    pub suggested_fix: String,
    pub update_count: u32,
    pub time_spent_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SwiftUIIssueType {
    ExcessiveBodyRecomputation,
    UnnecessaryStateChange,
    HeavyViewInit,
    UnbatchedUpdates,
    MainThreadBlocking,
    LargeViewHierarchy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    Warning,
    Info,
}

/// I/O activity sample
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IoSample {
    pub timestamp: f64,
    pub disk_read_bytes: u64,
    pub disk_write_bytes: u64,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
}

/// Energy impact sample
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnergySample {
    pub timestamp: f64,
    pub cpu_energy: f64,   // 0.0 - 1.0 normalized
    pub gpu_energy: f64,
    pub total_impact: f64, // 0.0 - 1.0 normalized
    pub thermal_state: ThermalState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThermalState {
    Nominal,
    Fair,
    Serious,
    Critical,
}

/// Represents a process that can be profiled
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f64,
    pub memory_bytes: u64,
    pub thread_count: u32,
    pub is_apple_process: bool,
}

/// A complete profiling session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilingSession {
    pub id: String,
    pub process_name: String,
    pub pid: u32,
    pub start_time: DateTime<Utc>,
    pub duration_seconds: f64,
    pub cpu_samples: Vec<CpuSample>,
    pub memory_samples: Vec<MemorySample>,
    pub stack_samples: Vec<StackSample>,
    pub io_samples: Vec<IoSample>,
    pub energy_samples: Vec<EnergySample>,
    pub flame_graph: Option<FlameNode>,
    pub swiftui_issues: Vec<SwiftUIIssue>,
}

/// Message types for WebSocket streaming
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ProfileEvent {
    CpuUpdate(CpuSample),
    MemoryUpdate(MemorySample),
    IoUpdate(IoSample),
    EnergyUpdate(EnergySample),
    StackCapture(StackSample),
    SwiftUIIssue(SwiftUIIssue),
    SessionStarted { session_id: String, process_name: String, pid: u32 },
    SessionStopped { session_id: String, duration: f64 },
}
