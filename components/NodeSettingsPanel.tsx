'use client';

import React, { useState } from 'react';
import { X, Info, ChevronDown } from 'lucide-react';

interface NodeSettings {
  background: 'opaque' | 'transparent';
  numberOfImages: number;
  outputFormat: 'jpg' | 'png';
  quality: 'high' | 'medium' | 'low';
  size: '1024x1024' | '1536x1024' | '1024x1536';
}

interface NodeSettingsPanelProps {
  isOpen: boolean;
  nodeId: string;
  nodeName: string;
  creditCost: number;
  initialSettings?: NodeSettings;
  onClose: () => void;
  onSettingsChange?: (settings: NodeSettings) => void;
  onRunModel?: () => void;
}

const NodeSettingsPanel: React.FC<NodeSettingsPanelProps> = ({
  isOpen,
  nodeId,
  nodeName,
  creditCost,
  initialSettings,
  onClose,
  onSettingsChange,
  onRunModel,
}) => {
  const [settings, setSettings] = useState<NodeSettings>(
    initialSettings || {
      background: 'opaque',
      numberOfImages: 1,
      outputFormat: 'jpg',
      quality: 'high',
      size: '1024x1024',
    }
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
    value: NodeSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    if (onSettingsChange) {
      onSettingsChange(newSettings);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    handleSettingChange('numberOfImages', value);
  };

  const handleRunsChange = (delta: number) => {
    setRuns(Math.max(1, runs + delta));
  };

  if (!isOpen) return null;

  const totalCost = creditCost * runs;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Settings Panel */}
      <div className="fixed right-0 top-0 h-screen w-[340px] bg-[#0a0a0a] border-l border-[#2a2a2a] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
              <span className="text-base">🌀</span>
            </div>
            <span className="text-white font-medium text-sm">{nodeName}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-yellow-400">✨</span>
              <span className="text-gray-400">{creditCost}</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Background */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-300 font-medium">Background</label>
              <Info size={14} className="text-gray-500 cursor-help" />
            </div>
            <div className="relative">
              <select
                value={settings.background}
                onChange={(e) =>
                  handleSettingChange('background', e.target.value as 'opaque' | 'transparent')
                }
                className="w-full bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
              >
                <option value="opaque">opaque</option>
                <option value="transparent">transparent</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Number of Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-300 font-medium">Number of Images</label>
                <Info size={14} className="text-gray-500 cursor-help" />
              </div>
              <span className="text-white font-medium text-sm">{settings.numberOfImages}</span>
            </div>
            <input
              type="range"
              min="1"
              max="3"
              value={settings.numberOfImages}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((settings.numberOfImages - 1) / 2) * 100}%, #2a2a2a ${((settings.numberOfImages - 1) / 2) * 100}%, #2a2a2a 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
            </div>
          </div>

          {/* Output Format */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-300 font-medium">Output Format</label>
              <Info size={14} className="text-gray-500 cursor-help" />
            </div>
            <div className="relative">
              <select
                value={settings.outputFormat}
                onChange={(e) =>
                  handleSettingChange('outputFormat', e.target.value as 'jpg' | 'png')
                }
                className="w-full bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
              >
                <option value="jpg">jpg</option>
                <option value="png">png</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Quality */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-300 font-medium">Quality</label>
              <Info size={14} className="text-gray-500 cursor-help" />
            </div>
            <div className="relative">
              <select
                value={settings.quality}
                onChange={(e) =>
                  handleSettingChange('quality', e.target.value as 'high' | 'medium' | 'low')
                }
                className="w-full bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
              >
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Size */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-300 font-medium">Size</label>
              <Info size={14} className="text-gray-500 cursor-help" />
            </div>
            <div className="relative">
              <select
                value={settings.size}
                onChange={(e) =>
                  handleSettingChange(
                    'size',
                    e.target.value as '1024x1024' | '1536x1024' | '1024x1536'
                  )
                }
                className="w-full bg-[#1a1a1a] text-white text-sm border border-[#2a2a2a] rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-[#3a3a3a] appearance-none cursor-pointer"
              >
                <option value="1024x1024">1024 x 1024</option>
                <option value="1536x1024">1536 x 1024</option>
                <option value="1024x1536">1024 x 1536</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Run selected nodes button */}
          <button
            onClick={() => {
              console.log(`🎛️ [Panel] "Run selected nodes" button clicked for nodeId: ${nodeId}`);
              onRunModel && onRunModel();
            }}
            className="w-full bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300 text-sm font-medium py-2.5 rounded-lg border border-[#2a2a2a] transition-colors"
          >
            Run selected nodes
          </button>

          {/* Runs Counter */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-300 font-medium">Runs</label>
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
                <span className="text-white font-medium text-lg">{runs}</span>
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
            <span className="text-sm text-gray-400">Total cost</span>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400">✨</span>
              <span className="text-white font-medium">{totalCost} credits</span>
            </div>
          </div>
        </div>

        {/* Bottom Action Button */}
        <div className="px-6 py-4 border-t border-[#2a2a2a]">
          <button
            onClick={() => {
              console.log(`🎛️ [Panel] "Run selected" button (bottom) clicked for nodeId: ${nodeId}`);
              onRunModel && onRunModel();
            }}
            className="w-full bg-[#e5e5e5] hover:bg-white text-black font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>→</span>
            <span>Run selected</span>
          </button>
        </div>
      </div>

      {/* Custom slider styling */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #8b5cf6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #0a0a0a;
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
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
