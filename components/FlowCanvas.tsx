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
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import BottomToolbar from './BottomToolbar';
import Sidebar from './Sidebar';
import SidePanel from './SidePanel';

// Import custom node types
import { CustomNode } from './CustomNode';
import { PromptInputNode } from './PromptInputNode';
import { ImageGeneratorNode } from './ImageGeneratorNode';

// Define node types
const nodeTypes = {
  custom: CustomNode,
  promptInput: PromptInputNode,
  imageGenerator: ImageGeneratorNode,
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

function FlowCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [bgVariant] = useState<BackgroundVariant>(BackgroundVariant.Dots);
  const [zoom, setZoom] = useState(100);
  const { screenToFlowPosition } = useReactFlow();

  // Panel state management
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState<string | null>(null);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#8b5cf6' }
    }, eds)),
    [setEdges]
  );

  // Handle node deletion
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  // Handle Run Model for image generator nodes
  const handleRunModel = useCallback((nodeId: string) => {
    // Access current edges state
    setEdges((currentEdges) => {
      // Find connected prompt nodes via edges
      const connectedEdge = currentEdges.find((edge) => edge.target === nodeId);

      if (!connectedEdge) {
        alert('Please connect a Prompt node to the input before running the model.');
        return currentEdges;
      }

      // Now update nodes with the found edge
      setNodes((nds) => {
        const imageNode = nds.find((node) => node.id === nodeId);
        if (!imageNode) return nds;

        const sourceNode = nds.find((node) => node.id === connectedEdge.source);

        if (!sourceNode) {
          alert('Connected prompt node not found.');
          return nds;
        }

        const promptText = sourceNode.data.value || '';

        if (!promptText.trim()) {
          alert('The connected prompt is empty. Please enter some text first.');
          return nds;
        }

        console.log(`🎨 Generating image with prompt: "${promptText}"`);

        // Set generating state
        const updatedNodes = nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                isGenerating: true,
              },
            };
          }
          return node;
        });

        // Simulate image generation with timeout
        setTimeout(() => {
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              if (node.id === nodeId) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    isGenerating: false,
                    // Placeholder image URL - replace with actual API call
                    imageUrl: `https://picsum.photos/400/400?random=${Date.now()}`,
                  },
                };
              }
              return node;
            })
          );
        }, 2000); // 2 second delay to simulate generation

        return updatedNodes;
      });

      return currentEdges;
    });
  }, [setNodes, setEdges]);

  // Handle node duplication
  const handleDuplicateNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const nodeToDuplicate = nds.find((node) => node.id === nodeId);
      if (!nodeToDuplicate) return nds;

      const newNodeId = `${nodeToDuplicate.type}-${Date.now()}`;
      const newNode: Node = {
        ...nodeToDuplicate,
        id: newNodeId,
        position: {
          x: nodeToDuplicate.position.x + 50,
          y: nodeToDuplicate.position.y + 50,
        },
        data: {
          ...nodeToDuplicate.data,
          // Update handlers for the duplicated node
          onChange: nodeToDuplicate.type === 'promptInput'
            ? (id: string, newValue: string) => {
                setNodes((nodes) =>
                  nodes.map((node) => {
                    if (node.id === id) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          value: newValue,
                        },
                      };
                    }
                    return node;
                  })
                );
              }
            : undefined,
          onRunModel: nodeToDuplicate.type === 'imageGenerator' ? handleRunModel : undefined,
          onDelete: handleDeleteNode,
          onDuplicate: handleDuplicateNode,
        },
      };

      return nds.concat(newNode);
    });
  }, [setNodes, handleDeleteNode, handleRunModel]);

  // Handle drag over canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop on canvas
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      // Check if a valid node type was dropped
      if (typeof type === 'undefined' || !type) {
        return;
      }

      // Convert screen coordinates to flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Create new node with unique ID
      const newNodeId = `${type}-${Date.now()}`;

      let newNode: Node;

      // Create node based on type
      if (type === 'promptInput') {
        newNode = {
          id: newNodeId,
          type,
          position,
          data: {
            label: 'Prompt',
            value: '',
            onChange: (nodeId: string, newValue: string) => {
              setNodes((nds) =>
                nds.map((node) => {
                  if (node.id === nodeId) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        value: newValue,
                      },
                    };
                  }
                  return node;
                })
              );
            },
            onDelete: handleDeleteNode,
            onDuplicate: handleDuplicateNode,
          },
        };
      } else if (type === 'imageGenerator') {
        newNode = {
          id: newNodeId,
          type,
          position,
          data: {
            label: 'Image Generator',
            modelName: 'GPT Image 1',
            imageUrl: undefined,
            isGenerating: false,
            onRunModel: handleRunModel,
            onDelete: handleDeleteNode,
            onDuplicate: handleDuplicateNode,
          },
        };
      } else {
        // Default fallback
        newNode = {
          id: newNodeId,
          type: 'default',
          position,
          data: { label: 'New Node' },
        };
      }

      // Add the new node to the canvas
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, handleDeleteNode, handleDuplicateNode, handleRunModel]
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

  // Handle panel open
  const handleOpenPanel = useCallback((type: string) => {
    setPanelType(type);
    setIsPanelOpen(true);
  }, []);

  // Handle panel close
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setPanelType(null);
  }, []);

  return (
    <>
      {/* Sidebar - Fixed Position */}
      <Sidebar onOpenPanel={handleOpenPanel} activePanelType={panelType} />

      {/* Side Panel - Fixed Position */}
      <SidePanel
        isOpen={isPanelOpen}
        panelType={panelType}
        onClose={handleClosePanel}
      />

      {/* Main Content Area with Margin for Sidebar */}
      <div className="ml-[68px] w-[calc(100vw-68px)] h-screen relative">
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
          onDrop={onDrop}
          onDragOver={onDragOver}
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
                case 'promptInput':
                  return '#d946ef';
                case 'imageGenerator':
                  return '#06b6d4';
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
    </>
  );
}

export default function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
