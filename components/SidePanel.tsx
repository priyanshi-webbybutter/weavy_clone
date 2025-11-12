'use client';

import React, { useState } from 'react';
import {
  FileText,
  Download,
  Upload,
  Eye,
  DownloadCloud,
  ChevronDown,
} from 'lucide-react';

interface SidePanelProps {
  isOpen: boolean;
  panelType: string | null;
  onClose: () => void;
}

const SidePanel: React.FC<SidePanelProps> = ({ isOpen, panelType, onClose }) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  const renderQuickAccess = () => (
    <div>
      <h2 className="text-base font-semibold text-white mb-4">Quick access</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          draggable
          onDragStart={(event) => onDragStart(event, 'promptInput')}
          onDragEnd={onDragEnd}
          className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group cursor-grab active:cursor-grabbing"
        >
          <div className="w-8 h-8 mb-2 flex items-center justify-center">
            <div className="text-lg text-white font-semibold">T</div>
          </div>
          <span className="text-xs text-gray-300">Prompt</span>
        </button>
        <button className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group">
          <Download className="w-6 h-6 text-gray-400 mb-2 group-hover:text-white transition-colors" />
          <span className="text-xs text-gray-300">Import</span>
        </button>
        <button className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group">
          <Upload className="w-6 h-6 text-gray-400 mb-2 group-hover:text-white transition-colors" />
          <span className="text-xs text-gray-300">Export</span>
        </button>
        <button className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group">
          <Eye className="w-6 h-6 text-gray-400 mb-2 group-hover:text-white transition-colors" />
          <span className="text-xs text-gray-300">Preview</span>
        </button>
        <button className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group">
          <DownloadCloud className="w-6 h-6 text-gray-400 mb-2 group-hover:text-white transition-colors" />
          <span className="text-xs text-gray-300">Import Model</span>
        </button>
        <button className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group">
          <DownloadCloud className="w-6 h-6 text-gray-400 mb-2 group-hover:text-white transition-colors" />
          <span className="text-xs text-gray-300">Import LoRA</span>
        </button>
      </div>
    </div>
  );

  const renderImageModels = () => (
    <div>
      <h2 className="text-base font-semibold text-white mb-1">Image Models</h2>
      <p className="text-xs text-gray-400 mb-4">Generate from text</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          draggable
          onDragStart={(event) => onDragStart(event, 'imageGenerator')}
          onDragEnd={onDragEnd}
          className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group cursor-grab active:cursor-grabbing"
        >
          <div className="w-8 h-8 mb-2 flex items-center justify-center">
            <div className="text-lg text-blue-400">S</div>
          </div>
          <span className="text-xs text-gray-300">Seedream-4</span>
        </button>
        <button
          draggable
          onDragStart={(event) => onDragStart(event, 'fluxGenerator')}
          onDragEnd={onDragEnd}
          className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group cursor-grab active:cursor-grabbing"
        >
          <div className="w-8 h-8 mb-2 flex items-center justify-center">
            <div className="text-lg text-purple-400">F</div>
          </div>
          <span className="text-xs text-gray-300">FLUX 1.1 Pro Ultra</span>
        </button>
      </div>
    </div>
  );

  const renderTools = () => (
    <div>
      {/* Text tools subsection */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Text tools</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            draggable
            onDragStart={(event) => onDragStart(event, 'promptInput')}
            onDragEnd={onDragEnd}
            className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group cursor-grab active:cursor-grabbing"
          >
            <div className="w-8 h-8 mb-2 flex items-center justify-center">
              <div className="text-lg text-white font-semibold">T</div>
            </div>
            <span className="text-xs text-gray-300">Prompt</span>
          </button>
          <button
            draggable
            onDragStart={(event) => onDragStart(event, 'imageDescriber')}
            onDragEnd={onDragEnd}
            className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group cursor-grab active:cursor-grabbing"
          >
            <div className="w-8 h-8 mb-2 flex items-center justify-center">
              <div className="text-lg text-green-400">D</div>
            </div>
            <span className="text-xs text-gray-300">Image Describer</span>
          </button>
        </div>
      </div>

      {/* Future subsections can be added here */}
      {/* Example structure for future additions:
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Editing</h2>
        <div className="grid grid-cols-2 gap-3">
          // Tools here
        </div>
      </div>
      */}
    </div>
  );

  const renderComingSoon = () => (
    <div className="flex flex-col items-center justify-center h-48">
      <div className="text-4xl mb-3">🚀</div>
      <h2 className="text-lg font-semibold text-white mb-1">Coming Soon</h2>
      <p className="text-xs text-gray-400 text-center px-4">
        This feature is under development and will be available soon.
      </p>
    </div>
  );

  const renderContent = () => {
    if (!panelType) return null;

    switch (panelType) {
      case 'Recent':
        return renderQuickAccess();
      case 'Image Generation':
        return renderImageModels();
      case 'Tools':
        return renderTools();
      default:
        return renderComingSoon();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - only covers the area outside sidebar and panel */}
      <div
        className={`fixed left-[300px] top-0 right-0 bottom-0 bg-black/30 z-40 ${isDragging ? 'pointer-events-none' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed left-[68px] top-0 h-screen w-[235px] bg-[#171717] border-r border-[#2a2a2a] z-50 overflow-hidden animate-slide-in shadow-2xl"
      >
        <div className="h-full overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-[#171717] border-b border-[#2a2a2a] px-5 py-3 z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-medium text-xs">My First Weavy</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-5 py-2.5">
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg
                  className="w-3.5 h-3.5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search"
                className="w-full bg-[#1f1f1f] text-gray-300 placeholder-gray-500 rounded-md pl-8 pr-3 py-1.5 text-xs border border-[#2a2a2a] focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default SidePanel;
