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
import FullscreenModal from './FullscreenModal';

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
import { VideoGeneratorNode } from './VideoGeneratorNode';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Define node types
const nodeTypes = {
  custom: CustomNode,
  promptInput: PromptInputNode,
  imageGenerator: ImageGeneratorNode,
  imageDescriber: ImageDescriberNode,
  videoGenerator: VideoGeneratorNode,
};

// Initial nodes - Start with empty canvas
const initialNodes: Node[] = [];

// Initial edges - Start with no connections
const initialEdges: Edge[] = [];

// Task interface
interface Task {
  id: string;
  nodeId: string;
  nodeName: string;
  startTime: Date;
  completed: number;
  total: number;
  status: 'running' | 'completed' | 'failed';
}

function FlowCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [isTasksDropdownOpen, setIsTasksDropdownOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [bgVariant] = useState<BackgroundVariant>(BackgroundVariant.Dots);
  const [zoom, setZoom] = useState(100);
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const { signOut, user } = useAuth();
  const router = useRouter();

  // Panel state management
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Node settings panel state
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  
  // Fullscreen modal state
  const [fullscreenNodeId, setFullscreenNodeId] = useState<string | null>(null);
  
  // Track mouse state to prevent panel opening during selection drag
  const isSelectingRef = useRef(false);
  const pendingSelectionRef = useRef<Node[]>([]);

  // Toolbar state
  const [activeTool, setActiveTool] = useState<'pointer' | 'hand'>('pointer');

  // Store settings for each node - use BOTH state and ref
  const [nodeSettings, setNodeSettings] = useState<Record<string, any>>({});
  const nodeSettingsRef = useRef<Record<string, any>>({});

  // Note: We update the ref manually in handleSettingsChange to avoid timing issues
  // The ref is the source of truth for handleRunModel to avoid stale closures

  // Track ongoing image generations to prevent duplicates
  const generatingNodes = useRef<Set<string>>(new Set());

  // Validate connections - Prompt node should only connect to text/prompt inputs
  const isValidConnection = useCallback((connection: Connection) => {
    // Get source and target nodes
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    // If source is a Prompt node (text output)
    if (sourceNode?.type === 'promptInput') {
      // Only allow connections to handles that accept text/prompt
      if (targetNode?.type === 'videoGenerator') {
        // Video generator: only 'prompt' and 'negativePrompt' accept text
        const textAcceptingHandles = ['prompt', 'negativePrompt'];
        if (connection.targetHandle) {
          return textAcceptingHandles.includes(connection.targetHandle);
        }
        // If no target handle specified, reject (shouldn't happen but be safe)
        return false;
      }
      
      // For image generator nodes, allow connections to prompt inputs
      if (targetNode?.type === 'imageGenerator') {
        // Image generator: allow 'prompt' and 'imagePrompt' (imagePrompt can accept text URLs)
        const textAcceptingHandles = ['prompt', 'imagePrompt'];
        if (connection.targetHandle) {
          return textAcceptingHandles.includes(connection.targetHandle);
        }
        return false;
      }
      
      // For image describer nodes, allow connections to prompt inputs
      if (targetNode?.type === 'imageDescriber') {
        // Image describer: allow 'prompt' handle
        const textAcceptingHandles = ['prompt'];
        if (connection.targetHandle) {
          return textAcceptingHandles.includes(connection.targetHandle);
        }
        return false;
      }
      
      // Default: reject connections to unknown node types
      return false;
    }
    
    // Default: allow all other connections (non-prompt sources)
    return true;
  }, [nodes]);

  // Handle connection between nodes
  const onConnect = useCallback(
    (params: Connection | Edge) => {
      // Only add edge if connection is valid
      if (isValidConnection(params as Connection)) {
        setEdges((eds) => addEdge({
          ...params,
          animated: true,
          style: { stroke: '#8b5cf6' }
        }, eds));
      }
    },
    [setEdges, isValidConnection]
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

  // Helper function to format date/time
  const formatDateTime = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${month} ${day}, ${displayHours}:${displayMinutes} ${ampm}`;
  };

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

    // Create task for tracking
    const taskNode = currentNodes.find((n) => n.id === nodeId);
    const nodeName = taskNode?.data?.modelName || taskNode?.type || 'Task';
    const taskId = `task-${nodeId}-${Date.now()}`;
    const newTask: Task = {
      id: taskId,
      nodeId,
      nodeName,
      startTime: new Date(),
      completed: 0,
      total: 1,
      status: 'running',
    };
    setTasks((prev) => [...prev, newTask]);

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

      // Get settings for Image Describer node
      const imageDescriberSettings = nodeSettingsRef.current[nodeId] || {};
      const modelName = imageDescriberSettings.modelName || 'gemini-2.5-flash';
      const modelInstructions = imageDescriberSettings.modelInstructions || 'You are an expert image analyst tasked with providing detailed accurate and helpful descriptions of images. Your goal is to make visual content accessible through clear comprehensive text descriptions. Be objective and factual using clear descriptive language. Organize information from general to specific and include relevant context. Start with a brief overview of what the image shows then describe the main subjects and setting. Include visual details like colors lighting, textures, style, genre, contrast and composition. Transcribe any visible text accurately. Use specific concrete language and mention spatial relationships. For people focus on actions clothing and general appearance respectfully. For data visualizations explain the information presented. Write as if describing to someone who cannot see the image including important context for understanding. Balance thoroughness with clarity and provide descriptions in natural flowing narrative form. Your description shouldn\'t be longer than 500 characters';

      // Call backend API to describe image
      fetch('http://localhost:3001/api/describe-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          modelName: modelName,
          modelInstructions: modelInstructions,
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

    // Handle Video Generator nodes
    if (currentNode.type === 'videoGenerator') {
      const promptEdge = currentEdges.find((edge) => edge.target === nodeId && (!edge.targetHandle || edge.targetHandle === 'prompt'));
      
      if (!promptEdge) {
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
        alert('Please connect a Prompt node to the input before running the model.');
        return;
      }

      const promptSourceNode = currentNodes.find((node) => node.id === promptEdge.source);
      if (!promptSourceNode) {
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
        alert('Connected prompt node not found.');
        return;
      }

      let promptText = '';
      if (promptSourceNode.type === 'imageDescriber') {
        promptText = promptSourceNode.data?.description || '';
      } else if (promptSourceNode.type === 'promptInput') {
        promptText = promptSourceNode.data?.value || '';
      } else {
        promptText = promptSourceNode.data?.value || promptSourceNode.data?.description || '';
      }

      if (!promptText.trim()) {
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
        alert('The connected prompt is empty. Please enter some text first.');
        return;
      }

      const modelId = currentNode.data?.modelId || 'pixverse/pixverse-v4.5';
      // Read from ref directly - this is the source of truth
      const refSettings = nodeSettingsRef.current[nodeId];
      const settings = refSettings ? { ...refSettings } : {};
      
      console.log(`🎬 Video generation - Reading settings for node ${nodeId}`);
      console.log(`🔊 Ref has nodeId?`, !!refSettings);
      console.log(`🔊 Settings object:`, JSON.stringify(settings, null, 2));
      console.log(`🔊 enableSoundEffects value:`, settings.enableSoundEffects, `type:`, typeof settings.enableSoundEffects);
      console.log(`🔊 Full nodeSettingsRef.current:`, JSON.stringify(nodeSettingsRef.current, null, 2));
      
      // Ensure enableSoundEffects is explicitly set (not undefined)
      if (settings.enableSoundEffects === undefined) {
        console.warn(`⚠️ enableSoundEffects is undefined, defaulting to false`);
        settings.enableSoundEffects = false;
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

      // Call backend API to generate video
      fetch('http://localhost:3001/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: modelId,
          prompt: promptText,
          aspect_ratio: settings.aspectRatio || '16:9',
          duration: settings.duration || 5,
          quality: settings.quality || '720p',
          effect: settings.effect || 'None',
          negative_prompt: settings.negativePrompt || '',
          motion_mode: settings.motionMode || 'normal',
          seed: {
            seed: settings.seed || 597311,
            isRandom: settings.seedRandom !== false,
          },
          style: settings.style || 'None',
          sound_effect_switch: Boolean(settings.enableSoundEffects),
          // Only include sound_effect_content if it has a value
          ...(settings.enableSoundEffects && settings.soundEffectPrompt && settings.soundEffectPrompt.trim() 
            ? { sound_effect_content: settings.soundEffectPrompt.trim() } 
            : {}),
        }),
      })
        .then(async (response) => {
          const data = await response.json();

          if (!response.ok) {
            const errorMsg = data.message || data.error || 'Failed to generate video';
            throw new Error(errorMsg);
          }

          if (!data.videoUrl) {
            throw new Error('Server response missing video URL');
          }

          // Update node with generated video - append to array
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              if (node.id === nodeId) {
                const existingVideoUrls = node.data?.videoUrls || (node.data?.videoUrl ? [node.data.videoUrl] : []);
                const newVideoUrls = [...existingVideoUrls, data.videoUrl];
                return {
                  ...node,
                  data: {
                    ...node.data,
                    isGenerating: false,
                    videoUrl: data.videoUrl,
                    videoUrls: newVideoUrls,
                    currentVideoIndex: newVideoUrls.length - 1,
                  },
                };
              }
              return node;
            })
          );

          // Update task as completed
          setTasks((prev) =>
            prev.map((task) =>
              task.nodeId === nodeId && task.status === 'running'
                ? { ...task, completed: 1, status: 'completed' }
                : task
            )
          );

          // Remove ALL locks
          EXECUTION_IN_PROGRESS.delete(nodeId);
          GLOBAL_GENERATING_NODES.delete(nodeId);
          generatingNodes.current.delete(nodeId);
          LAST_CALL_TIMESTAMPS.delete(nodeId);
        })
        .catch((error) => {
          console.error('Error generating video:', error);
          
          // Update task as failed
          setTasks((prev) =>
            prev.map((task) =>
              task.nodeId === nodeId && task.status === 'running'
                ? { ...task, status: 'failed' }
                : task
            )
          );

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

          alert(`Failed to generate video:\n\n${error.message || 'Unknown error'}`);

          // Remove ALL locks after error
          EXECUTION_IN_PROGRESS.delete(nodeId);
          GLOBAL_GENERATING_NODES.delete(nodeId);
          generatingNodes.current.delete(nodeId);
          LAST_CALL_TIMESTAMPS.delete(nodeId);
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

        // Update node with generated image - append to array instead of replacing
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id === nodeId) {
              const existingImageUrls = node.data?.imageUrls || (node.data?.imageUrl ? [node.data.imageUrl] : []);
              const newImageUrls = [...existingImageUrls, data.imageUrl];
              return {
                ...node,
                data: {
                  ...node.data,
                  isGenerating: false,
                  imageUrl: data.imageUrl, // Keep for backward compatibility
                  imageUrls: newImageUrls, // Array of all generated images
                  currentImageIndex: newImageUrls.length - 1, // Show the newest image
                },
              };
            }
            return node;
          })
        );

        console.log(`✅ [${callId}] Image generated successfully:`, data.imageUrl);

        // Update task as completed
        setTasks((prev) =>
          prev.map((task) =>
            task.nodeId === nodeId && task.status === 'running'
              ? { ...task, completed: 1, status: 'completed' }
              : task
          )
        );

        // Remove ALL locks after successful generation
        EXECUTION_IN_PROGRESS.delete(nodeId);
        GLOBAL_GENERATING_NODES.delete(nodeId);
        generatingNodes.current.delete(nodeId);
        LAST_CALL_TIMESTAMPS.delete(nodeId);
      })
      .catch((error) => {
        console.error(`❌ [${callId}] Error generating image:`, error);
        console.error(`❌ [${callId}] Error stack:`, error.stack);

        // Update task as failed
        setTasks((prev) =>
          prev.map((task) =>
            task.nodeId === nodeId && task.status === 'running'
              ? { ...task, status: 'failed' }
              : task
          )
        );

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

  // Handle image index change for image generator nodes
  const handleImageIndexChange = useCallback((nodeId: string, index: number) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId && node.type === 'imageGenerator') {
          return {
            ...node,
            data: {
              ...node.data,
              currentImageIndex: index,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Handle remove current generation
  const handleRemoveCurrentGeneration = useCallback((nodeId: string) => {
    console.log(`🗑️ Removing current generation for node: ${nodeId}`);
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId && node.type === 'imageGenerator') {
          const imageUrls = node.data?.imageUrls || (node.data?.imageUrl ? [node.data.imageUrl] : []);
          const currentIndex = node.data?.currentImageIndex !== undefined 
            ? node.data.currentImageIndex 
            : (imageUrls.length > 0 ? imageUrls.length - 1 : 0);
          
          console.log(`📊 Current state - imageUrls: ${imageUrls.length}, currentIndex: ${currentIndex}`);
          
          if (imageUrls.length === 0 || currentIndex < 0 || currentIndex >= imageUrls.length) {
            console.log(`⚠️ Cannot remove - no images or invalid index`);
            return node;
          }
          
          // Remove the current image
          const newImageUrls = imageUrls.filter((_: string, index: number) => index !== currentIndex);
          
          // Update current index - if we removed the last image, go to the previous one
          let newCurrentIndex = currentIndex;
          if (newImageUrls.length === 0) {
            newCurrentIndex = 0;
          } else if (currentIndex >= newImageUrls.length) {
            newCurrentIndex = newImageUrls.length - 1;
          }
          
          console.log(`✅ Updated - new imageUrls: ${newImageUrls.length}, new currentIndex: ${newCurrentIndex}`);
          
          return {
            ...node,
            data: {
              ...node.data,
              imageUrls: newImageUrls,
              imageUrl: newImageUrls.length > 0 ? newImageUrls[newCurrentIndex] : undefined,
              currentImageIndex: newCurrentIndex,
            },
          };
        }
        return node;
      });
      return updatedNodes;
    });
  }, [setNodes]);

  // Handle remove all other generations
  const handleRemoveAllOtherGenerations = useCallback((nodeId: string) => {
    console.log(`🗑️ Removing all other generations for node: ${nodeId}`);
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId && node.type === 'imageGenerator') {
          const imageUrls = node.data?.imageUrls || (node.data?.imageUrl ? [node.data.imageUrl] : []);
          const currentIndex = node.data?.currentImageIndex !== undefined 
            ? node.data.currentImageIndex 
            : (imageUrls.length > 0 ? imageUrls.length - 1 : 0);
          
          console.log(`📊 Current state - imageUrls: ${imageUrls.length}, currentIndex: ${currentIndex}`);
          
          if (imageUrls.length === 0 || currentIndex < 0 || currentIndex >= imageUrls.length) {
            console.log(`⚠️ Cannot remove - no images or invalid index`);
            return node;
          }
          
          // Keep only the current image
          const currentImageUrl = imageUrls[currentIndex];
          
          console.log(`✅ Updated - keeping only current image at index ${currentIndex}`);
          
          return {
            ...node,
            data: {
              ...node.data,
              imageUrls: [currentImageUrl],
              imageUrl: currentImageUrl,
              currentImageIndex: 0,
            },
          };
        }
        return node;
      });
      return updatedNodes;
    });
  }, [setNodes]);

  // Handle remove all generations
  const handleRemoveAllGenerations = useCallback((nodeId: string) => {
    console.log(`🗑️ Removing all generations for node: ${nodeId}`);
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId && node.type === 'imageGenerator') {
          const imageUrls = node.data?.imageUrls || (node.data?.imageUrl ? [node.data.imageUrl] : []);
          console.log(`📊 Current state - imageUrls: ${imageUrls.length}`);
          
          if (imageUrls.length === 0) {
            console.log(`⚠️ No images to remove`);
            return node;
          }
          
          console.log(`✅ Removed all ${imageUrls.length} images`);
          
          return {
            ...node,
            data: {
              ...node.data,
              imageUrls: [],
              imageUrl: undefined,
              currentImageIndex: 0,
            },
          };
        }
        return node;
      });
      return updatedNodes;
    });
  }, [setNodes]);

  // Handle video index change for video generator nodes
  const handleVideoIndexChange = useCallback((nodeId: string, index: number) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId && node.type === 'videoGenerator') {
          return {
            ...node,
            data: {
              ...node.data,
              currentVideoIndex: index,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Handle remove current video generation
  const handleRemoveCurrentVideoGeneration = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId && node.type === 'videoGenerator') {
          const videoUrls = node.data?.videoUrls || (node.data?.videoUrl ? [node.data.videoUrl] : []);
          const currentIndex = node.data?.currentVideoIndex !== undefined 
            ? node.data.currentVideoIndex 
            : (videoUrls.length > 0 ? videoUrls.length - 1 : 0);
          
          if (videoUrls.length === 0 || currentIndex < 0 || currentIndex >= videoUrls.length) {
            return node;
          }
          
          const newVideoUrls = videoUrls.filter((_: string, index: number) => index !== currentIndex);
          let newCurrentIndex = currentIndex;
          if (newVideoUrls.length === 0) {
            newCurrentIndex = 0;
          } else if (currentIndex >= newVideoUrls.length) {
            newCurrentIndex = newVideoUrls.length - 1;
          }
          
          return {
            ...node,
            data: {
              ...node.data,
              videoUrls: newVideoUrls,
              videoUrl: newVideoUrls.length > 0 ? newVideoUrls[newCurrentIndex] : undefined,
              currentVideoIndex: newCurrentIndex,
            },
          };
        }
        return node;
      });
      return updatedNodes;
    });
  }, [setNodes]);

  // Handle remove all other video generations
  const handleRemoveAllOtherVideoGenerations = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId && node.type === 'videoGenerator') {
          const videoUrls = node.data?.videoUrls || (node.data?.videoUrl ? [node.data.videoUrl] : []);
          const currentIndex = node.data?.currentVideoIndex !== undefined 
            ? node.data.currentVideoIndex 
            : (videoUrls.length > 0 ? videoUrls.length - 1 : 0);
          
          if (videoUrls.length === 0 || currentIndex < 0 || currentIndex >= videoUrls.length) {
            return node;
          }
          
          const currentVideoUrl = videoUrls[currentIndex];
          
          return {
            ...node,
            data: {
              ...node.data,
              videoUrls: [currentVideoUrl],
              videoUrl: currentVideoUrl,
              currentVideoIndex: 0,
            },
          };
        }
        return node;
      });
      return updatedNodes;
    });
  }, [setNodes]);

  // Handle remove all video generations
  const handleRemoveAllVideoGenerations = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId && node.type === 'videoGenerator') {
          return {
            ...node,
            data: {
              ...node.data,
              videoUrls: [],
              videoUrl: undefined,
              currentVideoIndex: 0,
            },
          };
        }
        return node;
      });
      return updatedNodes;
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
          onRunModel: (nodeToDuplicate.type === 'imageGenerator' || nodeToDuplicate.type === 'videoGenerator') ? handleRunModel : undefined,
          onDelete: handleDeleteNode,
          onDuplicate: handleDuplicateNode,
          onImageIndexChange: nodeToDuplicate.type === 'imageGenerator' ? handleImageIndexChange : undefined,
          onVideoIndexChange: nodeToDuplicate.type === 'videoGenerator' ? handleVideoIndexChange : undefined,
          onOpenFullscreen: nodeToDuplicate.type === 'imageGenerator' ? handleOpenFullscreen : undefined,
          onRemoveCurrentGeneration: nodeToDuplicate.type === 'imageGenerator' ? handleRemoveCurrentGeneration : undefined,
          onRemoveAllOtherGenerations: nodeToDuplicate.type === 'imageGenerator' ? handleRemoveAllOtherGenerations : undefined,
          onRemoveAllGenerations: nodeToDuplicate.type === 'imageGenerator' ? handleRemoveAllGenerations : undefined,
          onRemoveCurrentVideoGeneration: nodeToDuplicate.type === 'videoGenerator' ? handleRemoveCurrentVideoGeneration : undefined,
          onRemoveAllOtherVideoGenerations: nodeToDuplicate.type === 'videoGenerator' ? handleRemoveAllOtherVideoGenerations : undefined,
          onRemoveAllVideoGenerations: nodeToDuplicate.type === 'videoGenerator' ? handleRemoveAllVideoGenerations : undefined,
        },
      };

      return nds.concat(newNode);
    });
  }, [setNodes, handleDeleteNode, handleRunModel, handleImageIndexChange, handleRemoveCurrentGeneration, handleRemoveAllOtherGenerations, handleRemoveAllGenerations, handleVideoIndexChange, handleRemoveCurrentVideoGeneration, handleRemoveAllOtherVideoGenerations, handleRemoveAllVideoGenerations]);

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
            imageUrls: [],
            currentImageIndex: 0,
            isGenerating: false,
            onRunModel: handleRunModel,
            onDelete: handleDeleteNode,
            onDuplicate: handleDuplicateNode,
            onImageIndexChange: handleImageIndexChange,
            onRemoveCurrentGeneration: handleRemoveCurrentGeneration,
            onRemoveAllOtherGenerations: handleRemoveAllOtherGenerations,
            onRemoveAllGenerations: handleRemoveAllGenerations,
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
            imageUrls: [],
            currentImageIndex: 0,
            isGenerating: false,
            onRunModel: handleRunModel,
            onDelete: handleDeleteNode,
            onDuplicate: handleDuplicateNode,
            onImageIndexChange: handleImageIndexChange,
            onRemoveCurrentGeneration: handleRemoveCurrentGeneration,
            onRemoveAllOtherGenerations: handleRemoveAllOtherGenerations,
            onRemoveAllGenerations: handleRemoveAllGenerations,
            onOpenFullscreen: handleOpenFullscreen,
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
      } else if (type === 'videoGenerator') {
        newNode = {
          id: newNodeId,
          type: 'videoGenerator',
          position,
          data: {
            label: 'Video Generator',
            modelName: 'Pixverse v4.5',
            modelId: 'pixverse/pixverse-v4.5',
            videoUrl: undefined,
            videoUrls: [],
            currentVideoIndex: 0,
            isGenerating: false,
            onRunModel: handleRunModel,
            onDelete: handleDeleteNode,
            onDuplicate: handleDuplicateNode,
            onVideoIndexChange: handleVideoIndexChange,
            onRemoveCurrentGeneration: handleRemoveCurrentVideoGeneration,
            onRemoveAllOtherGenerations: handleRemoveAllOtherVideoGenerations,
            onRemoveAllGenerations: handleRemoveAllVideoGenerations,
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
    [screenToFlowPosition, setNodes, handleDeleteNode, handleDuplicateNode, handleRunModel, handleImageIndexChange, handleRemoveCurrentGeneration, handleRemoveAllOtherGenerations, handleRemoveAllGenerations, handleVideoIndexChange, handleRemoveCurrentVideoGeneration, handleRemoveAllOtherVideoGenerations, handleRemoveAllVideoGenerations]
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

  // Update panel based on selection - show panel for all selected nodes, but only open if imageGenerator nodes exist
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
    
    // Check if there are any nodes with settings (imageGenerator, imageDescriber, or videoGenerator)
    const nodesWithSettings = selectedNodesList.filter(node => 
      node.type === 'imageGenerator' || node.type === 'imageDescriber' || node.type === 'videoGenerator'
    );
    
    // Store ALL selected nodes in panel
    console.log('🔍 Setting selectedNodes to', selectedNodesList.length, 'nodes (all types):', selectedNodesList.map(n => ({ id: n.id, type: n.type })));
    setSelectedNodes(selectedNodesList);
    
    // Only open panel if there are nodes with settings (imageGenerator or imageDescriber)
    if (nodesWithSettings.length > 0) {
      if (nodesWithSettings.length === 1 && selectedNodesList.length === 1) {
        // Single node with settings selection - show detailed settings panel
        console.log('🔍 Single node with settings selection, showing detailed panel');
        setSelectedNode(nodesWithSettings[0]);
        setIsSettingsPanelOpen(true);
      } else {
        // Multiple selection (or mixed selection) - show multi-selection panel with all nodes
        console.log('🔍 Multiple/mixed selection, showing multi-selection panel with all nodes');
        setSelectedNode(null);
        setIsSettingsPanelOpen(true);
      }
    } else {
      // No nodes with settings selected, close panel
      console.log('🔍 No nodes with settings selected, closing panel');
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
    console.log(`⚙️ Settings changed for node ${nodeId}:`, JSON.stringify(settings, null, 2));
    console.log(`🔊 enableSoundEffects value:`, settings.enableSoundEffects, typeof settings.enableSoundEffects);
    
    // Update ref immediately (synchronously) - this is the source of truth
    const currentRef = { ...nodeSettingsRef.current };
    currentRef[nodeId] = { ...settings }; // Create a new object to avoid reference issues
    nodeSettingsRef.current = currentRef;
    
    console.log(`✅ Ref updated immediately`);
    console.log(`🔊 Ref now contains for ${nodeId}:`, JSON.stringify(nodeSettingsRef.current[nodeId], null, 2));
    console.log(`🔊 enableSoundEffects in ref:`, nodeSettingsRef.current[nodeId]?.enableSoundEffects);
    
    // Also update state for UI reactivity (but ref is source of truth for API calls)
    setNodeSettings(currentRef);
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

  // Handle open fullscreen modal
  const handleOpenFullscreen = useCallback((nodeId: string) => {
    setFullscreenNodeId(nodeId);
  }, []);

  // Handle close fullscreen modal
  const handleCloseFullscreen = useCallback(() => {
    setFullscreenNodeId(null);
  }, []);

  // Helper function to sort nodes topologically based on flow connections
  const sortNodesByFlow = useCallback((nodeIds: string[]): string[] => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    
    // Build dependency graph: nodeId -> array of nodeIds that must run before it
    const dependencies = new Map<string, string[]>();
    const nodeSet = new Set(nodeIds);
    
    // Initialize all nodes with empty dependencies
    nodeIds.forEach(nodeId => {
      dependencies.set(nodeId, []);
    });
    
    // Find dependencies: if node A connects to node B, then A must run before B
    currentEdges.forEach(edge => {
      if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
        // Source node must run before target node
        const deps = dependencies.get(edge.target) || [];
        if (!deps.includes(edge.source)) {
          deps.push(edge.source);
        }
        dependencies.set(edge.target, deps);
      }
    });
    
    // Topological sort using Kahn's algorithm
    const sorted: string[] = [];
    const inDegree = new Map<string, number>();
    
    // Calculate in-degree for each node
    nodeIds.forEach(nodeId => {
      inDegree.set(nodeId, dependencies.get(nodeId)?.length || 0);
    });
    
    // Find nodes with no dependencies (in-degree = 0)
    const queue: string[] = [];
    nodeIds.forEach(nodeId => {
      if (inDegree.get(nodeId) === 0) {
        queue.push(nodeId);
      }
    });
    
    // Process nodes
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      sorted.push(nodeId);
      
      // Find all nodes that depend on this node
      currentEdges.forEach(edge => {
        if (edge.source === nodeId && nodeSet.has(edge.target)) {
          const targetInDegree = inDegree.get(edge.target)! - 1;
          inDegree.set(edge.target, targetInDegree);
          if (targetInDegree === 0) {
            queue.push(edge.target);
          }
        }
      });
    }
    
    // If we couldn't sort all nodes, return original order (might have cycles or disconnected nodes)
    if (sorted.length !== nodeIds.length) {
      console.warn('⚠️ Could not fully sort nodes topologically, using original order');
      return nodeIds;
    }
    
    return sorted;
  }, []);

  // Store tasks ref for async access
  const tasksRef = useRef<Task[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Promise-based wrapper for handleRunModel that waits for completion
  const runModelAsync = useCallback((nodeId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const currentNodes = nodesRef.current;
      const node = currentNodes.find(n => n.id === nodeId);
      
      if (!node) {
        reject(new Error(`Node ${nodeId} not found`));
        return;
      }
      
      // Check if node is already generating
      if (node.data?.isGenerating || GLOBAL_GENERATING_NODES.has(nodeId)) {
        reject(new Error(`Node ${nodeId} is already running`));
        return;
      }
      
      let taskCompleted = false;
      const startTime = Date.now();
      
      // Declare interval and timeout variables
      let pollInterval: NodeJS.Timeout;
      let timeout: NodeJS.Timeout;
      
      // Set up a listener for task completion
      const checkCompletion = () => {
        if (taskCompleted) return;
        
        const currentTasks = tasksRef.current;
        const nodeState = nodesRef.current.find(n => n.id === nodeId);
        
        // Check for completed task
        const completedTask = currentTasks.find(
          t => t.nodeId === nodeId && t.status === 'completed' && Date.now() - t.startTime.getTime() > 1000
        );
        
        if (completedTask) {
          taskCompleted = true;
          clearInterval(pollInterval);
          clearTimeout(timeout);
          resolve();
          return;
        }
        
        // Check for failed task
        const failedTask = currentTasks.find(
          t => t.nodeId === nodeId && t.status === 'failed'
        );
        
        if (failedTask) {
          taskCompleted = true;
          clearInterval(pollInterval);
          clearTimeout(timeout);
          reject(new Error(`Node ${nodeId} failed`));
          return;
        }
        
        // Also check if node is no longer generating (with some delay to ensure task is updated)
        if (nodeState && !nodeState.data?.isGenerating && !GLOBAL_GENERATING_NODES.has(nodeId)) {
          // Wait a bit to ensure task status is updated
          if (Date.now() - startTime > 2000) {
            taskCompleted = true;
            clearInterval(pollInterval);
            clearTimeout(timeout);
            resolve();
            return;
          }
        }
      };
      
      // Poll for completion every 300ms
      pollInterval = setInterval(checkCompletion, 300);
      
      // Timeout after 5 minutes
      timeout = setTimeout(() => {
        if (!taskCompleted) {
          taskCompleted = true;
          clearInterval(pollInterval);
          reject(new Error(`Node ${nodeId} timed out after 5 minutes`));
        }
      }, 5 * 60 * 1000);
      
      // Start the model
      try {
        handleRunModel(nodeId);
      } catch (error) {
        clearInterval(pollInterval);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }, [handleRunModel]);

  // Handle run all selected nodes sequentially based on flow
  const handleRunSelectedNodes = useCallback(
    async (nodeIds: string[], runs: number = 1) => {
      console.log(`🎛️ [Panel] handleRunSelectedNodes called for ${nodeIds.length} nodes with ${runs} runs:`, nodeIds);
      
      // Sort nodes based on flow connections (topological order)
      const sortedNodeIds = sortNodesByFlow(nodeIds);
      console.log(`📊 [Panel] Nodes sorted by flow:`, sortedNodeIds);
      
      // Run each set of runs sequentially
      for (let run = 0; run < runs; run++) {
        console.log(`🔄 [Panel] Starting run ${run + 1} of ${runs}`);
        
        // Run nodes sequentially in topological order
        for (let i = 0; i < sortedNodeIds.length; i++) {
          const nodeId = sortedNodeIds[i];
          console.log(`▶️ [Panel] Running node ${i + 1}/${sortedNodeIds.length}: ${nodeId}`);
          
          try {
            await runModelAsync(nodeId);
            console.log(`✅ [Panel] Node ${nodeId} completed`);
          } catch (error) {
            console.error(`❌ [Panel] Node ${nodeId} failed:`, error);
            // Continue with next node even if one fails
          }
          
          // Small delay between nodes
          if (i < sortedNodeIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        console.log(`✅ [Panel] Run ${run + 1} of ${runs} completed`);
        
        // Delay between runs
        if (run < runs - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log(`🎉 [Panel] All runs completed`);
    },
    [sortNodesByFlow, runModelAsync]
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
            
            // Migrate old imageUrl to imageUrls array
            const existingImageUrls = node.data?.imageUrls || [];
            const oldImageUrl = node.data?.imageUrl;
            let imageUrls = existingImageUrls;
            let currentImageIndex = node.data?.currentImageIndex;
            
            if (oldImageUrl && !existingImageUrls.includes(oldImageUrl)) {
              // If we have an old imageUrl that's not in the array, add it
              imageUrls = [oldImageUrl];
              currentImageIndex = 0;
            } else if (imageUrls.length > 0 && currentImageIndex === undefined) {
              // If we have images but no index, show the last one
              currentImageIndex = imageUrls.length - 1;
            } else if (imageUrls.length === 0) {
              currentImageIndex = 0;
            }
            
            return {
              ...node,
              data: {
                ...node.data,
                isGenerating: false, // Always reset generating state on page load
                modelId: modelId,
                modelName: modelName,
                imageUrls: imageUrls,
                currentImageIndex: currentImageIndex,
                onRunModel: handleRunModel,
                onDelete: handleDeleteNode,
                onDuplicate: handleDuplicateNode,
                onImageIndexChange: handleImageIndexChange,
                onRemoveCurrentGeneration: handleRemoveCurrentGeneration,
                onRemoveAllOtherGenerations: handleRemoveAllOtherGenerations,
                onRemoveAllGenerations: handleRemoveAllGenerations,
                onOpenFullscreen: handleOpenFullscreen,
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
          } else if (node.type === 'videoGenerator') {
            // Migrate old pixverse-v5 to pixverse-v4.5
            let modelId = node.data?.modelId || 'pixverse/pixverse-v4.5';
            let modelName = node.data?.modelName || 'Pixverse v4.5';
            
            if (modelId === 'pixverse/pixverse-v5') {
              console.log(`🔄 Migrating old Pixverse v5 node to v4.5: ${node.id}`);
              modelId = 'pixverse/pixverse-v4.5';
              modelName = 'Pixverse v4.5';
            }
            
            // Migrate old videoUrl to videoUrls array
            const existingVideoUrls = node.data?.videoUrls || [];
            const oldVideoUrl = node.data?.videoUrl;
            let videoUrls = existingVideoUrls;
            let currentVideoIndex = node.data?.currentVideoIndex;
            
            if (oldVideoUrl && !existingVideoUrls.includes(oldVideoUrl)) {
              videoUrls = [oldVideoUrl];
              currentVideoIndex = 0;
            } else if (videoUrls.length > 0 && currentVideoIndex === undefined) {
              currentVideoIndex = videoUrls.length - 1;
            } else if (videoUrls.length === 0) {
              currentVideoIndex = 0;
            }
            
            return {
              ...node,
              data: {
                ...node.data,
                modelId: modelId,
                modelName: modelName,
                isGenerating: false,
                videoUrls: videoUrls,
                videoUrl: videoUrls.length > 0 ? videoUrls[currentVideoIndex] : undefined,
                currentVideoIndex: currentVideoIndex,
                onRunModel: handleRunModel,
                onDelete: handleDeleteNode,
                onDuplicate: handleDuplicateNode,
                onVideoIndexChange: handleVideoIndexChange,
                onRemoveCurrentVideoGeneration: handleRemoveCurrentVideoGeneration,
                onRemoveAllOtherVideoGenerations: handleRemoveAllOtherVideoGenerations,
                onRemoveAllVideoGenerations: handleRemoveAllVideoGenerations,
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
  }, [isInitialized, handleDeleteNode, handleDuplicateNode, handleRunModel, handleImageIndexChange, handleRemoveCurrentGeneration, handleRemoveAllOtherGenerations, handleRemoveAllGenerations, handleVideoIndexChange, handleRemoveCurrentVideoGeneration, handleRemoveAllOtherVideoGenerations, handleRemoveAllVideoGenerations, handleOpenFullscreen, setNodes, setEdges]);

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
      <Sidebar onOpenPanel={handleOpenPanel} activePanelType={panelType} onClosePanel={handleClosePanel} />

      {/* Side Panel - Fixed Position */}
      <SidePanel
        isOpen={isPanelOpen}
        panelType={panelType}
        onClose={handleClosePanel}
        nodes={nodes}
        nodeSettingsMap={nodeSettings}
      />

      {/* Node Settings Panel - Right Side */}
      <NodeSettingsPanel
        isOpen={isSettingsPanelOpen}
        nodeId={selectedNode?.id || ''}
        nodeName={selectedNode?.type === 'imageDescriber' 
          ? 'Image Describer' 
          : selectedNode?.type === 'videoGenerator'
          ? selectedNode?.data?.modelName || 'Pixverse v4.5'
          : selectedNode?.data?.modelName || 'Seedream-4'}
        modelId={selectedNode?.data?.modelId || (selectedNode?.type === 'videoGenerator' ? 'pixverse/pixverse-v4.5' : 'bytedance/seedream-4')}
        creditCost={selectedNode?.type === 'imageGenerator' 
          ? (selectedNode?.data?.modelId === 'black-forest-labs/flux-1.1-pro-ultra' ? 11 : 23)
          : selectedNode?.type === 'imageDescriber' ? 1 
          : selectedNode?.type === 'videoGenerator' ? 50 : 0}
        initialSettings={selectedNode?.id ? nodeSettings[selectedNode.id] : undefined}
        selectedNodes={selectedNodes}
        nodeSettingsMap={nodeSettings}
        tasks={tasks}
        isTasksDropdownOpen={isTasksDropdownOpen}
        onTasksDropdownToggle={() => setIsTasksDropdownOpen(!isTasksDropdownOpen)}
        onClearTasks={() => setTasks([])}
        onRemoveTask={(taskId) => setTasks((prev) => prev.filter((t) => t.id !== taskId))}
        formatDateTime={formatDateTime}
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
      {/* ReactFlow Canvas */}
      <div className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
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

      {/* Project Name Input - Positioned at top left */}
      <div className="fixed top-6 left-[88px] z-40">
        <input
          type="text"
          defaultValue="untitled"
          className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-xl px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-[#3a3a3a] w-64 shadow-2xl"
          placeholder="Project name"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Right Side Panel - Credits, Status, Share, Tasks - Only show when settings panel is closed */}
      {!isSettingsPanelOpen && (
        <div className="fixed top-6 right-6 z-40">
          <div className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-xl p-2.5 shadow-2xl min-w-[240px]">
            {/* Top Section */}
            <div className="flex items-center justify-between mb-2.5">
              {/* Left: Credits and Status */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-xs">✨</span>
                  <span className="text-white text-xs">0.8</span>
                </div>
                <div className="bg-yellow-400/20 border border-yellow-400/30 rounded-sm px-2 py-0.5 flex relative">
                  <span className="text-yellow-400 text-[10px]">Low credits</span>
                </div>
              </div>
              {/* Right: Share and Logout Buttons */}
              <div className="flex items-center gap-2">
                <button className="bg-[#e5e5e5] hover:bg-white text-black px-2 py-0.5 rounded-sm text-xs transition-colors flex items-center gap-1.5">
                  <span className="text-xs">↗</span>
                  <span>Share</span>
                </button>
                <button 
                  onClick={async () => {
                    await signOut();
                    router.push('/login');
                  }}
                  className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white px-2 py-0.5 rounded-sm text-xs transition-colors flex items-center gap-1.5"
                  title={user?.email || 'Logout'}
                >
                  <span>Logout</span>
                </button>
              </div>
            </div>
            {/* Bottom Section: Tasks Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsTasksDropdownOpen(!isTasksDropdownOpen)}
                className="text-white text-xs flex items-center gap-1.5 hover:text-gray-300 transition-colors"
              >
                <span>Tasks</span>
                <svg className={`w-3 h-3 transition-transform ${isTasksDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Task Manager Dropdown */}
              {isTasksDropdownOpen && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsTasksDropdownOpen(false)}
                  />
                  {/* Dropdown Panel - Positioned to the left, same line */}
                  <div className="absolute top-1/2 -translate-y-1/2 right-full mr-4 bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-xl shadow-2xl w-[280px] z-40">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
                      <span className="text-white text-sm">Task manager</span>
                      <div className="flex items-center gap-3">
                        {tasks.length > 0 && (
                          <button
                            onClick={() => setTasks([])}
                            className="text-gray-400 hover:text-white transition-colors text-sm"
                          >
                            Clear all
                          </button>
                        )}
                        <button
                          onClick={() => setIsTasksDropdownOpen(false)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="px-4 py-4">
                      {tasks.length === 0 ? (
                        <span className="text-white text-sm">No active runs</span>
                      ) : (
                        <div className="space-y-3">
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 group relative"
                            >
                              {/* Icon - Checkmark for completed, Spinner for running */}
                              {task.status === 'completed' ? (
                                <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center flex-shrink-0">
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              ) : task.status === 'running' ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-red-400 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </div>
                              )}
                              {/* Date/Time and Progress */}
                              <div className="flex-1 flex items-center justify-between min-w-0">
                                <span className="text-white text-sm truncate">{formatDateTime(task.startTime)}</span>
                                <span className="text-white text-sm ml-2">{task.completed}/{task.total}</span>
                              </div>
                              {/* Clear button - shown on hover */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTasks((prev) => prev.filter((t) => t.id !== task.id));
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white ml-2 flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Bottom Toolbar */}
        <BottomToolbar
          zoom={zoom}
          onZoomChange={handleZoomChange}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToolChange={setActiveTool}
        />
      </div>

      {/* Fullscreen Modal */}
      {fullscreenNodeId && (() => {
        const fullscreenNode = nodes.find(n => n.id === fullscreenNodeId);
        if (!fullscreenNode || fullscreenNode.type !== 'imageGenerator') return null;
        
        return (
          <FullscreenModal
            nodeId={fullscreenNodeId}
            node={fullscreenNode}
            nodeSettings={nodeSettings[fullscreenNodeId] || {}}
            projectName="untitled"
            tasks={tasks}
            onClose={handleCloseFullscreen}
            onImageIndexChange={handleImageIndexChange}
            onRunModel={handleRunModel}
            onSettingsChange={handleSettingsChange}
          />
        );
      })()}
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
