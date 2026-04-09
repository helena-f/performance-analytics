export interface CpuSample {
  timestamp: number;
  usage_percent: number;
  user_percent: number;
  system_percent: number;
  core_usages: number[];
}

export interface MemorySample {
  timestamp: number;
  rss_bytes: number;
  virtual_bytes: number;
  allocations: number;
  deallocations: number;
  leaked_bytes: number;
}

export interface StackFrame {
  function_name: string;
  module: string;
  file: string | null;
  line: number | null;
}

export interface StackSample {
  timestamp: number;
  thread_id: number;
  thread_name: string;
  frames: StackFrame[];
  weight: number;
}

export interface FlameNode {
  name: string;
  module: string;
  value: number;
  total: number;
  children: FlameNode[];
}

export interface SwiftUIIssue {
  timestamp: number;
  view_name: string;
  issue_type: string;
  description: string;
  severity: 'Critical' | 'Warning' | 'Info';
  suggested_fix: string;
  update_count: number;
  time_spent_ms: number;
}

export interface IoSample {
  timestamp: number;
  disk_read_bytes: number;
  disk_write_bytes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
}

export interface EnergySample {
  timestamp: number;
  cpu_energy: number;
  gpu_energy: number;
  total_impact: number;
  thermal_state: 'Nominal' | 'Fair' | 'Serious' | 'Critical';
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_bytes: number;
  thread_count: number;
  is_apple_process: boolean;
}

export type ProfileEvent =
  | { type: 'CpuUpdate'; data: CpuSample }
  | { type: 'MemoryUpdate'; data: MemorySample }
  | { type: 'IoUpdate'; data: IoSample }
  | { type: 'EnergyUpdate'; data: EnergySample }
  | { type: 'StackCapture'; data: StackSample }
  | { type: 'SwiftUIIssue'; data: SwiftUIIssue }
  | { type: 'SessionStarted'; data: { session_id: string; process_name: string; pid: number } }
  | { type: 'SessionStopped'; data: { session_id: string; duration: number } };

export type ActiveTab = 'timeline' | 'flamegraph' | 'swiftui';
