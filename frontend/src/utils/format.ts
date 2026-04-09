export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${secs}.${ms.toString().padStart(2, '0')}s`;
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function moduleColor(module: string): string {
  const colors: Record<string, string> = {
    'MyApp': '#0a84ff',
    'SwiftUI': '#30d158',
    'UIKit': '#ff9f0a',
    'CoreAnimation': '#bf5af2',
    'CoreGraphics': '#ff453a',
    'Foundation': '#64d2ff',
    'libdispatch': '#ffd60a',
  };
  return colors[module] || '#858585';
}
