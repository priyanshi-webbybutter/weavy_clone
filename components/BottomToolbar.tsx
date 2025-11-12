'use client';

import React, { useState } from 'react';
import { MousePointer2, Hand, Undo2, Redo2, ChevronDown } from 'lucide-react';

interface BottomToolbarProps {
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToolChange?: (tool: 'pointer' | 'hand') => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({
  zoom = 100,
  onZoomChange,
  onUndo,
  onRedo,
  onToolChange,
}) => {
  const [activeTool, setActiveTool] = useState<'pointer' | 'hand'>('pointer');
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const zoomLevels = [25, 50, 75, 100, 125, 150, 200];

  const handleToolClick = (tool: 'pointer' | 'hand') => {
    setActiveTool(tool);
    onToolChange?.(tool);
  };

  const handleZoomSelect = (level: number) => {
    onZoomChange?.(level);
    setIsZoomOpen(false);
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        handleToolClick('pointer');
      } else if (e.key === 'h' || e.key === 'H') {
        handleToolClick('hand');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="flex items-center gap-1 bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-xl px-3 py-2 shadow-2xl">
        {/* Pointer Tool */}
        <button
          onClick={() => handleToolClick('pointer')}
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            transition-all duration-200
            ${
              activeTool === 'pointer'
                ? 'bg-yellow-400 text-black'
                : 'text-gray-400 hover:text-white hover:bg-[#242424]'
            }
          `}
          title="Select (V)"
        >
          <MousePointer2 className="w-5 h-5" />
        </button>

        {/* Hand Tool */}
        <button
          onClick={() => handleToolClick('hand')}
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            transition-all duration-200
            ${
              activeTool === 'hand'
                ? 'bg-yellow-400 text-black'
                : 'text-gray-400 hover:text-white hover:bg-[#242424]'
            }
          `}
          title="Pan (H)"
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-[#2a2a2a] mx-2" />

        {/* Undo */}
        <button
          onClick={onUndo}
          className="
            w-10 h-10 flex items-center justify-center rounded-lg
            text-gray-400 hover:text-white hover:bg-[#242424]
            transition-all duration-200
          "
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5" />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          className="
            w-10 h-10 flex items-center justify-center rounded-lg
            text-gray-400 hover:text-white hover:bg-[#242424]
            transition-all duration-200
          "
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-[#2a2a2a] mx-2" />

        {/* Zoom Control */}
        <div className="relative">
          <button
            onClick={() => setIsZoomOpen(!isZoomOpen)}
            className="
              flex items-center gap-2 px-3 h-10 rounded-lg
              text-gray-300 hover:text-white hover:bg-[#242424]
              transition-all duration-200 min-w-[80px]
            "
            title="Zoom"
          >
            <span className="text-sm font-medium">{Math.round(zoom)}%</span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Zoom Dropdown */}
          {isZoomOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsZoomOpen(false)}
              />
              {/* Dropdown Menu */}
              <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden z-50">
                {zoomLevels.map((level) => (
                  <button
                    key={level}
                    onClick={() => handleZoomSelect(level)}
                    className={`
                      w-full px-4 py-2 text-left text-sm
                      transition-colors duration-150
                      ${
                        Math.round(zoom) === level
                          ? 'bg-[#2a2a2a] text-white'
                          : 'text-gray-400 hover:text-white hover:bg-[#242424]'
                      }
                    `}
                  >
                    {level}%
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottomToolbar;
