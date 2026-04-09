import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { FlameNode } from '../../types';
import { moduleColor } from '../../utils/format';

interface FlameGraphProps {
  data: FlameNode | null;
  onRefresh: () => void;
}

const ROW_HEIGHT = 20;
const MIN_WIDTH_PX = 2;

export function FlameGraph({ data, onRefresh }: FlameGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [zoomNode, setZoomNode] = useState<FlameNode | null>(null);

  const renderGraph = useCallback((rootNode: FlameNode) => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Compute depth
    function maxDepth(node: FlameNode): number {
      if (node.children.length === 0) return 1;
      return 1 + Math.max(...node.children.map(maxDepth));
    }

    const depth = maxDepth(rootNode);
    const height = depth * ROW_HEIGHT + 40;
    svg.attr('width', width).attr('height', height);

    const xScale = d3.scaleLinear().domain([0, rootNode.total]).range([0, width]);

    // Flatten hierarchy for rendering
    type FlatRect = {
      node: FlameNode;
      x: number;
      y: number;
      w: number;
      depth: number;
    };

    const rects: FlatRect[] = [];

    function layoutNode(node: FlameNode, x: number, depth: number) {
      const w = xScale(node.total);
      if (w < MIN_WIDTH_PX) return;

      rects.push({ node, x, y: height - (depth + 1) * ROW_HEIGHT, w, depth });

      let childX = x;
      // Sort children by total descending for better visual layout
      const sortedChildren = [...node.children].sort((a, b) => b.total - a.total);
      for (const child of sortedChildren) {
        layoutNode(child, childX, depth + 1);
        childX += xScale(child.total);
      }
    }

    layoutNode(rootNode, 0, 0);

    const tooltip = d3.select(tooltipRef.current);

    // Render rectangles
    const g = svg.append('g');

    g.selectAll('rect')
      .data(rects)
      .join('rect')
      .attr('x', d => d.x + 0.5)
      .attr('y', d => d.y)
      .attr('width', d => Math.max(d.w - 1, 1))
      .attr('height', ROW_HEIGHT - 2)
      .attr('rx', 2)
      .attr('fill', d => {
        const mod = d.node.module || d.node.name.split('::')[0];
        return moduleColor(mod);
      })
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#1e1e1e')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).attr('fill-opacity', 1);
        const pct = ((d.node.total / rootNode.total) * 100).toFixed(1);
        tooltip
          .style('display', 'block')
          .html(`
            <div class="fn-name">${d.node.name}</div>
            <div class="module-name">${d.node.module}</div>
            <div style="margin-top: 4px">
              <span style="color: #ccc">Total:</span> ${d.node.total} samples (${pct}%)<br/>
              <span style="color: #ccc">Self:</span> ${d.node.value} samples
            </div>
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 10}px`);
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).attr('fill-opacity', 0.85);
        tooltip.style('display', 'none');
      })
      .on('click', (_, d) => {
        if (d.node.children.length > 0) {
          setZoomNode(d.node);
        }
      });

    // Render labels (only for wide enough rects)
    g.selectAll('text')
      .data(rects.filter(d => d.w > 40))
      .join('text')
      .attr('x', d => d.x + 4)
      .attr('y', d => d.y + ROW_HEIGHT / 2 + 3)
      .attr('font-size', 10)
      .attr('font-family', 'SF Mono, Menlo, monospace')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .text(d => {
        const name = d.node.name.includes('::')
          ? d.node.name.split('::').slice(1).join('::')
          : d.node.name;
        const maxChars = Math.floor(d.w / 7);
        return name.length > maxChars ? name.substring(0, maxChars - 1) + '…' : name;
      });

  }, []);

  useEffect(() => {
    const nodeToRender = zoomNode || data;
    if (nodeToRender) {
      renderGraph(nodeToRender);
    }
  }, [data, zoomNode, renderGraph]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const nodeToRender = zoomNode || data;
      if (nodeToRender) renderGraph(nodeToRender);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, zoomNode, renderGraph]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-instruments-textDim">
        <button
          onClick={onRefresh}
          className="px-4 py-2 rounded-lg bg-instruments-accent/20 text-instruments-accent hover:bg-instruments-accent/30 transition-colors text-sm font-medium"
        >
          Generate Flame Graph
        </button>
        <p className="text-xs mt-2">Captures stack samples and builds a flame graph visualization</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-instruments-border shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-instruments-text">Flame Graph</h3>
          {zoomNode && (
            <button
              onClick={() => setZoomNode(null)}
              className="text-xs text-instruments-accent hover:underline"
            >
              Reset Zoom
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-2 text-[10px]">
            {['MyApp', 'SwiftUI', 'UIKit', 'CoreAnimation', 'Foundation', 'libdispatch'].map(mod => (
              <div key={mod} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: moduleColor(mod) }} />
                <span className="text-instruments-textDim">{mod}</span>
              </div>
            ))}
          </div>
          <button
            onClick={onRefresh}
            className="text-xs text-instruments-textDim hover:text-instruments-text transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2">
        <svg ref={svgRef} className="w-full" />
      </div>

      {/* Tooltip */}
      <div ref={tooltipRef} className="flame-tooltip" style={{ display: 'none' }} />
    </div>
  );
}
