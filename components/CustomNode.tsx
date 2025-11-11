'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface CustomNodeData {
  label: string;
  description?: string;
}

export const CustomNode = memo(({ data, selected }: NodeProps<CustomNodeData>) => {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: '#1a1a1a',
        border: `2px solid ${selected ? '#8b5cf6' : '#2a2a2a'}`,
        minWidth: '200px',
        boxShadow: selected
          ? '0 4px 16px rgba(139, 92, 246, 0.4)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s',
      }}
    >
      {/* Input Handle - Top */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#8b5cf6',
          width: '10px',
          height: '10px',
          border: '2px solid #1a1a1a',
        }}
      />

      {/* Node Content */}
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '6px',
          }}
        >
          {data.label}
        </div>
        {data.description && (
          <div
            style={{
              fontSize: '12px',
              color: '#9ca3af',
            }}
          >
            {data.description}
          </div>
        )}
      </div>

      {/* Output Handle - Bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#8b5cf6',
          width: '10px',
          height: '10px',
          border: '2px solid #1a1a1a',
        }}
      />

      {/* Side Handles - Left and Right */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: '#a855f7',
          width: '8px',
          height: '8px',
          border: '2px solid #1a1a1a',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: '#a855f7',
          width: '8px',
          height: '8px',
          border: '2px solid #1a1a1a',
        }}
      />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
