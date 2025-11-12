'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
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
import { ImageDescriberNode } from './ImageDescriberNode';

// Define node types
const nodeTypes = {
  custom: CustomNode,
  promptInput: PromptInputNode,
  imageGenerator: ImageGeneratorNode,
  imageDescriber: ImageDescriberNode,
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
  const { screenToFlowPosition, getNodes } = useReactFlow();

  // Panel state management
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Node settings panel state
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  
  // Track mouse state to prevent panel opening during selection drag
  const isSelectingRef = useRef(false);
  const pendingSelectionRef = useRef<Node[]>([]);

  // Toolbar state
  const [activeTool, setActiveTool] = useState<'pointer' | 'hand'>('pointer');

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

    const currentNode = currentNodes.find((node) => node.id === nodeId);
    if (!currentNode) {
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      return;
    }

    // Handle Image Describer nodes differently
    if (currentNode.type === 'imageDescriber') {
      // Find connected image input
      const imageEdge = currentEdges.find((edge) => edge.target === nodeId && edge.targetHandle === 'image');
      
      if (!imageEdge) {
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
        alert('Please connect an Image Generator node to the Image input before running the model.');
        return;
      }

      const imageSourceNode = currentNodes.find((node) => node.id === imageEdge.source);
      if (!imageSourceNode || imageSourceNode.type !== 'imageGenerator') {
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
        alert('Connected image node not found or invalid.');
        return;
      }

      const imageUrl = imageSourceNode.data?.imageUrl;
      if (!imageUrl) {
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
        alert('The connected image node has no generated image. Please generate an image first.');
        return;
      }

      // Set generating state
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

      // Call backend API to describe image
      fetch('http://localhost:3001/api/describe-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success && data.description) {
            setNodes((nds) =>
              nds.map((node) => {
                if (node.id === nodeId) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      description: data.description,
                      isGenerating: false,
                    },
                  };
                }
                return node;
              })
            );
          } else {
            throw new Error(data.error || 'Failed to describe image');
          }
        })
        .catch((error) => {
          console.error('Error describing image:', error);
          alert(`Error: ${error.message}`);
          setNodes((nds) =>
            nds.map((node) => {
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
        })
        .finally(() => {
          EXECUTION_IN_PROGRESS.delete(nodeId);
          GLOBAL_GENERATING_NODES.delete(nodeId);
          generatingNodes.current.delete(nodeId);
        });

      return;
    }

    // Find connected edges - support both prompt and image prompt inputs (for image generator nodes)
    const connectedEdges = currentEdges.filter((edge) => edge.target === nodeId);
    const promptEdge = connectedEdges.find((edge) => !edge.targetHandle || edge.targetHandle === 'prompt');
    const imagePromptEdge = connectedEdges.find((edge) => edge.targetHandle === 'imagePrompt');

    if (!promptEdge) {
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      alert('Please connect a Prompt node to the input before running the model.');
      return;
    }

    const imageNode = currentNode;
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

    // Get prompt text from connected prompt node
    // Support both PromptInputNode (data.value) and ImageDescriberNode (data.description)
    const promptSourceNode = currentNodes.find((node) => node.id === promptEdge.source);
    if (!promptSourceNode) {
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      alert('Connected prompt node not found.');
      return;
    }

    // Get text from different node types
    let promptText = '';
    if (promptSourceNode.type === 'imageDescriber') {
      // Image Describer stores text in data.description
      promptText = promptSourceNode.data?.description || '';
    } else if (promptSourceNode.type === 'promptInput') {
      // Prompt Input stores text in data.value
      promptText = promptSourceNode.data?.value || '';
    } else {
      // Fallback: try both
      promptText = promptSourceNode.data?.value || promptSourceNode.data?.description || '';
    }

    if (!promptText.trim()) {
      EXECUTION_IN_PROGRESS.delete(nodeId);
      GLOBAL_GENERATING_NODES.delete(nodeId);
      generatingNodes.current.delete(nodeId);
      LAST_CALL_TIMESTAMPS.delete(nodeId);
      if (promptSourceNode.type === 'imageDescriber') {
        alert('The connected Image Describer has no description yet. Please run the Image Describer first to generate a description.');
      } else {
        alert('The connected prompt is empty. Please enter some text first.');
      }
      return;
    }

    // Get image prompt URL from connected image generator node (if connected)
    let imagePromptUrl: string | undefined = undefined;
    if (imagePromptEdge) {
      const imagePromptSourceNode = currentNodes.find((node) => node.id === imagePromptEdge.source);
      if (imagePromptSourceNode && imagePromptSourceNode.type === 'imageGenerator') {
        imagePromptUrl = imagePromptSourceNode.data?.imageUrl;
        console.log(`🖼️ [${callId}] Found image prompt from node ${imagePromptSourceNode.id}: ${imagePromptUrl}`);
      }
    }

        // Get model ID from node data
        const modelId = imageNode.data?.modelId || 'bytedance/seedream-4';
        
        console.log(`🔍 [${callId}] Node data:`, {
          nodeId,
          modelId: imageNode.data?.modelId,
          modelName: imageNode.data?.modelName,
          fullData: imageNode.data,
        });

        // Get settings for this node (with defaults) - use REF to avoid stale closure
        const defaultSettings = modelId === 'black-forest-labs/flux-1.1-pro-ultra' 
          ? {
              aspectRatio: '1:1',
              promptUpsampling: true,
              seed: undefined,
              safetyTolerance: 2,
              outputFormat: 'png',
              raw: false,
            }
          : {
              // Seedream-4 default settings
              size: '2K',
              width: 2048,
              height: 2048,
              aspectRatio: '4:3',
              maxImages: 1,
              enhancePrompt: true,
              sequentialImageGeneration: 'disabled',
            };

        const settings = nodeSettingsRef.current[nodeId] || defaultSettings;

        console.log(`🎨 [${callId}] Generating image with prompt: "${promptText}"`);
        console.log(`📊 [${callId}] Using model: ${modelId}`);
        console.log(`📊 [${callId}] Node modelId from data: ${imageNode.data?.modelId}`);
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

        // Prepare API request body with model ID and filtered settings
        // Only include parameters relevant to the selected model
        const requestBody: any = {
          modelId: modelId,
          prompt: promptText,
        };

        if (modelId === 'black-forest-labs/flux-1.1-pro-ultra') {
          // Flux-specific parameters only
          requestBody.aspectRatio = settings.aspectRatio;
          requestBody.promptUpsampling = settings.promptUpsampling;
          requestBody.safetyTolerance = settings.safetyTolerance;
          requestBody.outputFormat = settings.outputFormat;
          requestBody.raw = settings.raw;
          if (settings.seed !== undefined) {
            requestBody.seed = settings.seed;
          }
          // Add image prompt if connected
          if (imagePromptUrl) {
            requestBody.imagePrompt = imagePromptUrl;
            console.log(`🖼️ [${callId}] Adding image prompt to request: ${imagePromptUrl}`);
          }
        } else {
          // Seedream-4 parameters only
          requestBody.size = settings.size || '2K';
          requestBody.width = settings.width || 2048;
          requestBody.height = settings.height || 2048;
          requestBody.aspectRatio = settings.aspectRatio || '4:3';
          requestBody.maxImages = settings.maxImages || 1;
          requestBody.enhancePrompt = settings.enhancePrompt !== false;
          requestBody.sequentialImageGeneration = settings.sequentialImageGeneration || 'disabled';
        }

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
          // Extract detailed error message from backend
          const errorMsg = data.message || data.error || 'Failed to generate image';
          const errorDetails = data.details ? `\n\nDetails: ${data.details}` : '';
          throw new Error(`${errorMsg}${errorDetails}`);
        }

        // Validate response has imageUrl
        if (!data.imageUrl) {
          console.warn(`⚠️ [${callId}] Response missing imageUrl:`, data);
          throw new Error('Server response missing image URL');
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
        console.error(`❌ [${callId}] Error stack:`, error.stack);

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

        // Show detailed error message
        const errorMessage = error.message || 'Failed to generate image. Please check the console for details.';
        alert(`Failed to generate image:\n\n${errorMessage}`);

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
          type: 'imageGenerator',
          position,
          data: {
            label: 'Image Generator',
            modelName: 'Seedream-4',
            modelId: 'bytedance/seedream-4',
            imageUrl: undefined,
            isGenerating: false,
            onRunModel: handleRunModel,
            onDelete: handleDeleteNode,
            onDuplicate: handleDuplicateNode,
          },
        };
      } else if (type === 'fluxGenerator') {
        newNode = {
          id: newNodeId,
          type: 'imageGenerator', // Use same node component
          position,
          data: {
            label: 'Image Generator',
            modelName: 'FLUX 1.1 Pro Ultra',
            modelId: 'black-forest-labs/flux-1.1-pro-ultra',
            imageUrl: undefined,
            isGenerating: false,
            onRunModel: handleRunModel,
            onDelete: handleDeleteNode,
            onDuplicate: handleDuplicateNode,
          },
        };
      } else if (type === 'imageDescriber') {
        newNode = {
          id: newNodeId,
          type: 'imageDescriber',
          position,
          data: {
            label: 'Image Describer',
            description: undefined,
            imageUrls: [],
            isGenerating: false,
            onRunModel: handleRunModel,
            onDelete: handleDeleteNode,
            onDuplicate: handleDuplicateNode,
            onAddImage: (nodeId: string) => {
              // TODO: Implement add image functionality
              console.log('Add image clicked for node:', nodeId);
            },
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

  // Update panel based on selection - show ALL selected nodes
  const updatePanelForSelection = useCallback((selectedNodesList: Node[]) => {
    console.log('🔍 updatePanelForSelection called with', selectedNodesList.length, 'nodes');
    
    // Only update if there are actually nodes selected
    if (selectedNodesList.length === 0) {
      console.log('🔍 No nodes selected, closing panel');
      setSelectedNodes([]);
      setSelectedNode(null);
      setIsSettingsPanelOpen(false);
      return;
    }
    
    // Check if there are any imageGenerator nodes (these have settings to show)
    const hasImageGeneratorNodes = selectedNodesList.some(node => 
      node.type === 'imageGenerator'
    );
    
    // Show all selected nodes in panel, but only open if there are imageGenerator nodes
    console.log('🔍 Setting selectedNodes to', selectedNodesList.length, 'nodes:', selectedNodesList.map(n => ({ id: n.id, type: n.type })));
    setSelectedNodes(selectedNodesList);
    
    if (hasImageGeneratorNodes) {
      const imageGeneratorNodes = selectedNodesList.filter(node => node.type === 'imageGenerator');
      
      if (imageGeneratorNodes.length === 1) {
        // Single imageGenerator selection - show detailed settings panel
        console.log('🔍 Single imageGenerator selection, showing detailed panel');
        setSelectedNode(imageGeneratorNodes[0]);
        setIsSettingsPanelOpen(true);
      } else {
        // Multiple selection - show multi-selection panel with all nodes
        console.log('🔍 Multiple selection, showing multi-selection panel');
        setSelectedNode(null);
        setIsSettingsPanelOpen(true);
      }
    } else {
      // No imageGenerator nodes selected, close panel
      console.log('🔍 No imageGenerator nodes selected, closing panel');
      setSelectedNodes([]);
      setSelectedNode(null);
      setIsSettingsPanelOpen(false);
    }
  }, []);

  // Handle node selection change - only update panel after mouse release
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodesList }: { nodes: Node[] }) => {
      console.log('🔍 handleSelectionChange called with nodes:', selectedNodesList.length, selectedNodesList.map(n => ({ id: n.id, type: n.type })));
      
      // Store the pending selection but don't open panel yet if we're still selecting
      pendingSelectionRef.current = selectedNodesList;
      
      // If we're not currently selecting (mouse is up), update immediately
      if (!isSelectingRef.current) {
        // Always update based on current selection - panel stays open if nodes are selected
        console.log('🔍 Updating panel immediately with', selectedNodesList.length, 'nodes');
        updatePanelForSelection(selectedNodesList);
      } else {
        console.log('🔍 Selection in progress, waiting for mouse up');
      }
    },
    [updatePanelForSelection]
  );

  // Track mouse down/up for selection
  useEffect(() => {
    let mouseDownTime = 0;
    let mouseDownX = 0;
    let mouseDownY = 0;
    const DRAG_THRESHOLD = 5; // pixels
    const CLICK_THRESHOLD = 200; // milliseconds

    const handleMouseDown = (e: MouseEvent) => {
      // Only track if clicking on canvas (not on nodes or other elements)
      const target = e.target as HTMLElement;
      if (target.closest('.react-flow__pane') && !target.closest('.react-flow__node')) {
        isSelectingRef.current = true;
        mouseDownTime = Date.now();
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isSelectingRef.current) {
        const distance = Math.sqrt(
          Math.pow(e.clientX - mouseDownX, 2) + Math.pow(e.clientY - mouseDownY, 2)
        );
        // If mouse moved significantly, it's a drag
        if (distance > DRAG_THRESHOLD) {
          // Keep isSelectingRef.current = true to prevent panel opening during drag
        }
      }
    };

    const handleMouseUp = () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        
        // Get the current selection directly from React Flow nodes (more reliable than ref)
        // Small delay to ensure React Flow has updated its selection state
        setTimeout(() => {
          const allNodes = getNodes();
          const currentlySelectedNodes = allNodes.filter(node => node.selected);
          console.log('🔍 Mouse up - React Flow reports', currentlySelectedNodes.length, 'selected nodes');
          
          // Update panel with all selected nodes (filtering happens in updatePanelForSelection)
          updatePanelForSelection(currentlySelectedNodes);
        }, 10); // Small delay to ensure React Flow has updated
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updatePanelForSelection]);

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

  // Handle run all selected nodes
  const handleRunSelectedNodes = useCallback(
    (nodeIds: string[], runs: number = 1) => {
      console.log(`🎛️ [Panel] handleRunSelectedNodes called for ${nodeIds.length} nodes with ${runs} runs:`, nodeIds);
      
      // Run each node the specified number of times
      let runIndex = 0;
      for (let run = 0; run < runs; run++) {
        nodeIds.forEach((nodeId, nodeIndex) => {
          setTimeout(() => {
            handleRunModel(nodeId);
          }, runIndex * 100); // Small delay between runs to prevent overwhelming the API
          runIndex++;
        });
      }
    },
    [handleRunModel]
  );

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
            // Migrate old GPT Image 1 nodes to Seedream-4
            let modelId = node.data?.modelId || 'bytedance/seedream-4';
            let modelName = node.data?.modelName || 'Seedream-4';
            
            if (modelId === 'openai/gpt-image-1' || !modelId) {
              console.log(`🔄 Migrating old GPT Image 1 node to Seedream-4: ${node.id}`);
              modelId = 'bytedance/seedream-4';
              modelName = 'Seedream-4';
            }
            
            return {
              ...node,
              data: {
                ...node.data,
                isGenerating: false, // Always reset generating state on page load
                modelId: modelId,
                modelName: modelName,
                onRunModel: handleRunModel,
                onDelete: handleDeleteNode,
                onDuplicate: handleDuplicateNode,
              },
            };
          } else if (node.type === 'imageDescriber') {
            return {
              ...node,
              data: {
                ...node.data,
                isGenerating: false, // Always reset generating state on page load
                onRunModel: handleRunModel,
                onDelete: handleDeleteNode,
                onDuplicate: handleDuplicateNode,
                onAddImage: (nodeId: string) => {
                  // TODO: Implement add image functionality
                  console.log('Add image clicked for node:', nodeId);
                },
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
        nodeName={selectedNode?.data?.modelName || 'Seedream-4'}
        modelId={selectedNode?.data?.modelId || 'bytedance/seedream-4'}
        creditCost={selectedNode?.type === 'imageGenerator' 
          ? (selectedNode?.data?.modelId === 'black-forest-labs/flux-1.1-pro-ultra' ? 11 : 23)
          : selectedNode?.type === 'imageDescriber' ? 1 : 0}
        initialSettings={selectedNode?.id ? nodeSettings[selectedNode.id] : undefined}
        selectedNodes={selectedNodes}
        nodeSettingsMap={nodeSettings}
        onClose={handleCloseSettingsPanel}
        onSettingsChange={(nodeId, settings) => {
          handleSettingsChange(nodeId, settings);
        }}
        onRunModel={() => {
          if (selectedNode?.id) {
            handleRunFromPanel(selectedNode.id);
          }
        }}
        onRunSelectedNodes={handleRunSelectedNodes}
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
          panOnDrag={activeTool === 'hand'}
          selectionOnDrag={activeTool === 'pointer'}
          minZoom={0.01}
          maxZoom={20}
          proOptions={{ hideAttribution: true }}
          className={`bg-[#0a0a0a] ${activeTool === 'pointer' ? 'cursor-default' : 'cursor-grab'}`}
        >
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
          onToolChange={setActiveTool}
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
