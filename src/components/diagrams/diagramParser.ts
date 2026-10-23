export interface DiagramNode {
  id: string;
  label: string;
  shape: 'rect' | 'circle' | 'database' | 'diamond';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramLink {
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed' | 'thick';
}

export interface ParsedDiagram {
  type: 'flowchart' | 'sequence' | 'statediagram' | 'generic';
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  title?: string;
  nodes: DiagramNode[];
  links: DiagramLink[];
  width: number;
  height: number;
}

/**
 * Parses Mermaid flowchart, graph, or sequence source code into nodes and links
 */
export function parseMermaid(source: string): ParsedDiagram {
  const lines = source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'));

  let direction: 'TB' | 'BT' | 'LR' | 'RL' = 'TB';
  let type: 'flowchart' | 'sequence' | 'statediagram' | 'generic' = 'flowchart';
  const nodeMap = new Map<string, DiagramNode>();
  const links: DiagramLink[] = [];

  // 1. Detect diagram type & direction
  const firstLine = lines[0] || '';
  if (/^sequenceDiagram/i.test(firstLine)) {
    type = 'sequence';
  } else if (/^stateDiagram/i.test(firstLine)) {
    type = 'statediagram';
  } else if (/^(graph|flowchart)\s+(TD|TB|LR|RL|BT)/i.test(firstLine)) {
    type = 'flowchart';
    const match = firstLine.match(/^(graph|flowchart)\s+(TD|TB|LR|RL|BT)/i);
    if (match) {
      direction = match[2].toUpperCase() as any;
      if (direction === ('TD' as any)) direction = 'TB';
    }
  }

  // 2. Parse nodes and relations
  const ensureNode = (id: string, rawLabel?: string, shape: DiagramNode['shape'] = 'rect') => {
    const cleanId = id.trim().replace(/[^\w-]/g, '_');
    if (!nodeMap.has(cleanId)) {
      let label = rawLabel ? rawLabel.trim() : cleanId;
      // Clean quotes and bracket wrappers
      label = label.replace(/^["'[]+|["'\]]+$/g, '');
      nodeMap.set(cleanId, {
        id: cleanId,
        label: label || cleanId,
        shape,
        x: 0,
        y: 0,
        width: Math.max(120, Math.min(220, (label.length * 8) + 36)),
        height: 52,
      });
    } else if (rawLabel && nodeMap.get(cleanId)!.label === cleanId) {
      let label = rawLabel.trim().replace(/^["'[]+|["'\]]+$/g, '');
      nodeMap.get(cleanId)!.label = label;
    }
    return cleanId;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && (line.startsWith('graph') || line.startsWith('flowchart') || line.startsWith('sequenceDiagram'))) {
      continue;
    }

    // Sequence diagram syntax: ParticipantA ->> ParticipantB: Message
    if (type === 'sequence') {
      const seqMatch = line.match(/^(\w+)\s*(-->>|->>|->|-->)\s*(\w+)\s*:\s*(.+)$/);
      if (seqMatch) {
        const from = ensureNode(seqMatch[1], seqMatch[1], 'rect');
        const to = ensureNode(seqMatch[3], seqMatch[3], 'rect');
        links.push({
          from,
          to,
          label: seqMatch[4].trim(),
          style: seqMatch[2].includes('--') ? 'dashed' : 'solid',
        });
        continue;
      }
    }

    // Flowchart edge regex: A["Label A"] -->|edge label| B["Label B"]
    // Matches: A --> B, A -->|text| B, A -.-> B, A ==> B
    const edgeRegex = /([a-zA-Z0-9_-]+)(?:\["([^"]+)"\]|\[([^\]]+)\]|\(\(([^)]+)\)\)|\[\(([^)]+)\)\])?\s*(-->|-.->|==>|--\s*\|([^|]+)\|\s*-->|-->\|([^|]+)\|)\s*([a-zA-Z0-9_-]+)(?:\["([^"]+)"\]|\[([^\]]+)\]|\(\(([^)]+)\)\)|\[\(([^)]+)\)\])?/;
    const edgeMatch = line.match(edgeRegex);

    if (edgeMatch) {
      const fromId = edgeMatch[1];
      const fromLabel = edgeMatch[2] || edgeMatch[3] || edgeMatch[4] || edgeMatch[5];
      const fromShape = edgeMatch[4] ? 'circle' : edgeMatch[5] ? 'database' : 'rect';

      const edgeSymbol = edgeMatch[6];
      const edgeLabel = edgeMatch[7] || edgeMatch[8];

      const toId = edgeMatch[9];
      const toLabel = edgeMatch[10] || edgeMatch[11] || edgeMatch[12] || edgeMatch[13];
      const toShape = edgeMatch[12] ? 'circle' : edgeMatch[13] ? 'database' : 'rect';

      const cleanFrom = ensureNode(fromId, fromLabel, fromShape);
      const cleanTo = ensureNode(toId, toLabel, toShape);

      const style = edgeSymbol.includes('-.')
        ? 'dashed'
        : edgeSymbol.includes('==')
        ? 'thick'
        : 'solid';

      links.push({
        from: cleanFrom,
        to: cleanTo,
        label: edgeLabel ? edgeLabel.trim() : undefined,
        style,
      });
      continue;
    }

    // Standalone node definition: NodeId["Node Label"]
    const nodeOnlyRegex = /^([a-zA-Z0-9_-]+)(?:\["([^"]+)"\]|\[([^\]]+)\]|\(\(([^)]+)\)\)|\[\(([^)]+)\)\])$/;
    const nodeMatch = line.match(nodeOnlyRegex);
    if (nodeMatch) {
      const id = nodeMatch[1];
      const label = nodeMatch[2] || nodeMatch[3] || nodeMatch[4] || nodeMatch[5];
      const shape = nodeMatch[4] ? 'circle' : nodeMatch[5] ? 'database' : 'rect';
      ensureNode(id, label, shape);
    }
  }

  // Fallback: If empty, seed default nodes from words
  if (nodeMap.size === 0) {
    ensureNode('Start', 'System Start', 'circle');
    ensureNode('Processing', 'Inference Engine', 'rect');
    ensureNode('End', 'Verified Output', 'circle');
    links.push({ from: 'Start', to: 'Processing', style: 'solid' });
    links.push({ from: 'Processing', to: 'End', style: 'solid' });
  }

  const nodes = Array.from(nodeMap.values());

  // 3. Simple Directed Graph Layout Computation
  const isHorizontal = direction === 'LR' || direction === 'RL';
  const spacingX = isHorizontal ? 220 : 180;
  const spacingY = isHorizontal ? 120 : 110;

  // Assign ranks/layers using simple topological order
  const inDegree = new Map<string, number>();
  nodes.forEach((n) => inDegree.set(n.id, 0));
  links.forEach((l) => inDegree.set(l.to, (inDegree.get(l.to) || 0) + 1));

  const layers: DiagramNode[][] = [];
  const assigned = new Set<string>();

  // Layer 0: nodes with no incoming edges
  let currentLayer = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0);
  if (currentLayer.length === 0 && nodes.length > 0) currentLayer = [nodes[0]];

  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    currentLayer.forEach((n) => assigned.add(n.id));

    const nextLayer: DiagramNode[] = [];
    currentLayer.forEach((n) => {
      const targets = links
        .filter((l) => l.from === n.id && !assigned.has(l.to))
        .map((l) => nodeMap.get(l.to)!)
        .filter(Boolean);
      targets.forEach((t) => {
        if (!nextLayer.some((item) => item.id === t.id)) {
          nextLayer.push(t);
        }
      });
    });

    currentLayer = nextLayer;
    if (layers.length > 10) break; // cycle defense
  }

  // Any unassigned nodes placed in final layer
  const unassigned = nodes.filter((n) => !assigned.has(n.id));
  if (unassigned.length > 0) layers.push(unassigned);

  // Layout coordinates calculation
  let maxX = 0;
  let maxY = 0;

  layers.forEach((layer, layerIdx) => {
    const layerBreadth = layer.length;
    layer.forEach((node, nodeIdx) => {
      if (isHorizontal) {
        node.x = 60 + layerIdx * spacingX;
        node.y = 60 + (nodeIdx - (layerBreadth - 1) / 2) * spacingY + 140;
      } else {
        node.x = 60 + (nodeIdx - (layerBreadth - 1) / 2) * spacingX + 220;
        node.y = 60 + layerIdx * spacingY;
      }
      maxX = Math.max(maxX, node.x + node.width + 60);
      maxY = Math.max(maxY, node.y + node.height + 60);
    });
  });

  return {
    type,
    direction,
    nodes,
    links,
    width: Math.max(700, maxX),
    height: Math.max(450, maxY),
  };
}

