import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  CpuSample, MemorySample, IoSample, EnergySample,
  StackSample, SwiftUIIssue, FlameNode,
} from '../types';

const MAX_SAMPLES = 600;

// Simulated profiling data for demo mode (no backend required)

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function generateCpuSample(t: number, baseLoad: number): CpuSample {
  // Simulate realistic CPU patterns with spikes
  const spike = Math.random() < 0.08 ? randomBetween(30, 60) : 0;
  const noise = randomBetween(-5, 5);
  const usage = Math.max(0, Math.min(100, baseLoad + spike + noise + Math.sin(t * 0.3) * 10));
  const cores = Array.from({ length: 8 }, () =>
    Math.max(0, Math.min(100, usage + randomBetween(-20, 20)))
  );
  return {
    timestamp: t,
    usage_percent: usage,
    user_percent: usage * 0.7,
    system_percent: usage * 0.3,
    core_usages: cores,
  };
}

function generateMemorySample(t: number, baseMemMB: number): MemorySample {
  // Simulate gradual memory growth with occasional GC drops
  const growth = t * 0.5; // MB over time
  const gc = Math.random() < 0.05 ? -randomBetween(5, 20) : 0;
  const mem = (baseMemMB + growth + gc) * 1024 * 1024;
  return {
    timestamp: t,
    rss_bytes: Math.max(0, mem),
    virtual_bytes: mem * 2.5,
    allocations: Math.floor(t * 150),
    deallocations: Math.floor(t * 130),
    leaked_bytes: Math.max(0, Math.floor(t * 20) * 1024),
  };
}

function generateIoSample(t: number): IoSample {
  const readBurst = Math.random() < 0.3 ? randomBetween(50000, 500000) : randomBetween(0, 10000);
  const writeBurst = Math.random() < 0.2 ? randomBetween(20000, 200000) : randomBetween(0, 5000);
  return {
    timestamp: t,
    disk_read_bytes: readBurst,
    disk_write_bytes: writeBurst,
    network_rx_bytes: randomBetween(1000, 100000),
    network_tx_bytes: randomBetween(500, 50000),
  };
}

function generateEnergySample(t: number, cpuUsage: number): EnergySample {
  const cpuEnergy = Math.min(1, cpuUsage / 100);
  const gpuEnergy = randomBetween(0, 0.3);
  const total = cpuEnergy * 0.7 + gpuEnergy * 0.3;
  return {
    timestamp: t,
    cpu_energy: cpuEnergy,
    gpu_energy: gpuEnergy,
    total_impact: total,
    thermal_state: total > 0.8 ? 'Serious' : total > 0.5 ? 'Fair' : 'Nominal',
  };
}

const SWIFT_MODULES = ['SwiftUI', 'UIKit', 'CoreAnimation', 'CoreGraphics', 'Foundation', 'libdispatch', 'MyApp'];
const FUNCTIONS: Record<string, string[]> = {
  SwiftUI: ['View.body.getter', 'ViewGraph.updateOutputs(at:)', 'AttributeGraph.updateValue()', 'DisplayList.build()', 'LayoutComputer.sizeThatFits(_:)'],
  UIKit: ['UIView.layoutSubviews()', 'UIView.draw(_:)', 'CALayer.display()', 'UIApplication.sendEvent(_:)'],
  CoreAnimation: ['CA::Transaction::commit()', 'CA::Layer::layout_and_display_if_needed()', 'CA::Context::commit_transaction()'],
  CoreGraphics: ['CGContextDrawImage', 'CGBitmapContextCreateImage', 'CGPathCreateMutable'],
  Foundation: ['NSRunLoop.run(mode:before:)', 'JSONDecoder.decode(_:from:)', 'URLSession.dataTask(with:completionHandler:)'],
  libdispatch: ['dispatch_async', 'dispatch_sync', 'dispatch_queue_invoke', 'dispatch_worker_thread2'],
  MyApp: ['ContentView.body.getter', 'ProfileView.body.getter', 'DashboardView.body.getter', 'DataManager.fetchItems()', 'NetworkService.request(_:)', 'ImageCache.loadImage(url:)'],
};

