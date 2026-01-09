'use client';

import { useState, useMemo } from 'react';

interface GraphNode {
  id: string;
  type: 'unit' | 'operation' | 'material' | 'quality' | 'ncr';
  label: string;
  sublabel?: string;
  status?: 'pass' | 'fail' | 'in_progress' | 'open' | 'closed';
  x: number;
  y: number;
  data?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

interface UnitData {
  id: string;
  serialNumber: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  workOrder: {
    orderNumber: string;
    productCode: string;
  };
  executions: Array<{
    id: string;
    startedAt: string;
    completedAt: string | null;
    result: string | null;
    operation: { sequence: number };
    station: { name: string };
    operator: { name: string };
  }>;
  qualityChecks: Array<{
    id: string;
    timestamp: string;
    result: string;
    definition: { name: string; checkType: string };
    operator: { name: string };
  }>;
  materialConsumptions: Array<{
    id: string;
    timestamp: string;
    qtyConsumed: number;
    materialLot: { lotNumber: string; materialCode: string };
    station: { name: string };
    operator: { name: string };
  }>;
  ncrs: Array<{
    id: string;
    createdAt: string;
    defectType: string;
    status: string;
    disposition: string | null;
    station: { name: string };
  }>;
}

interface TraceabilityGraphProps {
  data: UnitData;
  className?: string;
}

export function TraceabilityGraph({ data, className = '' }: TraceabilityGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Calculate graph layout
  const { nodes, edges } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Canvas dimensions
    const width = 1000;
    const centerX = width / 2;
    const centerY = 80;

    // Central unit node
    nodes.push({
      id: 'unit',
      type: 'unit',
      label: data.serialNumber,
      sublabel: data.workOrder.productCode,
      status: data.status === 'completed' ? 'pass' : 'in_progress',
      x: centerX,
      y: centerY,
      data: {
        status: data.status,
        workOrder: data.workOrder.orderNumber,
        product: data.workOrder.productCode,
        created: data.createdAt,
        completed: data.completedAt,
      },
    });

    // Operations in a horizontal row
    const opY = 200;
    const opSpacing = 150;
    const opStartX = centerX - ((data.executions.length - 1) * opSpacing) / 2;

    data.executions.forEach((exec, i) => {
      const nodeId = `op-${exec.id}`;
      nodes.push({
        id: nodeId,
        type: 'operation',
        label: `Step ${exec.operation.sequence}`,
        sublabel: exec.station.name,
        status: exec.result === 'pass' ? 'pass' : exec.result === 'fail' ? 'fail' : 'in_progress',
        x: opStartX + i * opSpacing,
        y: opY,
        data: {
          station: exec.station.name,
          operator: exec.operator.name,
          started: exec.startedAt,
          completed: exec.completedAt,
          result: exec.result,
        },
      });
      edges.push({ source: 'unit', target: nodeId });
    });

    // Materials below operations (connected to relevant operation by station match)
    const matY = 340;
    const matSpacing = 120;
    const matStartX = centerX - ((data.materialConsumptions.length - 1) * matSpacing) / 2;

    data.materialConsumptions.forEach((mat, i) => {
      const nodeId = `mat-${mat.id}`;
      nodes.push({
        id: nodeId,
        type: 'material',
        label: mat.materialLot.lotNumber,
        sublabel: `${mat.materialLot.materialCode} (x${mat.qtyConsumed})`,
        x: matStartX + i * matSpacing,
        y: matY,
        data: {
          lotNumber: mat.materialLot.lotNumber,
          materialCode: mat.materialLot.materialCode,
          quantity: mat.qtyConsumed,
          station: mat.station.name,
          operator: mat.operator.name,
          timestamp: mat.timestamp,
        },
      });

      // Connect to matching operation by station
      const matchingOp = data.executions.find((e) => e.station.name === mat.station.name);
      if (matchingOp) {
        edges.push({ source: `op-${matchingOp.id}`, target: nodeId });
      } else {
        edges.push({ source: 'unit', target: nodeId });
      }
    });

    // Quality checks on the right side
    const qcX = centerX + 350;
    const qcStartY = 120;
    const qcSpacing = 70;

    data.qualityChecks.forEach((qc, i) => {
      const nodeId = `qc-${qc.id}`;
      nodes.push({
        id: nodeId,
        type: 'quality',
        label: qc.definition.name,
        sublabel: qc.result.toUpperCase(),
        status: qc.result === 'pass' ? 'pass' : 'fail',
        x: qcX,
        y: qcStartY + i * qcSpacing,
        data: {
          checkName: qc.definition.name,
          checkType: qc.definition.checkType,
          result: qc.result,
          operator: qc.operator.name,
          timestamp: qc.timestamp,
        },
      });
      edges.push({ source: 'unit', target: nodeId });
    });

    // NCRs on the left side
    const ncrX = centerX - 350;
    const ncrStartY = 120;
    const ncrSpacing = 80;

    data.ncrs.forEach((ncr, i) => {
      const nodeId = `ncr-${ncr.id}`;
      nodes.push({
        id: nodeId,
        type: 'ncr',
        label: ncr.defectType,
        sublabel: ncr.status,
        status: ncr.status === 'closed' ? 'closed' : 'open',
        x: ncrX,
        y: ncrStartY + i * ncrSpacing,
        data: {
          defectType: ncr.defectType,
          status: ncr.status,
          disposition: ncr.disposition,
          station: ncr.station.name,
          created: ncr.createdAt,
        },
      });
      edges.push({ source: 'unit', target: nodeId });
    });

    return { nodes, edges };
  }, [data]);

  // Calculate SVG viewBox
  const viewBox = useMemo(() => {
    if (nodes.length === 0) return '0 0 1000 400';
    const padding = 60;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [nodes]);

  const getNodeColor = (node: GraphNode) => {
    const colors = {
      unit: { fill: '#3b82f6', stroke: '#1d4ed8', text: '#ffffff' },
      operation: {
        pass: { fill: '#22c55e', stroke: '#15803d', text: '#ffffff' },
        fail: { fill: '#ef4444', stroke: '#b91c1c', text: '#ffffff' },
        in_progress: { fill: '#f59e0b', stroke: '#b45309', text: '#ffffff' },
      },
      material: { fill: '#8b5cf6', stroke: '#6d28d9', text: '#ffffff' },
      quality: {
        pass: { fill: '#22c55e', stroke: '#15803d', text: '#ffffff' },
        fail: { fill: '#ef4444', stroke: '#b91c1c', text: '#ffffff' },
      },
      ncr: {
        open: { fill: '#ef4444', stroke: '#b91c1c', text: '#ffffff' },
        closed: { fill: '#6b7280', stroke: '#4b5563', text: '#ffffff' },
      },
    };

    if (node.type === 'unit') return colors.unit;
    if (node.type === 'material') return colors.material;
    if (node.type === 'operation') {
      return colors.operation[node.status as 'pass' | 'fail' | 'in_progress'] || colors.operation.in_progress;
    }
    if (node.type === 'quality') {
      return colors.quality[node.status as 'pass' | 'fail'] || colors.quality.pass;
    }
    if (node.type === 'ncr') {
      return colors.ncr[node.status as 'open' | 'closed'] || colors.ncr.open;
    }
    return colors.unit;
  };

  const getNodeRadius = (node: GraphNode) => {
    if (node.type === 'unit') return 40;
    if (node.type === 'operation') return 30;
    return 25;
  };

  const getEdgePath = (edge: GraphEdge) => {
    const source = nodes.find((n) => n.id === edge.source);
    const target = nodes.find((n) => n.id === edge.target);
    if (!source || !target) return '';

    // Curved path
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dr = Math.sqrt(dx * dx + dy * dy) * 0.3;

    return `M${source.x},${source.y} Q${source.x + dx / 2},${source.y + dy / 2 - dr} ${target.x},${target.y}`;
  };

  return (
    <div className={`bg-gray-50 rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Unit Genealogy Graph</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <span>Unit</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span>Pass</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span>Fail/NCR</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-purple-500" />
              <span>Material</span>
            </div>
          </div>
        </div>
      </div>

      {/* Graph */}
      <div className="p-4">
        <svg
          viewBox={viewBox}
          className="w-full h-auto"
          style={{ minHeight: '400px', maxHeight: '600px' }}
        >
          {/* Edges */}
          <g className="edges">
            {edges.map((edge, i) => (
              <path
                key={i}
                d={getEdgePath(edge)}
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeDasharray="4,4"
                className="transition-opacity"
                opacity={
                  hoveredNode
                    ? edge.source === hoveredNode || edge.target === hoveredNode
                      ? 1
                      : 0.2
                    : 0.6
                }
              />
            ))}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {nodes.map((node) => {
              const colors = getNodeColor(node);
              const radius = getNodeRadius(node);
              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNode === node.id;

              return (
                <g
                  key={node.id}
                  className="cursor-pointer transition-transform"
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode(isSelected ? null : node)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{
                    transform: `translate(${node.x}px, ${node.y}px) scale(${isHovered ? 1.1 : 1})`,
                    transformOrigin: 'center',
                  }}
                >
                  {/* Glow effect when selected */}
                  {isSelected && (
                    <circle
                      r={radius + 8}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth="3"
                      opacity="0.5"
                    />
                  )}

                  {/* Main circle */}
                  <circle
                    r={radius}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth="3"
                  />

                  {/* Icon based on type */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={colors.text}
                    fontSize={node.type === 'unit' ? '16' : '12'}
                    fontWeight="bold"
                  >
                    {node.type === 'unit' && '⚙'}
                    {node.type === 'operation' && '▶'}
                    {node.type === 'material' && '📦'}
                    {node.type === 'quality' && (node.status === 'pass' ? '✓' : '✗')}
                    {node.type === 'ncr' && '⚠'}
                  </text>

                  {/* Label below */}
                  <text
                    y={radius + 14}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {node.label}
                  </text>
                  {node.sublabel && (
                    <text
                      y={radius + 26}
                      textAnchor="middle"
                      fill="#6b7280"
                      fontSize="9"
                    >
                      {node.sublabel}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Selected Node Details Panel */}
      {selectedNode && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 rounded-b-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900">
              {selectedNode.type === 'unit' && 'Unit Details'}
              {selectedNode.type === 'operation' && 'Operation Details'}
              {selectedNode.type === 'material' && 'Material Details'}
              {selectedNode.type === 'quality' && 'Quality Check Details'}
              {selectedNode.type === 'ncr' && 'NCR Details'}
            </h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {selectedNode.data &&
              Object.entries(selectedNode.data).map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-500">{key}: </span>
                  <span className="font-medium text-gray-900">
                    {value instanceof Date
                      ? value.toLocaleString()
                      : typeof value === 'string' && value.includes('T')
                        ? new Date(value).toLocaleString()
                        : String(value ?? 'N/A')}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
