import type { ActiveTab, CpuSample, MemorySample } from '../../types';
import { formatDuration, formatPercent, formatBytes } from '../../utils/format';

interface ToolbarProps {
  isRecording: boolean;
  elapsed: number;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  cpuSamples: CpuSample[];
  memorySamples: MemorySample[];
}

export function Toolbar({
  isRecording, elapsed, activeTab, onTabChange,
  onStart, onStop, onClear, cpuSamples, memorySamples,
}: ToolbarProps) {
  const latestCpu = cpuSamples[cpuSamples.length - 1];
  const latestMem = memorySamples[memorySamples.length - 1];

  return (
    <div className="bg-instruments-surface border-b border-instruments-border shrink-0">
      {/* Top row: controls + stats */}
      <div className="flex items-center h-11 px-3 gap-3">
        {/* App title */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-instruments-accent to-instruments-purple flex items-center justify-center text-white text-xs font-bold">
            P
          </div>
          <span className="text-sm font-semibold text-instruments-text tracking-tight">PerfScope</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-instruments-border" />

        {/* Record controls */}
        <div className="flex items-center gap-1.5">
          {!isRecording ? (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-instruments-red/20 text-instruments-red hover:bg-instruments-red/30 transition-colors text-xs font-medium"
            >
              <span className="w-2 h-2 rounded-full bg-instruments-red" />
              Record
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-instruments-surface hover:bg-instruments-surfaceHover border border-instruments-border transition-colors text-xs font-medium text-instruments-text"
            >
              <span className="w-2 h-2 rounded-sm bg-instruments-text" />
              Stop
            </button>
          )}
          <button
            onClick={onClear}
            className="px-2 py-1 rounded-md hover:bg-instruments-surfaceHover transition-colors text-xs text-instruments-textDim"
          >
            Clear
          </button>
        </div>

        {/* Timer */}
        <div className="font-mono text-sm text-instruments-text tabular-nums min-w-[70px]">
          {formatDuration(elapsed)}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-instruments-border" />

        {/* Live stats */}
        {latestCpu && (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-instruments-textDim">CPU</span>
              <span className={`font-mono font-medium ${latestCpu.usage_percent > 80 ? 'text-instruments-red' : latestCpu.usage_percent > 50 ? 'text-instruments-orange' : 'text-instruments-green'}`}>
                {formatPercent(latestCpu.usage_percent)}
              </span>
            </div>
            {latestMem && (
              <div className="flex items-center gap-1.5">
                <span className="text-instruments-textDim">Mem</span>
                <span className="font-mono font-medium text-instruments-purple">
                  {formatBytes(latestMem.rss_bytes)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-1.5 text-xs text-instruments-red">
            <span className="w-2 h-2 rounded-full bg-instruments-red animate-pulse" />
            <span className="font-medium">REC</span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center h-8 px-3 gap-0.5">
        {([
          { id: 'timeline' as const, label: 'Timeline' },
          { id: 'flamegraph' as const, label: 'Flame Graph' },
          { id: 'swiftui' as const, label: 'SwiftUI' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-instruments-accent/20 text-instruments-accent'
                : 'text-instruments-textDim hover:text-instruments-text hover:bg-instruments-surfaceHover'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
