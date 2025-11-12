'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Info, Download, Link2, MoreVertical, ArrowRight } from 'lucide-react';

interface FullscreenModalProps {
  nodeId: string;
  node: any;
  nodeSettings: any;
  projectName?: string;
  tasks: any[];
  onClose: () => void;
  onImageIndexChange: (nodeId: string, index: number) => void;
  onRunModel: (nodeId: string) => void;
  onSettingsChange?: (nodeId: string, settings: any) => void;
}

const FullscreenModal: React.FC<FullscreenModalProps> = ({
  nodeId,
  node,
  nodeSettings,
  projectName = 'untitled',
  tasks = [],
  onClose,
  onImageIndexChange,
  onRunModel,
  onSettingsChange,
}) => {
  const imageUrls = node?.data?.imageUrls || (node?.data?.imageUrl ? [node?.data?.imageUrl] : []);
  const currentIndex = node?.data?.currentImageIndex !== undefined 
    ? node.data.currentImageIndex 
    : (imageUrls.length > 0 ? imageUrls.length - 1 : 0);
  const currentImageUrl = imageUrls[currentIndex] || node?.data?.imageUrl;
  const modelName = node?.data?.modelName || 'Seedream-4';
  const width = nodeSettings?.width || 1024;
  const height = nodeSettings?.height || 1024;
  
  const [zoomLevel, setZoomLevel] = useState(100);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handlePreviousImage = useCallback(() => {
    if (currentIndex > 0) {
      onImageIndexChange(nodeId, currentIndex - 1);
    }
  }, [nodeId, currentIndex, onImageIndexChange]);

  const handleNextImage = useCallback(() => {
    if (currentIndex < imageUrls.length - 1) {
      onImageIndexChange(nodeId, currentIndex + 1);
    }
  }, [nodeId, currentIndex, imageUrls.length, onImageIndexChange]);

  const handleRunModel = useCallback(() => {
    onRunModel(nodeId);
  }, [nodeId, onRunModel]);

  const handleDownload = useCallback(async () => {
    if (!currentImageUrl) return;
    
    try {
      // Fetch the image as a blob to handle CORS issues
      const response = await fetch(currentImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${modelName}-${currentIndex + 1}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      // Fallback: try direct download
      const link = document.createElement('a');
      link.href = currentImageUrl;
      link.download = `${modelName}-${currentIndex + 1}-${Date.now()}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [currentImageUrl, modelName, currentIndex]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 25, 500)); // Max 500%
    setImagePosition({ x: 0, y: 0 }); // Center the image on zoom
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 25, 100)); // Min 100%
    setImagePosition({ x: 0, y: 0 }); // Center the image on zoom
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(100);
  }, []);

  // Reset zoom and position when image changes
  useEffect(() => {
    setZoomLevel(100);
    setImagePosition({ x: 0, y: 0 });
  }, [currentImageUrl]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button (button 1) or left button when zoomed
    if (e.button === 1 || (e.button === 0 && zoomLevel > 100)) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  }, [zoomLevel, imagePosition]);

  // Global mouse move handler
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setImagePosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart]);

  // Handle mouse move for dragging (local)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  // Handle mouse up to stop dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Prevent context menu on middle click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Scrolling up - zoom in
      handleZoomIn();
    } else {
      // Scrolling down - zoom out
      handleZoomOut();
    }
  }, [handleZoomIn, handleZoomOut]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a0a',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          width: '100%',
          height: '60px',
          background: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: '12px',
        }}
      >
        {/* Left: Model Name Tab */}
        <div
          style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
          <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 400 }}>
            {modelName}
          </span>
        </div>

        {/* Right: Controls Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Controls Group */}
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
             <span style={{ color: '#ffffff', fontSize: '13px', opacity: 0.9 }}>{zoomLevel}%</span>
            <div
              style={{
                width: '1px',
                height: '16px',
                background: '#2a2a2a',
              }}
            />
             <button
               style={{
                 background: 'transparent',
                 border: 'none',
                 color: '#ffffff',
                 cursor: 'pointer',
                 padding: '4px',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 opacity: 0.9,
               }}
             >
               <Info size={16} />
             </button>
             <button
               onClick={handleDownload}
               disabled={!currentImageUrl}
               style={{
                 background: 'transparent',
                 border: 'none',
                 color: '#ffffff',
                 cursor: currentImageUrl ? 'pointer' : 'not-allowed',
                 padding: '4px',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 opacity: currentImageUrl ? 0.9 : 0.4,
               }}
             >
               <Download size={16} />
             </button>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.9,
              }}
            >
              <Link2 size={16} />
            </button>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.9,
              }}
            >
              <MoreVertical size={16} />
            </button>
          </div>

          {/* Counter Button */}
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '106px',
            }}
          >
            <span style={{ color: '#ffffff', fontSize: '13px', opacity: 0.9 }}>
              {imageUrls.length > 0 ? `${currentIndex + 1} / ${imageUrls.length}` : '0 / 0'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
         {/* Center: Image Display */}
         <div
           onWheel={handleWheel}
           onMouseDown={handleMouseDown}
           onMouseMove={handleMouseMove}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseUp}
           onContextMenu={handleContextMenu}
           style={{
             flex: 1,
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             padding: '40px',
             overflow: 'hidden',
             background: '#0a0a0a',
             cursor: isDragging || (zoomLevel > 100) ? 'grab' : 'default',
           }}
         >
           {currentImageUrl ? (
             <img
               src={currentImageUrl}
               alt="Generated image"
               draggable={false}
               style={{
                 maxWidth: '100%',
                 maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${zoomLevel / 100})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.2s ease',
                cursor: isDragging ? 'grabbing' : (zoomLevel > 100 ? 'grab' : 'default'),
              }}
             />
           ) : (
             <div style={{ color: '#666', fontSize: '14px' }}>No image generated yet</div>
           )}
         </div>

        {/* Right Panel - Image Previews */}
        <div
          style={{
            width: '134px',
            background: 'transparent',
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Image Previews - Stacked Vertically */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
            {imageUrls.map((url: string, index: number) => (
              <div
                key={index}
                onClick={() => onImageIndexChange(nodeId, index)}
                style={{
                  width: '100px',
                  aspectRatio: '1',
                  backgroundImage: `url(${url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRadius: '8px',
                  border: index === currentIndex ? '2px solid #8b5cf6' : '1px solid #2a2a2a',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (index !== currentIndex) {
                    e.currentTarget.style.borderColor = '#3a3a3a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (index !== currentIndex) {
                    e.currentTarget.style.borderColor = '#2a2a2a';
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullscreenModal;

