'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
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
import NodeSettingsPanel from './NodeSettingsPanel';

// LocalStorage keys
const STORAGE_KEYS = {
  NODES: 'weavy-canvas-nodes',
  EDGES: 'weavy-canvas-edges',
};

// Global lock to prevent duplicate API calls across all component instances
const GLOBAL_GENERATING_NODES = new Set<string>();

// Timestamp tracker to detect rapid duplicate calls (within 100ms)
const LAST_CALL_TIMESTAMPS = new Map<string, number>();

// Execution lock to prevent ANY duplicate execution
const EXECUTION_IN_PROGRESS = new Set<string>();

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

// Initial nodes - Start with empty canvas
const initialNodes: Node[] = [];

// Initial edges - Start with no connections
const initialEdges: Edge[] = [];

function FlowCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [bgVariant] = useState<BackgroundVariant>(BackgroundVariant.Dots);
  const [zoom, setZoom] = useState(100);
  const { screenToFlowPosition } = useReactFlow();

  // Panel state management
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Node settings panel state
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Store settings for each node - use BOTH state and ref
  const [nodeSettings, setNodeSettings] = useState<Record<string, any>>({});
  const nodeSettingsRef = useRef<Record<string, any>>({});

  // Sync ref with state whenever settings change
  useEffect(() => {
    nodeSettingsRef.current = nodeSettings;
  }, [nodeSettings]);

  // Track ongoing image generations to prevent duplicates
  const generatingNodes = useRef<Set<string>>(new Set());

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

  // Store refs to current nodes and edges for synchronous access
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  // Sync refs with state
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Handle Run Model for image generator nodes
  const handleRunModel = useCallback((nodeId: string) => {
    const callId = `${nodeId}-${Date.now()}-${Math.random()}`;
    console.log(`🎯 [${callId}] handleRunModel called for node: ${nodeId}`);

    // ABSOLUTE FIRST CHECK: SYNCHRONOUS execution lock
    if (EXECUTION_IN_PROGRESS.has(nodeId)) {
      console.log(`🛑 [${callId}] EXECUTION ALREADY IN PROGRESS - HARD ABORT`);
      return;
    }

    // SET EXECUTION LOCK IMMEDIATELY (synchronously, before ANY async operations)
    EXECUTION_IN_PROGRESS.add(nodeId);
    console.log(`🔐 [${callId}] EXECUTION LOCK SET`);

    // SECOND CHECK: Is this already generating?
    if (GLOBAL_GENERATING_NODES.has(nodeId)) {
      console.log(`🚫 [${callId}] GLOBAL lock ALREADY ACTIVE, ABORTING`);
      EXECUTION_IN_PROGRESS.delete(nodeId);
      return;
    }

    // THIRD CHECK: Timestamp-based throttle
    const now = Date.now();
    const lastCall = LAST_CALL_TIMESTAMPS.get(nodeId);
    if (lastCall && now - lastCall < 500) {
      console.log(`⚡ [${callId}] THROTTLED: Call within ${now - lastCall}ms, ABORTING`);
      EXECUTION_IN_PROGRESS.delete(nodeId);
      return;
    }

    // IMMEDIATELY set ALL locks before any other code runs
    console.log(`🔒 [${callId}] Setting all locks NOW`);
    GLOBAL_GENERATING_NODES.add(nodeId);
    generatingNodes.current.add(nodeId);
    LAST_CALL_TIMESTAMPS.set(nodeId, now);

    // Use refs to get current state synchronously (avoid nested state setters)
    const currentEdges = edgesRef.current;
    const currentNodes = nodesRef.current;

    // Find connected prompt nodes via edges
    const connectedEdge = currentEdges.find((edge) => edge.target === nodeId);

    if (!connectedEdge) {
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      alert('Please connect a Prompt node to the input before running the model.');
      return;
    }

    const imageNode = currentNodes.find((node) => node.id === nodeId);
    if (!imageNode) {
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      return;
    }

    // Additional check: Is this node already generating in current state?
    if (imageNode.data?.isGenerating) {
      console.log(`⏸️ [${callId}] Node already generating (state check), aborting`);
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      return;
    }

    const sourceNode = currentNodes.find((node) => node.id === connectedEdge.source);

    if (!sourceNode) {
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      alert('Connected prompt node not found.');
      return;
    }

    const promptText = sourceNode.data.value || '';

    if (!promptText.trim()) {
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      alert('The connected prompt is empty. Please enter some text first.');
      return;
    }

    // Get settings for this node (with defaults) - use REF to avoid stale closure
    const settings = nodeSettingsRef.current[nodeId] || {
      background: 'opaque',
      numberOfImages: 1,
      outputFormat: 'jpg',
      quality: 'high',
      size: '1024x1024',
    };

    console.log(`🎨 [${callId}] Generating image with prompt: "${promptText}"`);
    console.log(`📊 [${callId}] Using settings:`, settings);

    // Set generating state FIRST (before API call)
    setNodes((nds) =>
      nds.map((node) => {
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
      })
    );

    // Prepare API request body with all settings
    const requestBody = {
      prompt: promptText,
      background: settings.background,
      numberOfImages: settings.numberOfImages,
      outputFormat: settings.outputFormat,
      quality: settings.quality,
      size: settings.size,
    };

    console.log(`📤 [${callId}] Sending API request with body:`, requestBody);

    // Call backend API to generate image (OUTSIDE of state setters to prevent multiple calls)
    fetch('http://localhost:3001/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate image');
        }

        // Update node with generated image
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  isGenerating: false,
                  imageUrl: data.imageUrl,
                },
              };
            }
            return node;
          })
        );

        console.log(`✅ [${callId}] Image generated successfully:`, data.imageUrl);

        // Remove ALL locks after successful generation
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
      })
      .catch((error) => {
        console.error(`❌ [${callId}] Error generating image:`, error);

        // Update node to show error state
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  isGenerating: false,
                },
              };
            }
            return node;
          })
        );

        alert(`Failed to generate image: ${error.message}`);

        // Remove ALL locks after error
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
      });
  }, [setNodes]);

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

  // Handle node selection change
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      if (selectedNodes.length === 1 && selectedNodes[0].type === 'imageGenerator') {
        setSelectedNode(selectedNodes[0]);
        setIsSettingsPanelOpen(true);
      } else {
        setSelectedNode(null);
        setIsSettingsPanelOpen(false);
      }
    },
    []
  );

  // Handle settings panel close
  const handleCloseSettingsPanel = useCallback(() => {
    setIsSettingsPanelOpen(false);
    setSelectedNode(null);
  }, []);

  // Handle settings change from panel
  const handleSettingsChange = useCallback((nodeId: string, settings: any) => {
    console.log(`⚙️ Settings changed for node ${nodeId}:`, settings);
    setNodeSettings((prev) => {
      const newSettings = {
        ...prev,
        [nodeId]: settings,
      };
      // Ref is automatically synced via useEffect
      console.log(`✅ Settings updated, ref will sync automatically`);
      return newSettings;
    });
  }, []);

  // Handle run from settings panel
  const handleRunFromPanel = useCallback((nodeId: string) => {
    console.log(`📋 handleRunFromPanel called for nodeId: ${nodeId}`);
    if (nodeId) {
      handleRunModel(nodeId);
    } else {
      console.log(`⚠️ handleRunFromPanel: nodeId is empty/null`);
    }
  }, [handleRunModel]);

  // Log when handleRunModel is recreated (should only happen once now!)
  useEffect(() => {
    console.log(`🔄 handleRunModel callback was recreated/updated (this should only happen ONCE)`);
  }, [handleRunModel]);

  // Load saved canvas state from localStorage on mount
  useEffect(() => {
    if (isInitialized) return; // Prevent multiple loads

    try {
      const savedNodes = localStorage.getItem(STORAGE_KEYS.NODES);
      const savedEdges = localStorage.getItem(STORAGE_KEYS.EDGES);

      if (savedNodes) {
        const parsedNodes = JSON.parse(savedNodes);
        // Restore handlers for each node
        const nodesWithHandlers = parsedNodes.map((node: Node) => {
          if (node.type === 'promptInput') {
            return {
              ...node,
              data: {
                ...node.data,
                onChange: (nodeId: string, newValue: string) => {
                  setNodes((nds) =>
                    nds.map((n) => {
                      if (n.id === nodeId) {
                        return {
                          ...n,
                          data: {
                            ...n.data,
                            value: newValue,
                          },
                        };
                      }
                      return n;
                    })
                  );
                },
                onDelete: handleDeleteNode,
                onDuplicate: handleDuplicateNode,
              },
            };
          } else if (node.type === 'imageGenerator') {
            return {
              ...node,
              data: {
                ...node.data,
                isGenerating: false, // Always reset generating state on page load
                onRunModel: handleRunModel,
                onDelete: handleDeleteNode,
                onDuplicate: handleDuplicateNode,
              },
            };
          }
          return node;
        });
        setNodes(nodesWithHandlers);
        console.log(`✅ Loaded ${nodesWithHandlers.length} nodes from localStorage`);
      }

      if (savedEdges) {
        const parsedEdges = JSON.parse(savedEdges);
        setEdges(parsedEdges);
        console.log(`✅ Loaded ${parsedEdges.length} edges from localStorage`);
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('❌ Error loading canvas state:', error);
      setIsInitialized(true);
    }
  }, [isInitialized, handleDeleteNode, handleDuplicateNode, handleRunModel, setNodes, setEdges]);

  // Save canvas state to localStorage whenever nodes or edges change
  useEffect(() => {
    if (!isInitialized) return; // Don't save during initial load

    try {
      // Remove function handlers and temporary state before saving (can't be serialized)
      const nodesToSave = nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onChange: undefined,
          onRunModel: undefined,
          onDelete: undefined,
          onDuplicate: undefined,
          isGenerating: undefined, // Don't save loading state
        },
      }));

      localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(nodesToSave));
      localStorage.setItem(STORAGE_KEYS.EDGES, JSON.stringify(edges));
      console.log(`💾 Saved ${nodes.length} nodes and ${edges.length} edges to localStorage`);
    } catch (error) {
      console.error('❌ Error saving canvas state:', error);
    }
  }, [nodes, edges, isInitialized]);

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

      {/* Node Settings Panel - Right Side */}
      <NodeSettingsPanel
        isOpen={isSettingsPanelOpen}
        nodeId={selectedNode?.id || ''}
        nodeName={selectedNode?.data?.modelName || 'GPT Image 1'}
        creditCost={23}
        initialSettings={selectedNode?.id ? nodeSettings[selectedNode.id] : undefined}
        onClose={handleCloseSettingsPanel}
        onSettingsChange={(settings) => {
          if (selectedNode?.id) {
            handleSettingsChange(selectedNode.id, settings);
          }
        }}
        onRunModel={() => {
          if (selectedNode?.id) {
            handleRunFromPanel(selectedNode.id);
          }
        }}
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
          onSelectionChange={handleSelectionChange}
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