/**
 * Generates high-resolution, standards-compliant SVG markup
 */
export function renderDiagramToSvg(diagram: ParsedDiagram): string {
  const nodeMap = new Map<string, DiagramNode>(diagram.nodes.map((n) => [n.id, n]));

  const linksSvg = diagram.links
    .map((link) => {
      const from = nodeMap.get(link.from);
      const to = nodeMap.get(link.to);
      if (!from || !to) return '';

      const x1 = from.x + from.width / 2;
      const y1 = from.y + from.height / 2;
      const x2 = to.x + to.width / 2;
      const y2 = to.y + to.height / 2;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      const strokeDash = link.style === 'dashed' ? 'stroke-dasharray="5,5"' : '';
      const strokeWidth = link.style === 'thick' ? '3' : '2';

      return `
        <g class="diagram-link">
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#EA580C" stroke-width="${strokeWidth}" ${strokeDash} marker-end="url(#arrowhead)" />
          ${
            link.label
              ? `<rect x="${midX - 35}" y="${midY - 10}" width="70" height="18" rx="4" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1" />
                 <text x="${midX}" y="${midY + 3}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#475569" text-anchor="middle">${escapeXml(link.label)}</text>`
              : ''
          }
        </g>
      `;
    })
    .join('\n');

  const nodesSvg = diagram.nodes
    .map((node) => {
      const rx = node.shape === 'circle' ? '26' : '10';
      const fillGradient = node.shape === 'circle' ? 'url(#circleGradient)' : 'url(#nodeGradient)';
      const strokeColor = node.shape === 'circle' ? '#F97316' : '#E2E8F0';

      return `
        <g class="diagram-node" transform="translate(${node.x}, ${node.y})">
          <rect width="${node.width}" height="${node.height}" rx="${rx}" fill="${fillGradient}" stroke="${strokeColor}" stroke-width="1.5" filter="url(#dropShadow)" />
          <text x="${node.width / 2}" y="${node.height / 2 + 5}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#0F172A" text-anchor="middle">
            ${escapeXml(node.label)}
          </text>
        </g>
      `;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${diagram.width} ${diagram.height}" width="${diagram.width}" height="${diagram.height}">
  <defs>
    <!-- Arrowhead Marker -->
    <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#EA580C" />
    </marker>

    <!-- Node Drop Shadow -->
    <filter id="dropShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.08" />
    </filter>

    <!-- Gradients -->
    <linearGradient id="nodeGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F8FAFC" />
    </linearGradient>

    <linearGradient id="circleGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF7ED" />
      <stop offset="100%" stop-color="#FFEDD5" />
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="#FAF8F5" />
  ${linksSvg}
  ${nodesSvg}
</svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
