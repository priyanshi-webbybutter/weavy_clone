# Weavy Clone - AI Design Canvas

A Weavy.ai-inspired interface built with React Flow, featuring a dark theme sidebar, canvas tools, and node-based workflows.

## Features

This project features a Weavy.ai-inspired interface with:

### UI Components
- **Left Sidebar**: 68px fixed sidebar with navigation icons (Search, Recent, Projects, Edit, Image Gen, 3D, AI, Gallery)
- **Bottom Toolbar**: Floating toolbar with Pointer, Hand, Undo, Redo tools and Zoom control
- **Top Header Bar**: Project name input, credits display, and share button
- **Dark Theme**: Deep black background with purple accent colors

### React Flow Features
- **MiniMap**: Navigation overview showing all nodes and current viewport
- **Background**: Customizable dot/grid patterns
- **Custom Nodes**: Dark-themed nodes with multiple connection handles
- **Drag & Drop**: Interactive node positioning
- **Animated Connections**: Purple animated edges between nodes

## Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── page.tsx          # Main page component
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── FlowCanvas.tsx    # Main canvas with all features
│   └── CustomNode.tsx    # Custom node component
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── next.config.js        # Next.js config
```

## Component Breakdown

### 1. MiniMap

The MiniMap provides a bird's-eye view of your entire flow.

**Location**: Bottom right corner

**Features**:
- Shows all nodes with color coding
- Displays current viewport as a rectangle
- Zoomable and pannable
- Click to navigate to different areas

**Customization**:
```tsx
<MiniMap
  nodeColor={(node) => {
    // Custom colors based on node type
    switch (node.type) {
      case 'custom': return '#6366f1';
      default: return '#94a3b8';
    }
  }}
  nodeStrokeWidth={3}
  zoomable
  pannable
/>
```

**Props**:
- `nodeColor`: Function or string to set node colors
- `nodeStrokeWidth`: Border width of nodes
- `zoomable`: Enable zoom on minimap
- `pannable`: Enable panning on minimap
- `maskColor`: Background color
- `style`: Custom CSS styles

### 2. Controls

Built-in controls for canvas interaction.

**Location**: Bottom left corner (default)

**Features**:
- Zoom in (+)
- Zoom out (-)
- Fit view (frame icon)
- Lock/unlock interaction (lock icon)

**Implementation**:
```tsx
<Controls
  showZoom={true}
  showFitView={true}
  showInteractive={true}
/>
```

**Props**:
- `showZoom`: Show zoom buttons
- `showFitView`: Show fit view button
- `showInteractive`: Show lock/unlock button
- `position`: Control position ('top-left', 'bottom-right', etc.)
- `style`: Custom CSS styles

### 3. Background

Customizable background patterns for the canvas.

**Features**:
- Dots pattern
- Lines pattern (grid)
- Cross pattern

**Implementation**:
```tsx
<Background
  variant={BackgroundVariant.Dots}
  gap={12}
  size={1}
  color="#94a3b8"
/>
```

**Variants**:
- `BackgroundVariant.Dots`: Dot pattern
- `BackgroundVariant.Lines`: Grid lines
- `BackgroundVariant.Cross`: Cross pattern

**Props**:
- `variant`: Pattern type
- `gap`: Spacing between dots/lines
- `size`: Dot/line size
- `color`: Pattern color
- `style`: Custom CSS styles

### 4. Panels

Flexible positioned UI containers.

**Available Positions**:
- `top-left`
- `top-center`
- `top-right`
- `bottom-left`
- `bottom-center`
- `bottom-right`

**This Example Uses 5 Panels**:

1. **Top Left**: Action buttons (Add Node, Toggle BG, Clear All)
2. **Top Center**: Title/heading
3. **Top Right**: Statistics (node count, edge count)
4. **Bottom Left**: Help text and tips
5. **Bottom Right**: Credits/version info

**Implementation**:
```tsx
<Panel position="top-left">
  <div style={{ /* your styles */ }}>
    <button onClick={addNode}>Add Node</button>
  </div>
