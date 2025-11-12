'use client';

import React, { useState } from 'react';
import { X, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface NodeSettings {
  // Seedream-4 settings
  size?: '1K' | '2K' | '4K';
  width?: number;
  height?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21';
  maxImages?: number;
  enhancePrompt?: boolean;
  sequentialImageGeneration?: 'enabled' | 'disabled';
  // Flux settings
  promptUpsampling?: boolean;
  seed?: number;
  safetyTolerance?: number;
  raw?: boolean;
  outputFormat?: 'png' | 'jpeg';
}

interface Task {
  id: string;
  nodeId: string;
  nodeName: string;
  startTime: Date;
  completed: number;
  total: number;
  status: 'running' | 'completed' | 'failed';
}

interface NodeSettingsPanelProps {
  isOpen: boolean;
  nodeId?: string;
  nodeName?: string;
  modelId?: string;
  creditCost?: number;
  initialSettings?: NodeSettings;
  selectedNodes?: any[]; // Array of selected nodes for multi-selection
  nodeSettingsMap?: Record<string, NodeSettings>; // Settings for each node by nodeId
  tasks?: Task[]; // Tasks for task manager
  isTasksDropdownOpen?: boolean; // Task dropdown state
  onTasksDropdownToggle?: () => void; // Toggle task dropdown
  onClearTasks?: () => void; // Clear all tasks
  onRemoveTask?: (taskId: string) => void; // Remove a specific task
  formatDateTime?: (date: Date) => string; // Format date/time function
  onClose: () => void;
  onSettingsChange?: (nodeId: string, settings: NodeSettings) => void;
  onRunModel?: () => void;
  onRunSelectedNodes?: (nodeIds: string[], runs: number) => void; // For running multiple nodes with runs count
}

const NodeSettingsPanel: React.FC<NodeSettingsPanelProps> = ({
  isOpen,
  nodeId = '',
  nodeName = 'Seedream-4',
  modelId = 'bytedance/seedream-4',
  creditCost = 23,
  initialSettings,
  selectedNodes = [],
  nodeSettingsMap = {},
  tasks = [],
  isTasksDropdownOpen = false,
  onTasksDropdownToggle,
  onClearTasks,
  onRemoveTask,
  formatDateTime,
  onClose,
  onSettingsChange,
  onRunModel,
  onRunSelectedNodes,
}) => {
  const isFluxModel = modelId === 'black-forest-labs/flux-1.1-pro-ultra';
  const isMultiSelection = selectedNodes && selectedNodes.length > 1;
  
  // Track which node dropdowns are expanded - all closed by default
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Debug: Log when selectedNodes changes
  React.useEffect(() => {
    if (selectedNodes && selectedNodes.length > 0) {
      console.log('🔍 NodeSettingsPanel: selectedNodes changed to', selectedNodes.length, 'nodes:', selectedNodes.map(n => ({ id: n.id, type: n.type, modelId: n.data?.modelId })));
    }
  }, [selectedNodes]);
  
  const [settings, setSettings] = useState<NodeSettings>(
    initialSettings || (isFluxModel
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
        })
  );

  const [runs, setRuns] = useState(1);

  // Update settings when initialSettings change
  React.useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  const handleSettingChange = <K extends keyof NodeSettings>(
    key: K,
    value: NodeSettings[K],
    nodeId?: string
  ) => {
    if (nodeId && isMultiSelection) {
      // For multi-selection, update settings for specific node
      const nodeSettings = nodeSettingsMap[nodeId] || {};
      const newSettings = { ...nodeSettings, [key]: value };
      if (onSettingsChange) {
        onSettingsChange(nodeId, newSettings);
      }
    } else {
      // For single selection, update local settings
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    if (onSettingsChange) {
        onSettingsChange(nodeId || '', newSettings);
      }
    }
  };

  const toggleNodeExpanded = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleRunsChange = (delta: number) => {
    setRuns(Math.max(1, runs + delta));
  };

  // Calculate total cost for multiple selected nodes
  const calculateTotalCost = () => {
    if (isMultiSelection && selectedNodes) {
      const totalCostPerRun = selectedNodes.reduce((sum, node) => {
        // Get credit cost for each node type
        let nodeCost = 0; // Default (promptInput nodes have no cost)
        if (node.type === 'imageGenerator') {
          if (node.data?.modelId === 'black-forest-labs/flux-1.1-pro-ultra') {
            nodeCost = 11; // Flux cost
          } else {
            nodeCost = 23; // Seedream-4 cost
          }
        } else if (node.type === 'imageDescriber') {
          nodeCost = 1; // Image Describer cost
        }
        return sum + nodeCost;
      }, 0);
      return totalCostPerRun * runs;
    }
    return creditCost * runs;
  };

  const totalCost = calculateTotalCost();

  // Early return - don't render anything if panel is not open
  if (!isOpen) {
    return null;
  }

  return (
    <>
        {/* Settings Panel - No backdrop to allow canvas interactions */}
        <div className="fixed right-0 top-0 h-screen w-[240px] bg-[#0a0a0a] border-l border-[#2a2a2a] z-50 flex flex-col shadow-2xl" style={{ fontWeight: 200 }}>
        {/* Top Section - Credits, Status, Share, Tasks */}
        <div className="px-4 py-2.5 border-b border-[#2a2a2a]">
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
            {/* Right: Share Button */}
            <button className="bg-[#e5e5e5] hover:bg-white text-black px-2 py-0.5 rounded-sm text-xs transition-colors flex items-center gap-1.5">
              <span className="text-xs">↗</span>
              <span>Share</span>
            </button>
          </div>
          {/* Bottom Section: Tasks Dropdown */}
          <div className="relative">
            <button 
              onClick={onTasksDropdownToggle}
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
                  onClick={onTasksDropdownToggle}
                />
                {/* Dropdown Panel - Positioned to the left, same line */}
                <div className="absolute top-1/2 -translate-y-1/2 right-full mr-4 bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-xl shadow-2xl w-[280px] z-40">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
                    <span className="text-white text-sm">Task manager</span>
                    <div className="flex items-center gap-3">
                      {tasks.length > 0 && (
                        <button
                          onClick={onClearTasks}
                          className="text-gray-400 hover:text-white transition-colors text-sm"
                        >
                          Clear all
                        </button>
                      )}
                      <button
                        onClick={onTasksDropdownToggle}
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
                              <span className="text-white text-sm truncate">{formatDateTime ? formatDateTime(task.startTime) : task.startTime.toLocaleString()}</span>
                              <span className="text-white text-sm ml-2">{task.completed}/{task.total}</span>
                            </div>
                            {/* Clear button - shown on hover */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveTask?.(task.id);
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

        {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                <span className="text-xs">🌀</span>
              </div>
              <span className="text-white text-xs" style={{ fontWeight: 200 }}>{nodeName}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
              <span className="text-yellow-400">✨</span>
              <span className="text-gray-400">{creditCost}</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
                <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {isMultiSelection ? (
            /* Multi-Selection Mode - Collapsible Dropdowns */
            <>
              {selectedNodes.map((node) => {
                const isExpanded = expandedNodes.has(node.id);
                let nodeCost = 23;
                let nodeName = 'Node';
                let nodeModelId = '';
                
                if (node.type === 'imageGenerator') {
                  nodeModelId = node.data?.modelId || 'bytedance/seedream-4';
                  if (nodeModelId === 'black-forest-labs/flux-1.1-pro-ultra') {
                    nodeCost = 11;
                    nodeName = 'FLUX 1.1 Pro Ultra';
                  } else {
                    nodeCost = 23;
                    nodeName = node.data?.modelName || 'Seedream-4';
                  }
                } else if (node.type === 'imageDescriber') {
                  nodeCost = 1;
                  nodeName = 'Image Describer';
                } else if (node.type === 'promptInput') {
                  nodeCost = 0;
                  nodeName = node.data?.label || 'Prompt';
                }
                
                const nodeSettings = nodeSettingsMap[node.id] || {};
                const isNodeFlux = nodeModelId === 'black-forest-labs/flux-1.1-pro-ultra';
                
                return (
                  <div key={node.id} className="border border-[#2a2a2a] rounded-lg overflow-hidden">
                    {/* Collapsible Header */}
                    <button
                      onClick={() => toggleNodeExpanded(node.id)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-[#1a1a1a] hover:bg-[#242424] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white" style={{ fontWeight: 200 }}>{nodeName}</span>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-yellow-400">✨</span>
                          <span className="text-gray-400" style={{ fontWeight: 200 }}>{nodeCost}</span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={14} className="text-gray-400" />
                      )}
                    </button>
                    
                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div className="px-3 py-2.5 bg-[#0a0a0a] space-y-2.5">
                        {node.type === 'imageGenerator' && isNodeFlux ? (
                          /* Flux Settings - Full Settings */
                          <>
                            {/* Aspect Ratio */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Aspect Ratio</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <div className="relative">
                                <select
                                  value={nodeSettings.aspectRatio || '1:1'}
                                  onChange={(e) => handleSettingChange('aspectRatio', e.target.value as NodeSettings['aspectRatio'], node.id)}
                                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                                >
                                  <option value="1:1">1:1</option>
                                  <option value="16:9">16:9</option>
                                  <option value="9:16">9:16</option>
                                  <option value="4:3">4:3</option>
                                  <option value="3:4">3:4</option>
                                  <option value="21:9">21:9</option>
                                  <option value="9:21">9:21</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            {/* Output Format */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Output Format</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <div className="relative">
                                <select
                                  value={nodeSettings.outputFormat || 'png'}
                                  onChange={(e) => handleSettingChange('outputFormat', e.target.value as 'png' | 'jpeg', node.id)}
                                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                                >
                                  <option value="png">png</option>
                                  <option value="jpeg">jpeg</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            {/* Prompt Upsampling */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Prompt Upsampling</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <div className="relative">
                                <select
                                  value={nodeSettings.promptUpsampling !== false ? 'true' : 'false'}
                                  onChange={(e) => handleSettingChange('promptUpsampling', e.target.value === 'true', node.id)}
                                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                                >
                                  <option value="true">Enabled</option>
                                  <option value="false">Disabled</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            {/* Safety Tolerance */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Safety Tolerance</label>
                                  <Info size={10} className="text-gray-500 cursor-help" />
                                </div>
                                <span className="text-white text-[10px]" style={{ fontWeight: 200 }}>{nodeSettings.safetyTolerance || 2}</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="6"
                                value={nodeSettings.safetyTolerance || 2}
                                onChange={(e) => handleSettingChange('safetyTolerance', parseInt(e.target.value), node.id)}
                                className="w-full h-1 bg-[#2a2a2a] rounded appearance-none cursor-pointer slider"
                                style={{
                                  background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((nodeSettings.safetyTolerance || 2) / 6) * 100}%, #2a2a2a ${((nodeSettings.safetyTolerance || 2) / 6) * 100}%, #2a2a2a 100%)`,
                                }}
                              />
                              <div className="flex justify-between text-[9px] text-gray-500 mt-0.5" style={{ fontWeight: 200 }}>
                                <span>Strict (0)</span>
                                <span>Permissive (6)</span>
                              </div>
                            </div>
                            {/* Raw Mode */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Raw Mode</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <div className="relative">
                                <select
                                  value={nodeSettings.raw ? 'true' : 'false'}
                                  onChange={(e) => handleSettingChange('raw', e.target.value === 'true', node.id)}
                                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                                >
                                  <option value="false">Disabled</option>
                                  <option value="true">Enabled</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            {/* Seed */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Seed (Optional)</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <input
                                type="number"
                                value={nodeSettings.seed || ''}
                                onChange={(e) => handleSettingChange('seed', e.target.value ? parseInt(e.target.value) : undefined, node.id)}
                                placeholder="Leave empty for random"
                                className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 focus:outline-none focus:border-[#3a3a3a]"
                              />
                            </div>
                          </>
                        ) : node.type === 'imageGenerator' ? (
                          /* Seedream-4 Settings - Full Settings */
                          <>
                            {/* Size */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Size</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <div className="relative">
                                <select
                                  value={nodeSettings.size || '2K'}
                                  onChange={(e) => {
                                    const newSize = e.target.value as '1K' | '2K' | '4K';
                                    handleSettingChange('size', newSize, node.id);
                                    const sizeMap: Record<string, { width: number; height: number }> = {
                                      '1K': { width: 1024, height: 1024 },
                                      '2K': { width: 2048, height: 2048 },
                                      '4K': { width: 4096, height: 4096 },
                                    };
                                    if (sizeMap[newSize]) {
                                      handleSettingChange('width', sizeMap[newSize].width, node.id);
                                      handleSettingChange('height', sizeMap[newSize].height, node.id);
                                    }
                                  }}
                                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                                >
                                  <option value="1K">1K</option>
                                  <option value="2K">2K</option>
                                  <option value="4K">4K</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            {/* Width */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Width</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <input
                                type="number"
                                value={nodeSettings.width || 2048}
                                onChange={(e) => handleSettingChange('width', parseInt(e.target.value) || 2048, node.id)}
                                min="512"
                                max="8192"
                                step="256"
                                className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 focus:outline-none focus:border-[#3a3a3a]"
                              />
                            </div>
                            {/* Height */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Height</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <input
                                type="number"
                                value={nodeSettings.height || 2048}
                                onChange={(e) => handleSettingChange('height', parseInt(e.target.value) || 2048, node.id)}
                                min="512"
                                max="8192"
                                step="256"
                                className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 focus:outline-none focus:border-[#3a3a3a]"
                              />
                            </div>
                            {/* Aspect Ratio */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Aspect Ratio</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <div className="relative">
                                <select
                                  value={nodeSettings.aspectRatio || '4:3'}
                                  onChange={(e) => handleSettingChange('aspectRatio', e.target.value as NodeSettings['aspectRatio'], node.id)}
                                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                                >
                                  <option value="1:1">1:1</option>
                                  <option value="4:3">4:3</option>
                                  <option value="3:4">3:4</option>
                                  <option value="16:9">16:9</option>
                                  <option value="9:16">9:16</option>
                                  <option value="21:9">21:9</option>
                                  <option value="9:21">9:21</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            {/* Max Images */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Max Images</label>
                                  <Info size={10} className="text-gray-500 cursor-help" />
                                </div>
                                <span className="text-white text-[10px]" style={{ fontWeight: 200 }}>{nodeSettings.maxImages || 1}</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="4"
                                value={nodeSettings.maxImages || 1}
                                onChange={(e) => handleSettingChange('maxImages', parseInt(e.target.value), node.id)}
                                className="w-full h-1 bg-[#2a2a2a] rounded appearance-none cursor-pointer slider"
                                style={{
                                  background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(((nodeSettings.maxImages || 1) - 1) / 3) * 100}%, #2a2a2a ${(((nodeSettings.maxImages || 1) - 1) / 3) * 100}%, #2a2a2a 100%)`,
                                }}
                              />
                              <div className="flex justify-between text-[9px] text-gray-500 mt-0.5" style={{ fontWeight: 200 }}>
                                <span>1</span>
                                <span>2</span>
                                <span>3</span>
                                <span>4</span>
                              </div>
                            </div>
                            {/* Enhance Prompt */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Enhance Prompt</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <div className="relative">
                                <select
                                  value={nodeSettings.enhancePrompt !== false ? 'true' : 'false'}
                                  onChange={(e) => handleSettingChange('enhancePrompt', e.target.value === 'true', node.id)}
                                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                                >
                                  <option value="true">Enabled</option>
                                  <option value="false">Disabled</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                            {/* Sequential Image Generation */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Sequential Image Generation</label>
                                <Info size={10} className="text-gray-500 cursor-help" />
                              </div>
                              <div className="relative">
                                <select
                                  value={nodeSettings.sequentialImageGeneration || 'disabled'}
                                  onChange={(e) => handleSettingChange('sequentialImageGeneration', e.target.value as 'enabled' | 'disabled', node.id)}
                                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                                >
                                  <option value="disabled">Disabled</option>
                                  <option value="enabled">Enabled</option>
                                </select>
                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                          </>
                        ) : node.type === 'promptInput' ? (
                          /* Prompt Input Node - Show content */
                          <div className="text-[10px] text-gray-400">
                            <div className="mb-1.5">
                              <span className="text-gray-300" style={{ fontWeight: 200 }}>Content:</span>
                            </div>
                            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-1.5 text-gray-400 max-h-24 overflow-y-auto" style={{ fontWeight: 200 }}>
                              {node.data?.value || 'No content'}
                            </div>
                          </div>
                        ) : node.type === 'imageDescriber' ? (
                          /* Image Describer Node - Show description */
                          <div className="text-[10px] text-gray-400">
                            <div className="mb-1.5">
                              <span className="text-gray-300" style={{ fontWeight: 200 }}>Description:</span>
                            </div>
                            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-1.5 text-gray-400 max-h-24 overflow-y-auto" style={{ fontWeight: 200 }}>
                              {node.data?.description || 'No description generated yet'}
                            </div>
                          </div>
                        ) : (
                          /* Other node types - no settings for now */
                          <div className="text-[10px] text-gray-400" style={{ fontWeight: 200 }}>No settings available for this node type</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : isFluxModel ? (
            <>
              {/* Aspect Ratio - Flux */}
          <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Aspect Ratio</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
            </div>
            <div className="relative">
              <select
                    value={settings.aspectRatio || '1:1'}
                onChange={(e) =>
                      handleSettingChange('aspectRatio', e.target.value as NodeSettings['aspectRatio'])
                }
                    className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
              >
                    <option value="1:1">1:1 (Square)</option>
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                    <option value="4:3">4:3 (Standard)</option>
                    <option value="3:4">3:4 (Portrait Standard)</option>
                    <option value="21:9">21:9 (Ultra Wide)</option>
                    <option value="9:21">9:21 (Ultra Tall)</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

              {/* Output Format - Flux */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Output Format</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
                </div>
                <div className="relative">
                  <select
                    value={settings.outputFormat || 'png'}
                    onChange={(e) =>
                      handleSettingChange('outputFormat', e.target.value as 'png' | 'jpeg')
                    }
                    className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                  >
                    <option value="png">png</option>
                    <option value="jpeg">jpeg</option>
                  </select>
                  <ChevronDown
                    size={10}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Prompt Upsampling - Flux */}
          <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Prompt Upsampling</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
                </div>
                <div className="relative">
                  <select
                    value={settings.promptUpsampling ? 'true' : 'false'}
                    onChange={(e) =>
                      handleSettingChange('promptUpsampling', e.target.value === 'true')
                    }
                    className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                  <ChevronDown
                    size={10}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Safety Tolerance - Flux */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Safety Tolerance</label>
                    <Info size={10} className="text-gray-500 cursor-help" />
                  </div>
                  <span className="text-white text-[10px]" style={{ fontWeight: 200 }}>{settings.safetyTolerance || 2}</span>
            </div>
            <input
              type="range"
                  min="0"
                  max="6"
                  value={settings.safetyTolerance || 2}
                  onChange={(e) =>
                    handleSettingChange('safetyTolerance', parseInt(e.target.value))
                  }
                  className="w-full h-1 bg-[#2a2a2a] rounded appearance-none cursor-pointer slider"
              style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((settings.safetyTolerance || 2) / 6) * 100}%, #2a2a2a ${((settings.safetyTolerance || 2) / 6) * 100}%, #2a2a2a 100%)`,
              }}
            />
                <div className="flex justify-between text-[9px] text-gray-500 mt-0.5" style={{ fontWeight: 200 }}>
                  <span>Strict (0)</span>
                  <span>Permissive (6)</span>
            </div>
          </div>

              {/* Raw Mode - Flux */}
          <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Raw Mode</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
            </div>
            <div className="relative">
              <select
                    value={settings.raw ? 'true' : 'false'}
                    onChange={(e) =>
                      handleSettingChange('raw', e.target.value === 'true')
                    }
                    className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                  >
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                  <ChevronDown
                    size={10}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Seed - Flux (Optional) */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Seed (Optional)</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
                </div>
                <input
                  type="number"
                  value={settings.seed || ''}
                onChange={(e) =>
                    handleSettingChange('seed', e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="Leave empty for random"
                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>
            </>
          ) : (
            <>
              {/* Size - Seedream-4 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Size</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
                </div>
                <div className="relative">
                  <select
                    value={settings.size || '2K'}
                    onChange={(e) => {
                      const newSize = e.target.value as '1K' | '2K' | '4K';
                      handleSettingChange('size', newSize);
                      // Auto-update width/height based on size
                      const sizeMap: Record<string, { width: number; height: number }> = {
                        '1K': { width: 1024, height: 1024 },
                        '2K': { width: 2048, height: 2048 },
                        '4K': { width: 4096, height: 4096 },
                      };
                      if (sizeMap[newSize]) {
                        handleSettingChange('width', sizeMap[newSize].width);
                        handleSettingChange('height', sizeMap[newSize].height);
                      }
                    }}
                    className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
              >
                    <option value="1K">1K (1024x1024)</option>
                    <option value="2K">2K (2048x2048)</option>
                    <option value="4K">4K (4096x4096)</option>
              </select>
              <ChevronDown
                    size={10}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

              {/* Width - Seedream-4 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Width</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
                </div>
                <input
                  type="number"
                  value={settings.width || 2048}
                  onChange={(e) =>
                    handleSettingChange('width', parseInt(e.target.value) || 2048)
                  }
                  min="512"
                  max="8192"
                  step="256"
                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>

              {/* Height - Seedream-4 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Height</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
                </div>
                <input
                  type="number"
                  value={settings.height || 2048}
                  onChange={(e) =>
                    handleSettingChange('height', parseInt(e.target.value) || 2048)
                  }
                  min="512"
                  max="8192"
                  step="256"
                  className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>

              {/* Aspect Ratio - Seedream-4 */}
          <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Aspect Ratio</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
            </div>
            <div className="relative">
              <select
                    value={settings.aspectRatio || '4:3'}
                onChange={(e) =>
                      handleSettingChange('aspectRatio', e.target.value as NodeSettings['aspectRatio'])
                }
                    className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
              >
                    <option value="1:1">1:1 (Square)</option>
                    <option value="4:3">4:3 (Standard)</option>
                    <option value="3:4">3:4 (Portrait Standard)</option>
                    <option value="16:9">16:9 (Widescreen)</option>
                    <option value="9:16">9:16 (Portrait Widescreen)</option>
                    <option value="21:9">21:9 (Ultra Wide)</option>
                    <option value="9:21">9:21 (Ultra Tall)</option>
              </select>
              <ChevronDown
                    size={10}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

              {/* Max Images - Seedream-4 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Max Images</label>
                    <Info size={10} className="text-gray-500 cursor-help" />
                  </div>
                  <span className="text-white text-[10px]" style={{ fontWeight: 200 }}>{settings.maxImages || 1}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={settings.maxImages || 1}
                  onChange={(e) =>
                    handleSettingChange('maxImages', parseInt(e.target.value))
                  }
                  className="w-full h-1 bg-[#2a2a2a] rounded appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(((settings.maxImages || 1) - 1) / 3) * 100}%, #2a2a2a ${(((settings.maxImages || 1) - 1) / 3) * 100}%, #2a2a2a 100%)`,
                  }}
                />
                <div className="flex justify-between text-[9px] text-gray-500 mt-0.5" style={{ fontWeight: 200 }}>
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                </div>
              </div>

              {/* Enhance Prompt - Seedream-4 */}
          <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Enhance Prompt</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
            </div>
            <div className="relative">
              <select
                    value={settings.enhancePrompt !== false ? 'true' : 'false'}
                onChange={(e) =>
                      handleSettingChange('enhancePrompt', e.target.value === 'true')
                }
                    className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
              >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
              </select>
              <ChevronDown
                    size={10}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

              {/* Sequential Image Generation - Seedream-4 */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Sequential Image Generation</label>
                  <Info size={10} className="text-gray-500 cursor-help" />
                </div>
                <div className="relative">
                  <select
                    value={settings.sequentialImageGeneration || 'disabled'}
                    onChange={(e) =>
                      handleSettingChange('sequentialImageGeneration', e.target.value as 'enabled' | 'disabled')
                    }
                    className="w-full bg-[#1a1a1a] text-white text-[10px] border border-[#2a2a2a] rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
                  >
                    <option value="disabled">Disabled</option>
                    <option value="enabled">Enabled</option>
                  </select>
                  <ChevronDown
                    size={10}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Run selected nodes section - Show for both single and multi-selection */}
          <div className="pt-3 border-t border-[#2a2a2a]">
            <h3 className="text-sm text-white mb-3" style={{ fontWeight: 200 }}>
              {isMultiSelection ? 'Run selected nodes' : 'Run selected node'}
            </h3>

          {/* Runs Counter */}
            <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
                <label className="text-[10px] text-gray-300" style={{ fontWeight: 200 }}>Runs</label>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleRunsChange(-1)}
                disabled={runs <= 1}
                className="w-10 h-10 bg-[#1a1a1a] hover:bg-[#2a2a2a] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg border border-[#2a2a2a] transition-colors flex items-center justify-center text-lg"
              >
                −
              </button>
              <div className="flex-1 text-center">
                 <span className="text-white text-lg" style={{ fontWeight: 200 }}>{runs}</span>
              </div>
              <button
                onClick={() => handleRunsChange(1)}
                className="w-10 h-10 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-lg border border-[#2a2a2a] transition-colors flex items-center justify-center text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2a]">
            <span className="text-sm text-gray-400" style={{ fontWeight: 200 }}>Total cost</span>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400">✨</span>
               <span className="text-white" style={{ fontWeight: 200 }}>{totalCost} credits</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Button */}
        <div className="px-6 py-4 border-t border-[#2a2a2a]">
          <button
            onClick={() => {
              if (isMultiSelection && onRunSelectedNodes) {
                const nodeIds = selectedNodes.map(node => node.id);
                console.log(`🎛️ [Panel] "Run selected" button clicked for ${nodeIds.length} nodes with ${runs} runs:`, nodeIds);
                onRunSelectedNodes(nodeIds, runs);
              } else if (onRunModel) {
                // For single node, run it the specified number of times
                if (runs > 1 && onRunSelectedNodes) {
                  console.log(`🎛️ [Panel] "Run selected" button clicked for single node with ${runs} runs:`, nodeId);
                  onRunSelectedNodes([nodeId], runs);
                } else {
              console.log(`🎛️ [Panel] "Run selected" button (bottom) clicked for nodeId: ${nodeId}`);
                  onRunModel();
                }
              }
            }}
            disabled={isMultiSelection && totalCost === 0}
            className={`w-full py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              isMultiSelection && totalCost === 0
                ? 'bg-[#2a2a2a] text-gray-500 cursor-not-allowed'
                : 'bg-[#e5e5e5] hover:bg-white text-black'
            }`}
          >
            <span>→</span>
            <span>{isMultiSelection ? 'Run selected' : 'Run selected'}</span>
          </button>
        </div>
      </div>

      {/* Custom slider styling */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          background: #8b5cf6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #0a0a0a;
        }

        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          background: #8b5cf6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #0a0a0a;
        }
      `}</style>
    </>
  );
};

export default NodeSettingsPanel;
