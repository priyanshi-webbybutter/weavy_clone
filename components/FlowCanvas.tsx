'use client';

import React, { useCallback, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import BottomToolbar from './BottomToolbar';

// Import custom node types
import { CustomNode } from './CustomNode';

// Define node types
const nodeTypes = {
  custom: CustomNode,
};

// Initial nodes with different types
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: { label: 'Prompt Node', description: 'AI-powered prompt generation' },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 100, y: 300 },
    data: { label: 'Image Generator', description: 'Generate images from prompts' },
  },
  {
    id: '3',
    type: 'default',
    position: { x: 400, y: 300 },
    data: { label: 'Output' },
  },
];

// Initial edges
const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#8b5cf6' } },
  { id: 'e1-3', source: '1', target: '3', style: { stroke: '#8b5cf6' } },
];

export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [bgVariant] = useState<BackgroundVariant>(BackgroundVariant.Dots);
  const [zoom, setZoom] = useState(100);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#8b5cf6' }
    }, eds)),
    [setEdges]
  );

  // Handle zoom change
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    // Note: Actual zoom implementation would require useReactFlow hook
    // For now, this just updates the display
  }, []);

  // Handle undo (placeholder)
  const handleUndo = useCallback(() => {
    console.log('Undo clicked');
    // TODO: Implement undo functionality
  }, []);

  // Handle redo (placeholder)
  const handleRedo = useCallback(() => {
    console.log('Redo clicked');
    // TODO: Implement redo functionality
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-[#0a0a0a] border-b border-[#2a2a2a] flex items-center justify-between px-6 z-30">
        {/* Left: Project Name */}
        <input
          type="text"
          defaultValue="untitled"
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-[#3a3a3a] w-64"
          placeholder="Project name"
        />

        {/* Right: Credits and Share */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="text-yellow-400">✨</span>
            <span>131 credits</span>
          </div>
          <button className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2">
            <span>↗</span>
            Share
          </button>
        </div>
      </div>

      {/* ReactFlow Canvas */}
      <div className="w-full h-full pt-16">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#0a0a0a]"
        >
          {/* MiniMap */}
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'custom':
                  return '#8b5cf6';
                default:
                  return '#4a5568';
              }
            }}
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-[#1a1a1a] border border-[#2a2a2a]"
          />

          {/* Background */}
          <Background
            variant={bgVariant}
            gap={16}
            size={1}
            color="#2a2a2a"
            className="bg-[#0a0a0a]"
          />
        </ReactFlow>
      </div>

      {/* Bottom Toolbar */}
      <BottomToolbar
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  );
}
