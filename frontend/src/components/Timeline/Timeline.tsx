import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { CpuSample, MemorySample, IoSample, EnergySample } from '../../types';
import { formatPercent, formatBytes, formatTimestamp } from '../../utils/format';

interface TimelineProps {
  cpuSamples: CpuSample[];
  memorySamples: MemorySample[];
  ioSamples: IoSample[];
  energySamples: EnergySample[];
  isRecording: boolean;
}

const TRACK_HEIGHT = 120;
const MARGIN = { top: 20, right: 20, bottom: 20, left: 60 };

export function Timeline({ cpuSamples, memorySamples, ioSamples, energySamples, isRecording }: TimelineProps) {
  return (
    <div className="h-full overflow-y-auto">
      {cpuSamples.length === 0 && !isRecording ? (
        <EmptyState />
      ) : (
        <div className="p-2 space-y-1">
          <Track
            title="CPU Usage"
            color="#0a84ff"
            secondaryColor="#30d158"
            samples={cpuSamples}
            getValue={(s) => s.usage_percent}
            getSecondary={(s) => s.system_percent}
            formatValue={formatPercent}
            maxValue={100}
            unit="%"
          />
          <Track
            title="Memory"
            color="#bf5af2"
            samples={memorySamples}
            getValue={(s) => s.rss_bytes}
            formatValue={formatBytes}
            unit="bytes"
          />
          <Track
            title="Disk I/O"
            color="#ff9f0a"
            secondaryColor="#64d2ff"
            samples={ioSamples}
            getValue={(s) => s.disk_read_bytes}
            getSecondary={(s) => s.disk_write_bytes}
            formatValue={formatBytes}
            unit="bytes/s"
          />
          <Track
            title="Energy Impact"
            color="#ff453a"
            secondaryColor="#ffd60a"
            samples={energySamples}
            getValue={(s) => s.total_impact * 100}
            getSecondary={(s) => s.cpu_energy * 100}
            formatValue={formatPercent}
            maxValue={100}
            unit="%"
          />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-instruments-textDim">
      <div className="w-16 h-16 rounded-2xl bg-instruments-surface border border-instruments-border flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <p className="text-sm font-medium text-instruments-text mb-1">No profiling data</p>
      <p className="text-xs">Click Record to start capturing performance data</p>
    </div>
  );
}

interface TrackProps<T> {
  title: string;
  color: string;
  secondaryColor?: string;
  samples: T[];
  getValue: (sample: T) => number;
  getSecondary?: (sample: T) => number;
  formatValue: (value: number) => string;
  maxValue?: number;
  unit: string;
}

function Track<T extends { timestamp: number }>({
  title, color, secondaryColor, samples, getValue, getSecondary, formatValue, maxValue, unit,
}: TrackProps<T>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || samples.length < 2) return;

    const width = containerRef.current.clientWidth;
    const height = TRACK_HEIGHT;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const values = samples.map(getValue);
    const yMax = maxValue ?? d3.max(values) ?? 1;

    const xScale = d3.scaleLinear()
      .domain([samples[0].timestamp, samples[samples.length - 1].timestamp])
      .range([MARGIN.left, width - MARGIN.right]);

    const yScale = d3.scaleLinear()
      .domain([0, yMax * 1.1])
      .range([height - MARGIN.bottom, MARGIN.top]);

    // Grid lines
    const yTicks = yScale.ticks(4);
    svg.append('g')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', MARGIN.left)
      .attr('x2', width - MARGIN.right)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#2a2d2e')
      .attr('stroke-dasharray', '2,3');

    // Y axis labels
    svg.append('g')
      .selectAll('text')
      .data(yTicks)
      .join('text')
      .attr('x', MARGIN.left - 6)
      .attr('y', d => yScale(d) + 3)
      .attr('text-anchor', 'end')
      .attr('font-size', 9)
      .attr('font-family', 'SF Mono, Menlo, monospace')
      .attr('fill', '#858585')
      .text(d => formatValue(d));

    // Area + line for primary
    const area = d3.area<T>()
      .x(d => xScale(d.timestamp))
      .y0(height - MARGIN.bottom)
      .y1(d => yScale(getValue(d)))
      .curve(d3.curveMonotoneX);

    const line = d3.line<T>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale(getValue(d)))
      .curve(d3.curveMonotoneX);

    // Gradient
    const gradientId = `grad-${title.replace(/\s/g, '')}`;
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.3);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.02);

    // Secondary area (if provided)
    if (getSecondary && secondaryColor) {
      const secArea = d3.area<T>()
        .x(d => xScale(d.timestamp))
        .y0(height - MARGIN.bottom)
        .y1(d => yScale(getSecondary(d)))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(samples)
        .attr('d', secArea)
        .attr('fill', secondaryColor)
        .attr('fill-opacity', 0.1);

      svg.append('path')
        .datum(samples)
        .attr('d', d3.line<T>()
          .x(d => xScale(d.timestamp))
          .y(d => yScale(getSecondary(d)))
          .curve(d3.curveMonotoneX))
        .attr('fill', 'none')
        .attr('stroke', secondaryColor)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.5);
    }

    svg.append('path')
      .datum(samples)
      .attr('d', area)
      .attr('fill', `url(#${gradientId})`);

    svg.append('path')
      .datum(samples)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5);

    // Latest value indicator
    const latest = samples[samples.length - 1];
    const latestVal = getValue(latest);
    svg.append('circle')
      .attr('cx', xScale(latest.timestamp))
      .attr('cy', yScale(latestVal))
      .attr('r', 3)
      .attr('fill', color);

    // Time axis
    const xTicks = xScale.ticks(6);
    svg.append('g')
      .selectAll('text')
      .data(xTicks)
      .join('text')
      .attr('x', d => xScale(d))
      .attr('y', height - 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-family', 'SF Mono, Menlo, monospace')
      .attr('fill', '#555')
      .text(d => formatTimestamp(d));

  }, [samples, getValue, getSecondary, formatValue, maxValue, color, secondaryColor, title]);

  const latestValue = samples.length > 0 ? getValue(samples[samples.length - 1]) : 0;

  return (
    <div className="bg-instruments-surface rounded-lg border border-instruments-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-instruments-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-medium text-instruments-text">{title}</span>
        </div>
        <span className="text-xs font-mono text-instruments-textDim">
          {samples.length > 0 ? formatValue(latestValue) : '—'}
        </span>
      </div>
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} className="w-full" style={{ height: TRACK_HEIGHT }} />
      </div>
    </div>
  );
}
