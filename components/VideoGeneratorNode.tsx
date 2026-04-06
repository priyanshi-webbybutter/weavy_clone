'use client';

import React, { memo, useCallback, useState, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MoreVertical, ArrowRight, Loader2 } from 'lucide-react';

interface VideoGeneratorNodeData {
  label: string;
  modelName: string;
  modelId?: string;
  videoUrl?: string;
  videoUrls?: string[];
  currentVideoIndex?: number;
  isGenerating?: boolean;
  hasEnoughCredits?: boolean;
  onRunModel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onVideoIndexChange?: (id: string, index: number) => void;
  onRemoveCurrentGeneration?: (id: string) => void;
  onRemoveAllOtherGenerations?: (id: string) => void;
  onRemoveAllGenerations?: (id: string) => void;
}

export const VideoGeneratorNode = memo(({ data, id, selected }: NodeProps<VideoGeneratorNodeData>) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const isClickingRef = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get videos array - support both old (videoUrl) and new (videoUrls) format
  const videoUrls = data.videoUrls || (data.videoUrl ? [data.videoUrl] : []);
  const currentIndex = data.currentVideoIndex !== undefined ? data.currentVideoIndex : (videoUrls.length > 0 ? videoUrls.length - 1 : 0);
  const currentVideoUrl = videoUrls[currentIndex] || data.videoUrl;
  const hasEnoughCredits = data.hasEnoughCredits !== false; // Default to true if not specified
  
  const handlePreviousVideo = useCallback(() => {
    if (currentIndex > 0 && data.onVideoIndexChange) {
      data.onVideoIndexChange(id, currentIndex - 1);
    }
  }, [id, currentIndex, data]);
  
  const handleNextVideo = useCallback(() => {
    if (currentIndex < videoUrls.length - 1 && data.onVideoIndexChange) {
      data.onVideoIndexChange(id, currentIndex + 1);
    }
  }, [id, currentIndex, videoUrls.length, data]);

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen]);

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleMenuAction = useCallback((action: string) => {
    setIsMenuOpen(false);

    switch (action) {
      case 'Delete':
        if (data.onDelete) {
          data.onDelete(id);
        }
        break;
      case 'Duplicate':
        if (data.onDuplicate) {
          data.onDuplicate(id);
        }
        break;
      case 'Remove Current Generation':
        if (data.onRemoveCurrentGeneration) {
          data.onRemoveCurrentGeneration(id);
        }
        break;
      case 'Remove All Other Generations':
        if (data.onRemoveAllOtherGenerations) {
          data.onRemoveAllOtherGenerations(id);
        }
        break;
      case 'Remove All Generations':
        if (data.onRemoveAllGenerations) {
          data.onRemoveAllGenerations(id);
        }
        break;
      default:
        break;
    }
  }, [id, data]);

  const handleRun = useCallback((e: React.MouseEvent) => {
    const clickId = `click-${Date.now()}-${Math.random()}`;
    console.log(`🖱️ [${clickId}] VideoGeneratorNode button clicked for node: ${id}`);

    e.preventDefault();
    e.stopPropagation();

    // Don't trigger if already generating
    if (data.isGenerating) {
      console.log(`⏸️ [${clickId}] Already generating, ignoring click`);
      return;
    }

    // Debounce rapid clicks (500ms cooldown) using ref for synchronous check
    if (isClickingRef.current) {
      console.log(`⏸️ [${clickId}] Debounce active, ignoring rapid click`);
      return;
    }

    // Set debounce flag immediately
    isClickingRef.current = true;
    
    // Clear any existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    // Reset debounce flag after 500ms
    clickTimeoutRef.current = setTimeout(() => {
      isClickingRef.current = false;
      clickTimeoutRef.current = null;
    }, 500);

    console.log(`✅ [${clickId}] Calling data.onRunModel(${id})`);
    if (data.onRunModel && hasEnoughCredits) {
      data.onRunModel(id);
    }
    console.log(`✅ [${clickId}] data.onRunModel call completed`);
  }, [id, data, hasEnoughCredits]);

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: '#1a1a1a',
        border: `2px solid ${selected ? '#8b5cf6' : '#2a2a2a'}`,
        minWidth: '450px',
        maxWidth: '500px',
        boxShadow: selected
          ? '0 4px 16px rgba(139, 92, 246, 0.4)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s',
      }}
    >
      {/* Input Handles - Left Side */}
      {/* Top: Magenta handle (Prompt) */}
      <Handle
        type="target"
        position={Position.Left}
        id="prompt"
        style={{
          background: '#ec4899', // Magenta
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          left: '-7px',
          top: '30%',
        }}
      />
      {/* Prompt Label - Left of Handle (Outside) */}
      <div
        style={{
          position: 'absolute',
          left: '-85px',
          top: '26%',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: '20px', color: '#ec4899', fontWeight: '500' }}>Prompt*</span>
      </div>
      
      {/* First Frame - Teal handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="firstFrame"
        style={{
          background: '#14b8a6', // Teal
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          left: '-7px',
          top: '45%',
        }}
      />
      {/* First Frame Label - Left of Handle (Outside) */}
      <div
        style={{
          position: 'absolute',
          left: '-110px',
          top: '41%',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: '20px', color: '#14b8a6', fontWeight: '500' }}>First Frame</span>
      </div>
      
      {/* Last Frame - Teal handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="lastFrame"
        style={{
          background: '#14b8a6', // Teal
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          left: '-7px',
          top: '60%',
        }}
      />
      {/* Last Frame Label - Left of Handle (Outside) */}
      <div
        style={{
          position: 'absolute',
          left: '-110px',
          top: '56%',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: '20px', color: '#14b8a6', fontWeight: '500' }}>Last Frame</span>
      </div>
      
      {/* Negative Prompt - Magenta handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="negativePrompt"
        style={{
          background: '#ec4899', // Magenta
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          left: '-7px',
          top: '75%',
        }}
      />
      {/* Negative Prompt Label - Left of Handle (Outside) */}
      <div
        style={{
          position: 'absolute',
          left: '-165px',
          top: '71%',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: '20px', color: '#ec4899', fontWeight: '500' }}>Negative Prompt</span>
      </div>

      {/* Header with Title and Menu */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#2a2a2a',
              borderRadius: '6px',
            }}
          >
            <span style={{ fontSize: '14px' }}>🎬</span>
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#ffffff',
            }}
          >
            {data.modelName || 'Video Generator'}
          </div>
        </div>

        <button
          className="nodrag"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
          onClick={handleMenuToggle}
        >
          <MoreVertical size={16} />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <>
            <div
              className="nodrag"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
              }}
              onClick={handleMenuClose}
            />
            <div
              className="nodrag"
              style={{
                position: 'absolute',
                top: '28px',
                right: '0',
                minWidth: '200px',
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                zIndex: 101,
                padding: '4px',
              }}
            >
              <button
                className="nodrag"
                onClick={() => handleMenuAction('Duplicate')}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>Duplicate</span>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>ctrl+d</span>
              </button>
              <button
                className="nodrag"
                onClick={() => handleMenuAction('Delete')}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>Delete</span>
                <span style={{ color: '#6b7280', fontSize: '12px', fontStyle: 'italic' }}>delete / backspace</span>
              </button>
              <button
                className="nodrag"
                onClick={() => handleMenuAction('Lock')}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>Lock</span>
              </button>
              <div style={{ height: '1px', background: '#2a2a2a', margin: '4px 0' }} />
              {videoUrls.length > 0 && (
                <>
                  <button
                    className="nodrag"
                    onClick={() => handleMenuAction('Remove Current Generation')}
                    disabled={videoUrls.length === 0}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: videoUrls.length === 0 ? '#6b7280' : '#ffffff',
                      fontSize: '13px',
                      cursor: videoUrls.length === 0 ? 'not-allowed' : 'pointer',
                      borderRadius: '4px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (videoUrls.length > 0) {
                        e.currentTarget.style.background = '#2a2a2a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>Remove current generation</span>
                  </button>
                  {videoUrls.length > 1 && (
                    <button
                      className="nodrag"
                      onClick={() => handleMenuAction('Remove All Other Generations')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '13px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span>Remove all other generations</span>
                    </button>
                  )}
                  <button
                    className="nodrag"
                    onClick={() => handleMenuAction('Remove All Generations')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>Remove all generations</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Output Label - Right Side (Outside) */}
      <div
        style={{
          position: 'absolute',
          right: '-60px',
          top: '110px',
          transform: 'translateY(-50%)',
          zIndex: 10
        }}
      >
        <span style={{ fontSize: '20px', color: '#f472b6', fontWeight: '500' }}>Result</span>
      </div>

      {/* Video Preview Area */}
      <div
        onMouseEnter={() => setIsPreviewHovered(true)}
        onMouseLeave={() => setIsPreviewHovered(false)}
        style={{
          width: '100%',
          height: '400px',
          borderRadius: '8px',
          backgroundImage: currentVideoUrl
            ? 'none'
            : 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a), linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a)',
          backgroundSize: currentVideoUrl ? 'cover' : '20px 20px',
          backgroundPosition: currentVideoUrl ? 'center' : '0 0, 10px 10px',
          backgroundColor: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isPreviewHovered ? 'inset 0 45px 20px -20px rgba(0, 0, 0, 0.4)' : 'none',
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Navigation Controls - Top Bar */}
        {videoUrls.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '40px',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              zIndex: 15,
              opacity: isPreviewHovered ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            {/* Left: Previous, Counter, Next */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Previous Button */}
              <button
                className="nodrag"
                onClick={handlePreviousVideo}
                disabled={currentIndex === 0}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: currentIndex === 0 ? 0.4 : 0.8,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (currentIndex > 0) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentIndex > 0) {
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              {/* Counter */}
              <span style={{ color: '#ffffff', fontSize: '13px', opacity: 0.9 }}>
                {videoUrls.length > 0 ? `${currentIndex + 1} / ${videoUrls.length}` : '0 / 0'}
              </span>
              
              {/* Next Button */}
              <button
                className="nodrag"
                onClick={handleNextVideo}
                disabled={currentIndex >= videoUrls.length - 1}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: currentIndex >= videoUrls.length - 1 ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: currentIndex >= videoUrls.length - 1 ? 0.4 : 0.8,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (currentIndex < videoUrls.length - 1) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentIndex < videoUrls.length - 1) {
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {data.isGenerating && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '12px',
              zIndex: 10,
            }}
          >
            <Loader2 className="animate-spin" size={32} color="#8b5cf6" />
            <span style={{ color: '#ffffff', fontSize: '13px' }}>Generating video...</span>
          </div>
        )}

        {currentVideoUrl ? (
          <video
            src={currentVideoUrl}
            controls
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : !data.isGenerating && (
          <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
            No video generated yet
          </div>
        )}
      </div>

      {/* Run Button */}
      <div style={{display: 'flex', justifyContent: 'flex-end'}}>
      <button
        className="nodrag"
        onClick={handleRun}
        disabled={data.isGenerating || !hasEnoughCredits}
        style={{
          padding: '8px 16px',
          background: 'transparent',
          border: '1px solid #2a2a2a',
          borderRadius: '6px',
          color: '#ffffff',
          fontSize: '13px',
          cursor: data.isGenerating ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s',
          opacity: data.isGenerating ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!data.isGenerating) {
            e.currentTarget.style.background = '#2a2a2a';
            e.currentTarget.style.borderColor = '#3a3a3a';
          }
        }}
        onMouseLeave={(e) => {
          if (!data.isGenerating) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = '#2a2a2a';
          }
        }}
      >
        {data.isGenerating ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <ArrowRight size={16} />
            <span>Run Model</span>
          </>
        )}
      </button>
      </div>
      {/* Credit Warning Bar */}
      {!hasEnoughCredits && (
        <div
          style={{
            width: '100%',
            padding: '8px 12px',
            background: '#fef3c7', // Light yellow
            borderRadius: '6px',
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '14px' }}>❗</span>
          <span style={{ fontSize: '11px', color: '#92400e' }}>
            Not enough credits to run the model. Upgrade to get more credits.
          </span>
        </div>
      )}

      {/* Output Handle - Right Side */}
      <Handle
        type="source"
        position={Position.Right}
        id="result"
        style={{
          background: '#f472b6', // Light pink/red
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          right: '-7px',
          top: '130px',
        }}
      />
    </div>
  );
});

VideoGeneratorNode.displayName = 'VideoGeneratorNode';
