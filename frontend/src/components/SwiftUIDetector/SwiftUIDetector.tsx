import { useState } from 'react';
import type { SwiftUIIssue } from '../../types';

interface SwiftUIDetectorProps {
  issues: SwiftUIIssue[];
}

export function SwiftUIDetector({ issues }: SwiftUIDetectorProps) {
  const [selectedIssue, setSelectedIssue] = useState<SwiftUIIssue | null>(null);
  const [filter, setFilter] = useState<'all' | 'Critical' | 'Warning' | 'Info'>('all');

  const filtered = filter === 'all' ? issues : issues.filter(i => i.severity === filter);

  const criticalCount = issues.filter(i => i.severity === 'Critical').length;
  const warningCount = issues.filter(i => i.severity === 'Warning').length;
  const infoCount = issues.filter(i => i.severity === 'Info').length;

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-instruments-textDim">
        <div className="w-16 h-16 rounded-2xl bg-instruments-surface border border-instruments-border flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <p className="text-sm font-medium text-instruments-text mb-1">No SwiftUI issues detected</p>
        <p className="text-xs">Start recording to detect inefficient SwiftUI view updates</p>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Issue list */}
      <div className="w-[420px] border-r border-instruments-border flex flex-col shrink-0">
        {/* Summary bar */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-instruments-border bg-instruments-surface">
          <span className="text-xs font-medium text-instruments-text">Issues ({issues.length})</span>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-[10px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-1.5 py-0.5 rounded ${filter === 'all' ? 'bg-instruments-border text-instruments-text' : 'text-instruments-textDim'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('Critical')}
              className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${filter === 'Critical' ? 'bg-instruments-red/20 text-instruments-red' : 'text-instruments-textDim'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-instruments-red" />
              {criticalCount}
            </button>
            <button
              onClick={() => setFilter('Warning')}
              className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${filter === 'Warning' ? 'bg-instruments-orange/20 text-instruments-orange' : 'text-instruments-textDim'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-instruments-orange" />
              {warningCount}
            </button>
            <button
              onClick={() => setFilter('Info')}
              className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${filter === 'Info' ? 'bg-instruments-accent/20 text-instruments-accent' : 'text-instruments-textDim'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-instruments-accent" />
              {infoCount}
            </button>
          </div>
        </div>

        {/* Issue rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((issue, i) => (
            <button
              key={i}
              onClick={() => setSelectedIssue(issue)}
              className={`w-full text-left px-3 py-2.5 border-b border-instruments-border hover:bg-instruments-surfaceHover transition-colors ${
                selectedIssue === issue ? 'bg-instruments-accent/10 border-l-2 border-l-instruments-accent' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <SeverityBadge severity={issue.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-instruments-text truncate">
                      {issue.view_name}
                    </span>
                    <IssueTypeBadge type={issue.issue_type} />
                  </div>
                  <p className="text-[11px] text-instruments-textDim mt-0.5 line-clamp-2">
                    {issue.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-instruments-textDim">
                    <span>{issue.time_spent_ms.toFixed(1)}ms</span>
                    <span>{issue.update_count} updates</span>
                    <span>{issue.timestamp.toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {selectedIssue ? (
          <IssueDetail issue={selectedIssue} />
        ) : (
          <div className="flex items-center justify-center h-full text-instruments-textDim text-xs">
            Select an issue to see details
          </div>
        )}
      </div>
    </div>
  );
}

function IssueDetail({ issue }: { issue: SwiftUIIssue }) {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SeverityBadge severity={issue.severity} />
          <h2 className="text-sm font-semibold text-instruments-text">{issue.view_name}</h2>
          <IssueTypeBadge type={issue.issue_type} />
        </div>
        <p className="text-xs text-instruments-text leading-relaxed">{issue.description}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Time Spent" value={`${issue.time_spent_ms.toFixed(1)}ms`} color="text-instruments-orange" />
        <StatCard label="Updates" value={`${issue.update_count}`} color="text-instruments-accent" />
        <StatCard label="Detected At" value={`${issue.timestamp.toFixed(1)}s`} color="text-instruments-textDim" />
      </div>

      {/* Suggested Fix */}
      <div className="bg-instruments-bg rounded-lg border border-instruments-border p-3">
        <h3 className="text-xs font-medium text-instruments-green mb-2 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Suggested Fix
        </h3>
        <p className="text-xs text-instruments-text leading-relaxed font-mono">{issue.suggested_fix}</p>
      </div>

      {/* Code example */}
      <div className="bg-instruments-bg rounded-lg border border-instruments-border overflow-hidden">
        <div className="px-3 py-1.5 border-b border-instruments-border bg-instruments-surface">
          <span className="text-[10px] text-instruments-textDim">Example Fix Pattern</span>
        </div>
        <pre className="p-3 text-xs font-mono text-instruments-text overflow-x-auto leading-relaxed">
          {getExampleFix(issue.issue_type, issue.view_name)}
        </pre>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-instruments-bg rounded-lg border border-instruments-border p-2.5">
      <div className="text-[10px] text-instruments-textDim mb-1">{label}</div>
      <div className={`text-sm font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    Critical: 'bg-instruments-red/20 text-instruments-red',
    Warning: 'bg-instruments-orange/20 text-instruments-orange',
    Info: 'bg-instruments-accent/20 text-instruments-accent',
  };
  return (
    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[severity as keyof typeof colors] || colors.Info}`}>
      {severity}
    </span>
  );
}

function IssueTypeBadge({ type }: { type: string }) {
  const label = type.replace(/([A-Z])/g, ' $1').trim();
  return (
    <span className="px-1.5 py-0.5 rounded bg-instruments-border text-[10px] text-instruments-textDim">
      {label}
    </span>
  );
}

function getExampleFix(issueType: string, viewName: string): string {
  switch (issueType) {
    case 'ExcessiveBodyRecomputation':
      return `// Before: ${viewName} recomputes on every parent change
struct ${viewName}: View {
    @ObservedObject var viewModel: ViewModel
    var body: some View { ... }
}

// After: Use @StateObject + extract subviews
struct ${viewName}: View {
    @StateObject private var viewModel = ViewModel()
    var body: some View {
        ${viewName}Content(data: viewModel.displayData)
    }
}

struct ${viewName}Content: View, Equatable {
    let data: DisplayData
    var body: some View { ... }
}`;

    case 'UnnecessaryStateChange':
      return `// Before: Sets state even when unchanged
self.isLoading = false  // triggers body even if already false

// After: Guard against redundant updates
if self.isLoading != false {
    self.isLoading = false
}`;

    case 'HeavyViewInit':
      return `// Before: Heavy work in init
struct ${viewName}: View {
    let processedData: [Item]  // computed in init

    init(rawData: [RawItem]) {
        self.processedData = Self.process(rawData) // expensive!
    }
}

// After: Defer to .task
struct ${viewName}: View {
    @State private var processedData: [Item] = []

    var body: some View {
        List(processedData) { ... }
            .task { processedData = await process(rawData) }
    }
}`;

    case 'MainThreadBlocking':
      return `// Before: Blocking the main thread
var body: some View {
    let data = try! Data(contentsOf: fileURL)  // blocks!
    return Image(data: data)
}

// After: Use async loading
struct ${viewName}: View {
    @State private var imageData: Data?

    var body: some View {
        Group {
            if let data = imageData { Image(data: data) }
            else { ProgressView() }
        }
        .task { imageData = try? await loadData() }
    }
}`;

    default:
      return `// Optimize ${viewName} by reducing unnecessary updates
// Use @StateObject for owned state
// Use .equatable() for value-based diffing
// Extract subviews for granular updates`;
  }
}
