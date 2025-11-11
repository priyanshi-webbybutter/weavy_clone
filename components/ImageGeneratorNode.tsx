'use client';

import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MoreVertical, ArrowRight, Loader2 } from 'lucide-react';

interface ImageGeneratorNodeData {
  label: string;
  modelName: string;
  imageUrl?: string;
  isGenerating?: boolean;
  onRunModel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export const ImageGeneratorNode = memo(({ data, id, selected }: NodeProps<ImageGeneratorNodeData>) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

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
    e.preventDefault();
    e.stopPropagation();

    // Don't trigger if already generating
    if (data.isGenerating) {
      console.log('⏸️ Already generating, ignoring click');
      return;
    }

    // Debounce rapid clicks (300ms cooldown)
    if (isClicking) {
      console.log('⏸️ Debounce active, ignoring rapid click');
      return;
    }

    // Set debounce flag
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 300);

    if (data.onRunModel) {
      data.onRunModel(id);
    }
  }, [id, data, isClicking]);

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
            <span style={{ fontSize: '14px' }}>🌀</span>
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#ffffff',
            }}
          >
            {data.modelName}
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

      {/* Input and Output Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          paddingLeft: '8px',
          paddingRight: '8px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#d946ef', fontWeight: '500' }}>Prompt*</span>
        <span style={{ fontSize: '11px', color: '#06b6d4', fontWeight: '500' }}>Image</span>
      </div>

      {/* Image Preview Area */}
      <div
        style={{
          width: '100%',
          height: '400px',
          borderRadius: '8px',
          backgroundImage: data.imageUrl
            ? `url(${data.imageUrl})`
            : 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a), linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a)',
          backgroundSize: data.imageUrl ? 'cover' : '20px 20px',
          backgroundPosition: data.imageUrl ? 'center' : '0 0, 10px 10px',
          backgroundColor: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
          position: 'relative',
          overflow: 'hidden',
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
            }}
          >
            <Loader2 className="animate-spin" size={32} color="#8b5cf6" />
            <span style={{ color: '#ffffff', fontSize: '13px' }}>Generating image...</span>
          </div>
        )}
        {!data.imageUrl && !data.isGenerating && (
          <span style={{ color: '#6b7280', fontSize: '13px' }}>No image generated yet</span>
        )}
      </div>

      {/* Run Model Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

      {/* Input Handle - Left Side */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#d946ef',
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          left: '-7px',
        }}
      />

      {/* Output Handle - Right Side */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#06b6d4',
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          right: '-7px',
        }}
      />
    </div>
  );
});

ImageGeneratorNode.displayName = 'ImageGeneratorNode';