function generateStackSample(t: number): StackSample {
  const depth = Math.floor(randomBetween(4, 15));
  const frames = [];
  for (let i = 0; i < depth; i++) {
    const mod = SWIFT_MODULES[Math.floor(Math.random() * SWIFT_MODULES.length)];
    const fns = FUNCTIONS[mod];
    frames.push({
      function_name: fns[Math.floor(Math.random() * fns.length)],
      module: mod,
      file: mod === 'MyApp' ? `${mod}.swift` : null,
      line: mod === 'MyApp' ? Math.floor(randomBetween(10, 500)) : null,
    });
  }
  const threadNames = ['main', 'com.apple.main-thread', 'dispatch-worker-0', 'com.apple.CoreAnimation.render-server'];
  return {
    timestamp: t,
    thread_id: Math.floor(randomBetween(1, 8)),
    thread_name: threadNames[Math.floor(Math.random() * threadNames.length)],
    frames,
    weight: Math.floor(randomBetween(1, 5)),
  };
}

const VIEW_NAMES = ['ContentView', 'ProfileView', 'DashboardView', 'SettingsView', 'FeedView', 'DetailView', 'SearchResultsView', 'ChatView', 'ImageGalleryView'];
const ISSUE_TYPES: Array<{ type: string; gen: (view: string) => Partial<SwiftUIIssue> }> = [
  {
    type: 'ExcessiveBodyRecomputation',
    gen: (v) => ({
      issue_type: 'ExcessiveBodyRecomputation',
      description: `${v}.body was recomputed ${Math.floor(randomBetween(8, 30))} times in 1s — likely caused by a parent state change propagating unnecessarily.`,
      severity: 'Critical' as const,
      suggested_fix: `Break ${v} into smaller subviews. Move @State to the lowest common ancestor. Use @ObservedObject only for properties the view reads.`,
    }),
  },
  {
    type: 'UnnecessaryStateChange',
    gen: (v) => ({
      issue_type: 'UnnecessaryStateChange',
      description: `@State property in ${v} was set to its current value, triggering a redundant body evaluation.`,
      severity: 'Warning' as const,
      suggested_fix: 'Guard state mutations: `if newValue != currentValue { self.value = newValue }`. Consider using Equatable conformance.',
    }),
  },
  {
    type: 'HeavyViewInit',
    gen: (v) => ({
      issue_type: 'HeavyViewInit',
      description: `${v}.init() took ${randomBetween(5, 50).toFixed(1)}ms — initializers should be lightweight as SwiftUI may call them frequently.`,
      severity: 'Warning' as const,
      suggested_fix: 'Move expensive setup to .onAppear or .task. Use lazy initialization for heavy resources.',
    }),
  },
  {
    type: 'MainThreadBlocking',
    gen: (v) => ({
      issue_type: 'MainThreadBlocking',
      description: `${v} performed a ${randomBetween(16, 200).toFixed(0)}ms synchronous operation on the main thread during body evaluation.`,
      severity: 'Critical' as const,
      suggested_fix: 'Move heavy computation to a background thread using .task { } or Task.detached { }. Use @State to store async results.',
    }),
  },
  {
    type: 'LargeViewHierarchy',
    gen: (v) => ({
      issue_type: 'LargeViewHierarchy',
      description: `${v} produced a view hierarchy with ${Math.floor(randomBetween(200, 1000))} nodes — deep hierarchies slow down diffing.`,
      severity: 'Info' as const,
      suggested_fix: 'Flatten the view hierarchy. Use Group instead of nested VStacks. Consider LazyVStack for long lists.',
    }),
  },
];

function generateSwiftUIIssue(t: number): SwiftUIIssue | null {
  if (Math.random() > 0.12) return null;
  const view = VIEW_NAMES[Math.floor(Math.random() * VIEW_NAMES.length)];
  const issueGen = ISSUE_TYPES[Math.floor(Math.random() * ISSUE_TYPES.length)];
  const partial = issueGen.gen(view);
  return {
    timestamp: t,
    view_name: view,
    issue_type: partial.issue_type!,
    description: partial.description!,
    severity: partial.severity as 'Critical' | 'Warning' | 'Info',
    suggested_fix: partial.suggested_fix!,
    update_count: Math.floor(randomBetween(1, 30)),
    time_spent_ms: randomBetween(0.5, 50),
  };
}

