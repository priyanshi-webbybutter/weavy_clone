'use client';

import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MoreVertical } from 'lucide-react';

interface PromptInputNodeData {
  label: string;
  value: string;
  onChange?: (id: string, value: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export const PromptInputNode = memo(({ data, id, selected }: NodeProps<PromptInputNodeData>) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const onChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (data.onChange) {
      data.onChange(id, evt.target.value);
    }
  }, [id, data]);

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

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: '#1a1a1a',
        border: `2px solid ${selected ? '#8b5cf6' : '#2a2a2a'}`,
        minWidth: '300px',
        maxWidth: '400px',
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
        <div
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#ffffff',
          }}
        >
          {data.label}
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

        {/* Dropdown Menu - Outside button element */}
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="nodrag"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
              }}
              onClick={handleMenuClose}
            />

            {/* Menu Container */}
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
              {/* Duplicate */}
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

              {/* Delete */}
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

              {/* Lock */}
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

              {/* Divider */}
              <div style={{ height: '1px', background: '#2a2a2a', margin: '4px 0' }} />

              {/* Rename */}
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

      {/* Text Input Area */}
      <textarea
        value={data.value}
        onChange={onChange}
        placeholder="Enter your prompt here..."
        className="nodrag"
        style={{
          width: '100%',
          minHeight: '120px',
          padding: '12px',
          background: '#0a0a0a',
          border: '1px solid #2a2a2a',
          borderRadius: '8px',
          color: '#ffffff',
          fontSize: '13px',
          lineHeight: '1.5',
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />

      {/* Output Handle - Right Side */}
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        style={{
          background: 'rgb(236, 72, 153)',
          width: '12px',
          height: '12px',
          border: '2px solid #1a1a1a',
          right: '-7px',
        }}
      />
    </div>
  );
});

PromptInputNode.displayName = 'PromptInputNode';
