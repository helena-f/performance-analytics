import { useState, useEffect } from 'react';
import { useProfiler } from './hooks/useProfiler';
import { useDemoProfiler } from './hooks/useDemoProfiler';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Timeline } from './components/Timeline/Timeline';
import { FlameGraph } from './components/FlameGraph/FlameGraph';
import { SwiftUIDetector } from './components/SwiftUIDetector/SwiftUIDetector';
import type { ActiveTab } from './types';

export default function App() {
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const liveProfiler = useProfiler();
  const demoProfiler = useDemoProfiler();

  // Check if the Rust backend is running on startup (retry for Fly cold starts)
  useEffect(() => {
    const apiBase = import.meta.env.DEV ? '' : 'https://perfscope-api.fly.dev';
    let attempts = 0;
    const maxAttempts = 3;
    const tryConnect = () => {
      fetch(`${apiBase}/api/health`)
        .then(res => {
          if (res.ok) {
            setBackendAvailable(true);
          } else if (++attempts < maxAttempts) {
            setTimeout(tryConnect, 2000);
          } else {
            setBackendAvailable(false);
          }
        })
        .catch(() => {
          if (++attempts < maxAttempts) {
            setTimeout(tryConnect, 2000);
          } else {
            setBackendAvailable(false);
          }
        });
    };
    tryConnect();
  }, []);

  const profiler = backendAvailable ? liveProfiler : demoProfiler;
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');

  // Auto-fetch flame graph when switching to that tab
  useEffect(() => {
    if (activeTab === 'flamegraph' && !profiler.flameGraph) {
      profiler.fetchFlameGraph();
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-screen bg-instruments-bg">
      {/* Top toolbar */}
      <Toolbar
        isRecording={profiler.isRecording}
        elapsed={profiler.elapsed}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onStart={profiler.startRecording}
        onStop={profiler.stopRecording}
        onClear={profiler.clearSession}
        cpuSamples={profiler.cpuSamples}
        memorySamples={profiler.memorySamples}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'timeline' && (
          <Timeline
            cpuSamples={profiler.cpuSamples}
            memorySamples={profiler.memorySamples}
            ioSamples={profiler.ioSamples}
            energySamples={profiler.energySamples}
            isRecording={profiler.isRecording}
          />
        )}
        {activeTab === 'flamegraph' && (
          <FlameGraph
            data={profiler.flameGraph}
            onRefresh={profiler.fetchFlameGraph}
          />
        )}
        {activeTab === 'swiftui' && (
          <SwiftUIDetector issues={profiler.swiftUIIssues} />
        )}
      </div>

      {/* Status bar */}
      <div className="h-6 bg-instruments-surface border-t border-instruments-border flex items-center px-3 text-[11px] text-instruments-textDim font-mono shrink-0">
        <span>PerfScope v0.1.0</span>
        <span className="mx-2">|</span>
        {backendAvailable === null ? (
          <span className="text-instruments-textDim">Connecting...</span>
        ) : backendAvailable ? (
          <span className="text-instruments-green">Live (backend)</span>
        ) : (
          <span className="text-instruments-orange">Demo (simulated)</span>
        )}
        <span className="mx-2">|</span>
        <span>
          {profiler.isRecording ? (
            <span className="text-instruments-green">● Recording</span>
          ) : (
            <span>Ready</span>
          )}
        </span>
        <span className="mx-2">|</span>
        <span>Samples: {profiler.cpuSamples.length}</span>
        <span className="mx-2">|</span>
        <span>Stack traces: {profiler.stackSamples.length}</span>
        {profiler.swiftUIIssues.length > 0 && (
          <>
            <span className="mx-2">|</span>
            <span className="text-instruments-orange">
              {profiler.swiftUIIssues.filter(i => i.severity === 'Critical').length} critical issues
            </span>
          </>
        )}
      </div>
    </div>
  );
}