</Panel>
```

**Props**:
- `position`: Panel position (required)
- `style`: Custom CSS styles
- `className`: CSS class name

### 5. Custom Nodes

Custom node components with styled appearance and multiple handles.

**Features**:
- Custom styling and layout
- Multiple connection points (4 handles)
- Hover and selection states
- Type-safe data props

**Implementation**:
```tsx
// Define node types
const nodeTypes = {
  custom: CustomNode,
};

// Use in ReactFlow
<ReactFlow nodeTypes={nodeTypes} />
```

**CustomNode Component**:
```tsx
export const CustomNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div>
      <Handle type="target" position={Position.Top} />
      {/* Node content */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});
```

**Handle Positions**:
- `Position.Top`: Top center
- `Position.Bottom`: Bottom center
- `Position.Left`: Left center
- `Position.Right`: Right center

## Interactive Features

### Adding Nodes
Click the "Add Node" button in the top-left panel to create new nodes at random positions.

### Connecting Nodes
1. Hover over a node to see connection handles
2. Click and drag from a source handle (blue/purple dots)
3. Release on a target handle of another node

### Moving Nodes
Click and drag any node to reposition it.

### Toggle Background
Click "Toggle BG" to cycle through:
- Dots → Lines → Cross → Dots

### Clear Canvas
Click "Clear All" to remove all nodes and edges.

### Zoom Controls
- Use the control panel (bottom left)
- Scroll to zoom
- Click fit view to see all nodes

## Customization Examples

### Change MiniMap Position
```tsx
<MiniMap
  position="top-right"  // Move to top-right corner
/>
```

### Custom Background Colors
```tsx
<Background
  variant={BackgroundVariant.Lines}
  color="#ff0000"  // Red grid
  gap={20}         // Larger spacing
/>
```

### Add Custom Panels
```tsx
<Panel position="bottom-center">
  <button onClick={handleSave}>Save Flow</button>
</Panel>
```

### Custom Node Styling
Edit `components/CustomNode.tsx` to change:
- Colors
- Border radius
- Padding
- Typography
- Handle styles

## Common Use Cases

### Workflow Builder
Use this as a base for:
- Business process flows
- CI/CD pipeline builders
- State machines
- Decision trees

### Data Flow Diagrams
Perfect for:
- ETL pipelines
- API workflow visualization
- Data transformation flows

### Mind Maps
Adapt for:
- Brainstorming tools
- Concept mapping
- Knowledge graphs

## Tips & Best Practices

1. **Performance**: Use `memo()` for custom nodes to prevent unnecessary re-renders
2. **Node IDs**: Always use unique IDs for nodes
3. **Handles**: Ensure handles have unique IDs when using multiple on same side
4. **Type Safety**: Define proper TypeScript interfaces for node data
5. **Styling**: Use inline styles or CSS modules for node styling

## React Flow Props Reference

### ReactFlow Component
```tsx
<ReactFlow
  nodes={nodes}                    // Node array
  edges={edges}                    // Edge array
  onNodesChange={onNodesChange}    // Handle node changes
  onEdgesChange={onEdgesChange}    // Handle edge changes
  onConnect={onConnect}            // Handle new connections
  nodeTypes={nodeTypes}            // Custom node types
  fitView                          // Fit all nodes in view on mount
/>
```

## Resources

- [React Flow Documentation](https://reactflow.dev)
- [React Flow Examples](https://reactflow.dev/examples)
- [API Reference](https://reactflow.dev/api-reference)
- [React Flow GitHub](https://github.com/wbkd/react-flow)

## Next Steps

### Enhance This Example:

1. **Add More Node Types**
   - Create input/output nodes
   - Add conditional nodes
   - Design data transformation nodes

2. **Persist State**
   - Save flow to localStorage
   - Export/import as JSON
   - Database integration

3. **Advanced Features**
   - Node grouping
   - Subflows
   - Context menus
   - Edge labels
   - Custom edge types

4. **Styling**
   - Dark mode support
   - Themed nodes
   - Animated edges
   - Custom backgrounds

## License

MIT

## Support

For questions or issues:
- Check the [React Flow Discord](https://discord.gg/Bqt6xrs)
- Open an issue on GitHub
- Review the documentation

---

Built with React Flow v11, Next.js 15, Shadcn/ui, and Tailwind CSS - Inspired by Weavy.ai