function buildFlameGraph(samples: StackSample[]): FlameNode {
  const root: FlameNode = { name: 'root', module: '', value: 0, total: 0, children: [] };

  for (const sample of samples) {
    const frames = [...sample.frames].reverse();
    let current = root;
    for (const frame of frames) {
      const name = `${frame.module}::${frame.function_name}`;
      let child = current.children.find(c => c.name === name);
      if (!child) {
        child = { name, module: frame.module, value: 0, total: 0, children: [] };
        current.children.push(child);
      }
      current = child;
    }
    current.value += sample.weight;
  }

  function computeTotals(node: FlameNode): number {
    let total = node.value;
    for (const child of node.children) {
      total += computeTotals(child);
    }
    node.total = total;
    return total;
  }
  computeTotals(root);
  return root;
}

export interface DemoProfilerState {
  isRecording: boolean;
  cpuSamples: CpuSample[];
  memorySamples: MemorySample[];
  ioSamples: IoSample[];
  energySamples: EnergySample[];
  stackSamples: StackSample[];
  swiftUIIssues: SwiftUIIssue[];
  flameGraph: FlameNode | null;
  elapsed: number;
  sessionId: string | null;
}

export function useDemoProfiler() {
  const [state, setState] = useState<DemoProfilerState>({
    isRecording: false,
    cpuSamples: [],
    memorySamples: [],
    ioSamples: [],
    energySamples: [],
    stackSamples: [],
    swiftUIIssues: [],
    flameGraph: null,
    elapsed: 0,
    sessionId: null,
  });

  const intervalRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const baseLoadRef = useRef(randomBetween(15, 35));
  const baseMemRef = useRef(randomBetween(80, 200));
  const allStacksRef = useRef<StackSample[]>([]);

  const startRecording = useCallback(() => {
    timeRef.current = 0;
    allStacksRef.current = [];
    baseLoadRef.current = randomBetween(15, 35);
    baseMemRef.current = randomBetween(80, 200);

    setState(prev => ({
      ...prev,
      isRecording: true,
      sessionId: crypto.randomUUID(),
      cpuSamples: [],
      memorySamples: [],
      ioSamples: [],
      energySamples: [],
      stackSamples: [],
      swiftUIIssues: [],
      flameGraph: null,
      elapsed: 0,
    }));

    intervalRef.current = window.setInterval(() => {
      timeRef.current += 0.25;
      const t = timeRef.current;

      const cpu = generateCpuSample(t, baseLoadRef.current);
      const mem = generateMemorySample(t, baseMemRef.current);
      const io = generateIoSample(t);
      const energy = generateEnergySample(t, cpu.usage_percent);
      const stack = generateStackSample(t);
      const issue = generateSwiftUIIssue(t);
      allStacksRef.current.push(stack);

      setState(prev => ({
        ...prev,
        elapsed: t,
        cpuSamples: [...prev.cpuSamples.slice(-MAX_SAMPLES), cpu],
        memorySamples: [...prev.memorySamples.slice(-MAX_SAMPLES), mem],
        ioSamples: [...prev.ioSamples.slice(-MAX_SAMPLES), io],
        energySamples: [...prev.energySamples.slice(-MAX_SAMPLES), energy],
        stackSamples: [...prev.stackSamples.slice(-MAX_SAMPLES), stack],
        swiftUIIssues: issue ? [...prev.swiftUIIssues, issue] : prev.swiftUIIssues,
      }));
    }, 250);
  }, []);

  const stopRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState(prev => ({ ...prev, isRecording: false }));
  }, []);

  const clearSession = useCallback(() => {
    stopRecording();
    allStacksRef.current = [];
    setState({
      isRecording: false,
      cpuSamples: [],
      memorySamples: [],
      ioSamples: [],
      energySamples: [],
      stackSamples: [],
      swiftUIIssues: [],
      flameGraph: null,
      elapsed: 0,
      sessionId: null,
    });
  }, [stopRecording]);

  const fetchFlameGraph = useCallback(async () => {
    // Generate some stacks if we don't have any
    let stacks = allStacksRef.current;
    if (stacks.length < 50) {
      stacks = Array.from({ length: 200 }, (_, i) => generateStackSample(i * 0.1));
      allStacksRef.current = stacks;
    }
    const flame = buildFlameGraph(stacks);
    setState(prev => ({ ...prev, flameGraph: flame }));
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    clearSession,
    fetchFlameGraph,
  };
}
