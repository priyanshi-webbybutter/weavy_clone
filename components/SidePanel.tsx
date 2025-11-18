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
  nodes?: any[]; // Canvas nodes to extract images from
  nodeSettingsMap?: Record<string, any>; // Node settings to get dimensions
}

const SidePanel: React.FC<SidePanelProps> = ({ isOpen, panelType, onClose, nodes = [], nodeSettingsMap = {} }) => {
  const [isDragging, setIsDragging] = useState(false);
  
  // Extract all images from image generator nodes
  const getAllImages = () => {
    const images: Array<{ url: string; dimensions?: string; nodeId: string }> = [];
    
    nodes.forEach((node) => {
      if (node.type === 'imageGenerator') {
        // Get images from imageUrls array or fallback to imageUrl
        const imageUrls = node.data?.imageUrls || (node.data?.imageUrl ? [node.data.imageUrl] : []);
        
        // Get node settings for dimensions
        const settings = nodeSettingsMap[node.id] || {};
        const width = settings.width || 1024;
        const height = settings.height || 1024;
        const dimensions = `${width} X ${height}`;
        
        imageUrls.forEach((url: string) => {
          if (url) {
            images.push({
              url,
              dimensions,
              nodeId: node.id,
            });
          }
        });
      }
    });
    
    return images;
  };

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

  const renderImageModels = () => {
    const categories = [
      {
        key: 'text',
        title: 'Generate from Text'
      },
      {
        key: 'image',
        title: 'Generate from Image'
      },
      {
        key: 'edit',
        title: 'Edit images'
      },
    ];

    const models = [
      {
        id: 'seedream-4',
        label: 'Seedream-4',
        badge: 'S',
        badgeColor: 'text-blue-400',
        nodeType: 'imageGenerator',
        category: 'text',
      },
      {
        id: 'flux-11-pro',
        label: 'FLUX 1.1 Pro Ultra',
        badge: 'F',
        badgeColor: 'text-purple-400',
        nodeType: 'fluxGenerator',
        category: 'text',
      },
      {
        id: 'flux-redux-dev',
        label: 'FLUX.1 Redux [dev]',
        badge: 'R',
        badgeColor: 'text-amber-400',
        nodeType: 'fluxReduxGenerator',
        category: 'image',
      },
      {
        id: 'flux-canny-pro',
        label: 'FLUX Canny Pro',
        badge: 'C',
        badgeColor: 'text-cyan-400',
        nodeType: 'fluxCannyGenerator',
        category: 'image',
      },
      {
        id: 'reve-edit',
        label: 'Reve Edit',
        badge: 'E',
        badgeColor: 'text-green-400',
        nodeType: 'reveEditGenerator',
        category: 'edit',
      },
    ];

    const modelsByCategory = categories.reduce<Record<string, typeof models>>((acc, category) => {
      acc[category.key] = models.filter((model) => model.category === category.key);
      return acc;
    }, {});

    return (
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Image Models</h2>
        {categories.map((category) => {
          const categoryModels = modelsByCategory[category.key] || [];

          return (
            <div key={category.key} className="mb-6 last:mb-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white">{category.title}</h3>
                {categoryModels.length > 0 && (
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                    {categoryModels.length} models
                  </span>
                )}
              </div>

              {categoryModels.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {categoryModels.map((model) => (
                    <button
                      key={model.id}
                      draggable
                      onDragStart={(event) => onDragStart(event, model.nodeType)}
                      onDragEnd={onDragEnd}
                      className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group cursor-grab active:cursor-grabbing"
                    >
                      <div className="w-8 h-8 mb-2 flex items-center justify-center">
                        <div className={`text-lg ${model.badgeColor}`}>{model.badge}</div>
                      </div>
                      <span className="text-xs text-gray-300 text-center px-2 leading-tight">
                        {model.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-24 bg-[#1a1a1a] border border-dashed border-[#2a2a2a] rounded-lg text-center px-4">
                  <span className="text-xl mb-1">✨</span>
                  <p className="text-[11px] text-gray-400">Models coming soon</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderAssets = () => {
    const images = getAllImages();
    
    return (
      <div
        className="scroll-snap-start"
        style={{
          scrollSnapAlign: 'start',
          scrollMarginTop: '80px',
          minHeight: 'calc(100vh - 200px)',
          paddingBottom: '40px',
          paddingTop: '20px',
        }}
      >
        <h2 className="text-base font-semibold text-white mb-4">Assets</h2>
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48">
            <div className="text-4xl mb-3">📦</div>
            <h2 className="text-lg font-semibold text-white mb-1">No Assets</h2>
            <p className="text-xs text-gray-400 text-center px-4">
              Generated images will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {images.map((image, index) => (
              <div
                key={`${image.nodeId}-${index}`}
                className="relative group bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg overflow-hidden hover:border-[#3a3a3a] transition-colors cursor-pointer"
              >
                {/* Image Preview */}
                <div
                  className="w-full aspect-square bg-[#0a0a0a] relative"
                  style={{
                    backgroundImage: `url(${image.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {/* Dimensions Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                    <span className="text-[10px] text-white">{image.dimensions}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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

  const renderVideoModels = () => (
    <div>
      <h2 className="text-base font-semibold text-white mb-1">Video Models</h2>
      <p className="text-xs text-gray-400 mb-4">Generate from text</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          draggable
          onDragStart={(event) => onDragStart(event, 'videoGenerator')}
          onDragEnd={onDragEnd}
          className="flex flex-col items-center justify-center h-24 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg transition-colors group cursor-grab active:cursor-grabbing"
        >
          <div className="w-8 h-8 mb-2 flex items-center justify-center">
            <div className="text-lg text-purple-400">P</div>
          </div>
          <span className="text-xs text-gray-300">Pixverse v4.5</span>
        </button>
      </div>
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
      case 'Video models':
        return renderVideoModels();
      case 'Assets':
        return renderAssets();
      case 'Tools':
        return renderTools();
      default:
        return renderComingSoon();
    }
  };

  if (!isOpen) return null;

  return (
    <>
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
