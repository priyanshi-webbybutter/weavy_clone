'use client';

import React, { memo, useCallback, useState, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MoreVertical, ArrowRight, Loader2, Plus } from 'lucide-react';

interface ImageDescriberNodeData {
  label: string;
  description?: string;
  imageUrls?: string[];
  isGenerating?: boolean;
  onRunModel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onAddImage?: (id: string) => void;
}

export const ImageDescriberNode = memo(({ data, id, selected }: NodeProps<ImageDescriberNodeData>) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isClickingRef = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen]);

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleMenuAction = useCallback((action: string) => {
    console.log(`${action} action for node ${id}`);
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
      case 'Lock':
        // TODO: Implement lock functionality
        break;
      case 'Rename':
        // TODO: Implement rename functionality
        break;
    }
  }, [id, data]);

  const handleRunModel = useCallback((e: React.MouseEvent) => {
    const clickId = `click-${Date.now()}-${Math.random()}`;
    console.log(`🖱️ [${clickId}] ImageDescriberNode button clicked for node: ${id}`);

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
    if (data.onRunModel) {
      data.onRunModel(id);
    }
    console.log(`✅ [${clickId}] data.onRunModel call completed`);
  }, [id, data]);

  const handleAddImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (data.onAddImage) {
      data.onAddImage(id);
    }
  }, [id, data]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

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
        position: 'relative',
      }}
    >
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
        <div
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#ffffff',
          }}
        >
          {data.label || 'Image Describer'}
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
              <button
                className="nodrag"
                onClick={() => handleMenuAction('Rename')}
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
                <span>Rename</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Text Area for Description */}
      <div
        style={{
          width: '100%',
          minHeight: '200px',
          maxHeight: '400px',
          padding: '12px',
          background: '#0a0a0a',
          border: '1px solid #2a2a2a',
          borderRadius: '8px',
          marginBottom: '12px',
          position: 'relative',
          overflow: 'auto',
        }}
      >
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
            <span style={{ color: '#ffffff', fontSize: '13px' }}>Describing image...</span>
          </div>
        )}
        <div
          style={{
            color: data.description ? '#ffffff' : '#6b7280',
            fontSize: '13px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {data.description || 'The generated text will appear here'}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <button
          className="nodrag"
          onClick={handleAddImage}
          disabled={data.isGenerating}
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
          <Plus size={14} />
          <span>Add another image input</span>
        </button>
        <button
          className="nodrag"
          onClick={handleRunModel}
          disabled={data.isGenerating}
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
          <ArrowRight size={14} />
          <span>Run Model</span>
        </button>
      </div>

      {/* Input Handle - Image (Left Side) */}
      <Handle
        id="image"
        type="target"
        position={Position.Left}
        style={{
          background: '#10b981',
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          left: '-7px',
          top: '30%',
        }}
      />
      
      {/* Image Label - Left of Handle (Outside) */}
      <div
        style={{
          position: 'absolute',
          left: '-70px',
          top: '30%',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: '20px', color: '#10b981', fontWeight: '500' }}>Image*</span>
      </div>

      {/* Output Handle - Text (Right Side) */}
      <Handle
        id="text"
        type="source"
        position={Position.Right}
        style={{
          background: '#d946ef',
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          right: '-7px',
          top: '30%',
        }}
      />

      {/* Text Label - Right of Handle (Outside) */}
      <div
        style={{
          position: 'absolute',
          right: '-60px',
          top: '30%',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: '20px', color: '#d946ef', fontWeight: '500' }}>Text</span>
      </div>
    </div>
  );
});

ImageDescriberNode.displayName = 'ImageDescriberNode';

