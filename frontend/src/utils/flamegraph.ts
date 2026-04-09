import type { StackSample, FlameNode } from '../types';

export function buildFlameGraph(samples: StackSample[]): FlameNode {
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
