// lib/canvas/CanvasEngine.ts

import { Shape, Point, Viewport, CanvasState, ShapeType, RectangleShape, CircleShape, TextShape, ImageShape, LineShape, ArrowShape, FreehandShape } from './types';

export type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'top' | 'bottom' | 'left' | 'right';

export class CanvasEngine {
  private readonly HANDLE_SIZE = 8; // Size of resize handles in screen pixels
  private state: CanvasState;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(initialState?: Partial<CanvasState>) {
    // Initialize state first
    const initialShapes = initialState?.shapes || new Map();
    const initialSelectedIds = initialState?.selectedIds || new Set();
    const initialViewport = initialState?.viewport || { x: 0, y: 0, zoom: 1 };
    
    // Create a minimal initial snapshot
    const initialSnapshot: CanvasState = {
      shapes: new Map(initialShapes),
      selectedIds: new Set(initialSelectedIds),
      viewport: { ...initialViewport },
      history: {
        past: [],
        present: {
          shapes: new Map(initialShapes),
          selectedIds: new Set(initialSelectedIds),
          viewport: { ...initialViewport },
          history: {} as any,
        },
        future: [],
      },
    };
    
    // Now initialize the full state
    this.state = {
      shapes: initialShapes,
      selectedIds: initialSelectedIds,
      viewport: initialViewport,
      history: {
        past: [],
        present: initialSnapshot,
        future: [],
      },
      ...initialState,
    };
  }

  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    if (this.ctx) {
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }

  // Coordinate transformations
  worldToScreen(point: Point): Point {
    return {
      x: (point.x * this.state.viewport.zoom) + this.state.viewport.x,
      y: (point.y * this.state.viewport.zoom) + this.state.viewport.y,
    };
  }

  screenToWorld(point: Point): Point {
    return {
      x: (point.x - this.state.viewport.x) / this.state.viewport.zoom,
      y: (point.y - this.state.viewport.y) / this.state.viewport.zoom,
    };
  }

  // Viewport operations
  pan(deltaX: number, deltaY: number) {
    this.state.viewport.x += deltaX;
    this.state.viewport.y += deltaY;
    this.render();
  }

  zoom(factor: number, centerX: number, centerY: number) {
    const oldZoom = this.state.viewport.zoom;
    const newZoom = Math.max(0.1, Math.min(5, oldZoom * factor));

    // Zoom towards the center point
    const worldPoint = this.screenToWorld({ x: centerX, y: centerY });
    this.state.viewport.zoom = newZoom;
    const newScreenPoint = this.worldToScreen(worldPoint);
    
    this.state.viewport.x += centerX - newScreenPoint.x;
    this.state.viewport.y += centerY - newScreenPoint.y;

    this.render();
  }

  resetViewport() {
    this.state.viewport = { x: 0, y: 0, zoom: 1 };
    this.render();
  }

  fitToScreen(padding = 50) {
    if (!this.canvas) return;

    const shapes = this.getAllShapes();
    if (shapes.length === 0) {
      // If no shapes, just center the viewport
      this.state.viewport = { x: 0, y: 0, zoom: 1 };
      this.render();
      return;
    }

    // Calculate bounding box of all shapes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of shapes) {
      let bounds: { x: number; y: number; width: number; height: number };
      
      if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image') {
        if (shape.type === 'text') {
          const textBounds = this.getTextBounds(shape as TextShape);
          bounds = {
            x: shape.x,
            y: shape.y,
            width: textBounds.width,
            height: textBounds.height,
          };
        } else {
          bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        }
      } else if (shape.type === 'circle') {
        bounds = {
          x: shape.x,
          y: shape.y,
          width: shape.radius * 2,
          height: shape.radius * 2,
        };
      } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
        const xs = shape.points.map((p: Point) => p.x);
        const ys = shape.points.map((p: Point) => p.y);
        bounds = {
          x: Math.min(...xs) - 5,
          y: Math.min(...ys) - 5,
          width: Math.max(...xs) - Math.min(...xs) + 10,
          height: Math.max(...ys) - Math.min(...ys) + 10,
        };
      } else {
        continue;
      }

      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    if (minX === Infinity) {
      this.state.viewport = { x: 0, y: 0, zoom: 1 };
      this.render();
      return;
    }

    // Add padding to bounds
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // Get canvas display dimensions (accounting for devicePixelRatio)
    const rect = this.canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    // Calculate zoom to fit content
    const zoomX = canvasWidth / contentWidth;
    const zoomY = canvasHeight / contentHeight;
    const zoom = Math.min(zoomX, zoomY, 1); // Don't zoom in beyond 100%

    // Center the content on screen
    // viewport.x and viewport.y represent the screen position of world origin (0,0)
    // To center contentCenterX at screenCenterX:
    // screenCenterX = (contentCenterX * zoom) + viewport.x
    // Therefore: viewport.x = screenCenterX - (contentCenterX * zoom)
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;
    
    const viewportX = screenCenterX - (contentCenterX * zoom);
    const viewportY = screenCenterY - (contentCenterY * zoom);

    this.state.viewport = {
      x: viewportX,
      y: viewportY,
      zoom: zoom,
    };

    this.render();
  }

  // Shape operations
  addShape(shape: Shape) {
    this.saveState();
    this.state.shapes.set(shape.id, shape);
    this.render();
  }

  removeShape(id: string) {
    this.saveState();
    this.state.shapes.delete(id);
    this.state.selectedIds.delete(id);
    this.render();
  }

  updateShape(id: string, updates: Partial<Shape>, saveState = false) {
    if (saveState) {
      this.saveState();
    }
    const shape = this.state.shapes.get(id);
    if (shape) {
      this.state.shapes.set(id, { ...shape, ...updates } as Shape);
      this.render();
    }
  }

  getShape(id: string): Shape | undefined {
    return this.state.shapes.get(id);
  }

  getAllShapes(): Shape[] {
    return Array.from(this.state.shapes.values());
  }

  // Selection
  selectShape(id: string, multiSelect = false) {
    if (!multiSelect) {
      this.state.selectedIds.clear();
    }
    this.state.selectedIds.add(id);
    this.render();
  }

  deselectShape(id: string) {
    this.state.selectedIds.delete(id);
    this.render();
  }

  clearSelection() {
    this.state.selectedIds.clear();
    this.render();
  }

  getSelectedShapes(): Shape[] {
    return Array.from(this.state.selectedIds)
      .map(id => this.state.shapes.get(id))
      .filter((shape): shape is Shape => shape !== undefined);
  }

  getShapeBoundsInScreen(shape: Shape): { x: number; y: number; width: number; height: number; centerX: number; centerY: number } | null {
    if (!this.canvas) return null;

    let bounds: { x: number; y: number; width: number; height: number };

    if (shape.type === 'rectangle' || shape.type === 'image') {
      bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    } else if (shape.type === 'text') {
      // For text shapes, use actual text bounds only when text is wrapped (clipped)
      // When width is bigger than text needs, use shape bounds (not clipped)
      const textBounds = this.getTextBounds(shape as TextShape);
      bounds = { 
        x: shape.x, 
        y: shape.y, 
        width: textBounds.width, 
        height: textBounds.height 
      };
    } else if (shape.type === 'circle') {
      bounds = {
        x: shape.x,
        y: shape.y,
        width: shape.radius * 2,
        height: shape.radius * 2,
      };
    } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
      const xs = shape.points.map(p => p.x);
      const ys = shape.points.map(p => p.y);
      bounds = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    } else {
      return null;
    }

    // Convert to screen coordinates
    const topLeft = this.worldToScreen({ x: bounds.x, y: bounds.y });
    const bottomRight = this.worldToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
    const center = this.worldToScreen({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
      centerX: center.x,
      centerY: center.y,
    };
  }

  // Hit testing
  hitTest(point: Point, shape?: Shape): Shape | null {
    const worldPoint = this.screenToWorld(point);
    
    // If checking a specific shape
    if (shape) {
      return this.isPointInShape(worldPoint, shape) ? shape : null;
    }

    // Check all shapes in reverse order (top to bottom)
    const shapes = Array.from(this.state.shapes.values()).reverse();
    for (const shape of shapes) {
      if (this.isPointInShape(worldPoint, shape)) {
        return shape;
      }
    }
    return null;
  }

  private isPointInShape(point: Point, shape: Shape): boolean {
    switch (shape.type) {
      case 'rectangle':
        return (
          point.x >= shape.x &&
          point.x <= shape.x + shape.width &&
          point.y >= shape.y &&
          point.y <= shape.y + shape.height
        );
      case 'circle':
        const dx = point.x - (shape.x + shape.radius);
        const dy = point.y - (shape.y + shape.radius);
        return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
      case 'line':
      case 'arrow':
      case 'freehand':
        // Check if point is near any line segment
        const points = shape.points;
        for (let i = 0; i < points.length - 1; i++) {
          if (this.isPointNearLine(point, points[i], points[i + 1], 5)) {
            return true;
          }
        }
        return false;
      case 'text':
        return (
          point.x >= shape.x &&
          point.x <= shape.x + shape.width &&
          point.y >= shape.y &&
          point.y <= shape.y + shape.height
        );
      case 'image':
        return (
          point.x >= shape.x &&
          point.x <= shape.x + shape.width &&
          point.y >= shape.y &&
          point.y <= shape.y + shape.height
        );
      default:
        return false;
    }
  }

  private isPointNearLine(point: Point, lineStart: Point, lineEnd: Point, threshold: number): boolean {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx: number, yy: number;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  }

  // Resize handle detection
  getResizeHandleAt(point: Point, shape: Shape): ResizeHandle | null {
    if (!this.canvas || !this.ctx) return null;

    const handleSizeWorld = this.HANDLE_SIZE / this.state.viewport.zoom;
    const halfHandleSize = handleSizeWorld / 2;

    let bounds: { x: number; y: number; width: number; height: number };

    if (shape.type === 'rectangle' || shape.type === 'image') {
      bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    } else if (shape.type === 'text') {
      // For text shapes, use actual text bounds for handle detection
      const textBounds = this.getTextBounds(shape as TextShape);
      bounds = { 
        x: shape.x, 
        y: shape.y, 
        width: textBounds.width, 
        height: textBounds.height 
      };
    } else if (shape.type === 'circle') {
      bounds = {
        x: shape.x,
        y: shape.y,
        width: shape.radius * 2,
        height: shape.radius * 2,
      };
    } else {
      return null; // Only rectangles, images, circles, and text have resize handles
    }

    // For images, only check corner handles
    const isImageShape = shape.type === 'image';
    const handles: { [key in ResizeHandle]: Point } = {
      topLeft: { x: bounds.x, y: bounds.y },
      topRight: { x: bounds.x + bounds.width, y: bounds.y },
      bottomLeft: { x: bounds.x, y: bounds.y + bounds.height },
      bottomRight: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      top: { x: bounds.x + bounds.width / 2, y: bounds.y },
      bottom: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
      left: { x: bounds.x, y: bounds.y + bounds.height / 2 },
      right: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
    };

    const worldPoint = this.screenToWorld(point);

    // Only check corner handles for images
    const handlesToCheck = isImageShape 
      ? ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as ResizeHandle[]
      : (Object.keys(handles) as ResizeHandle[]);

    for (const handleName of handlesToCheck) {
      const handlePos = handles[handleName];
      if (
        worldPoint.x >= handlePos.x - halfHandleSize &&
        worldPoint.x <= handlePos.x + halfHandleSize &&
        worldPoint.y >= handlePos.y - halfHandleSize &&
        worldPoint.y <= handlePos.y + halfHandleSize
      ) {
        return handleName as ResizeHandle;
      }
    }
    return null;
  }

  resizeShape(shape: Shape, handle: ResizeHandle, newWorldPoint: Point, initialBounds: { x: number, y: number, width: number, height: number }, initialFontSize?: number) {
    const minSize = 10 / this.state.viewport.zoom; // Minimum size in world units

    let newX = initialBounds.x;
    let newY = initialBounds.y;
    let newWidth = initialBounds.width;
    let newHeight = initialBounds.height;
    let newRadius = (shape as CircleShape).radius;

    if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image') {
      switch (handle) {
        case 'topLeft':
          newWidth = initialBounds.x + initialBounds.width - newWorldPoint.x;
          newHeight = initialBounds.y + initialBounds.height - newWorldPoint.y;
          newX = newWorldPoint.x;
          newY = newWorldPoint.y;
          break;
        case 'topRight':
          newWidth = newWorldPoint.x - initialBounds.x;
          newHeight = initialBounds.y + initialBounds.height - newWorldPoint.y;
          newY = newWorldPoint.y;
          break;
        case 'bottomLeft':
          newWidth = initialBounds.x + initialBounds.width - newWorldPoint.x;
          newHeight = newWorldPoint.y - initialBounds.y;
          newX = newWorldPoint.x;
          break;
        case 'bottomRight':
          newWidth = newWorldPoint.x - initialBounds.x;
          newHeight = newWorldPoint.y - initialBounds.y;
          break;
        case 'top':
          newHeight = initialBounds.y + initialBounds.height - newWorldPoint.y;
          newY = newWorldPoint.y;
          break;
        case 'bottom':
          newHeight = newWorldPoint.y - initialBounds.y;
          break;
        case 'left':
          newWidth = initialBounds.x + initialBounds.width - newWorldPoint.x;
          newX = newWorldPoint.x;
          break;
        case 'right':
          newWidth = newWorldPoint.x - initialBounds.x;
          break;
      }

      // Ensure minimum size
      if (newWidth < minSize) {
        newWidth = minSize;
        if (handle === 'topLeft' || handle === 'bottomLeft' || handle === 'left') {
          newX = initialBounds.x + initialBounds.width - minSize;
        }
      }
      if (newHeight < minSize) {
        newHeight = minSize;
        if (handle === 'topLeft' || handle === 'topRight' || handle === 'top') {
          newY = initialBounds.y + initialBounds.height - minSize;
        }
      }

      // For images, maintain aspect ratio when resizing from corners
      if (shape.type === 'image') {
        const isCornerHandle = handle === 'topLeft' || handle === 'topRight' || 
                              handle === 'bottomLeft' || handle === 'bottomRight';
        
        if (isCornerHandle) {
          // Calculate aspect ratio from initial bounds
          const aspectRatio = initialBounds.width / initialBounds.height;
          
          // Calculate the distance from the opposite corner to the new mouse position
          let oppositeX: number, oppositeY: number;
          if (handle === 'topLeft') {
            oppositeX = initialBounds.x + initialBounds.width;
            oppositeY = initialBounds.y + initialBounds.height;
          } else if (handle === 'topRight') {
            oppositeX = initialBounds.x;
            oppositeY = initialBounds.y + initialBounds.height;
          } else if (handle === 'bottomLeft') {
            oppositeX = initialBounds.x + initialBounds.width;
            oppositeY = initialBounds.y;
          } else { // bottomRight
            oppositeX = initialBounds.x;
            oppositeY = initialBounds.y;
          }
          
          // Calculate the delta from opposite corner
          const deltaX = newWorldPoint.x - oppositeX;
          const deltaY = newWorldPoint.y - oppositeY;
          
          // Determine which dimension to use based on which changed more
          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);
          
          if (absDeltaX / aspectRatio > absDeltaY) {
            // Use width as primary dimension
            newWidth = absDeltaX;
            newHeight = newWidth / aspectRatio;
          } else {
            // Use height as primary dimension
            newHeight = absDeltaY;
            newWidth = newHeight * aspectRatio;
          }
          
          // Calculate new position based on handle
          if (handle === 'topLeft') {
            newX = oppositeX - newWidth;
            newY = oppositeY - newHeight;
          } else if (handle === 'topRight') {
            newX = oppositeX;
            newY = oppositeY - newHeight;
          } else if (handle === 'bottomLeft') {
            newX = oppositeX - newWidth;
            newY = oppositeY;
          } else { // bottomRight
            newX = oppositeX;
            newY = oppositeY;
          }
          
          // Ensure minimum size
          if (newWidth < minSize) {
            newWidth = minSize;
            newHeight = newWidth / aspectRatio;
            // Recalculate position
            if (handle === 'topLeft') {
              newX = oppositeX - newWidth;
              newY = oppositeY - newHeight;
            } else if (handle === 'topRight') {
              newX = oppositeX;
              newY = oppositeY - newHeight;
            } else if (handle === 'bottomLeft') {
              newX = oppositeX - newWidth;
              newY = oppositeY;
            }
          }
          if (newHeight < minSize) {
            newHeight = minSize;
            newWidth = newHeight * aspectRatio;
            // Recalculate position
            if (handle === 'topLeft') {
              newX = oppositeX - newWidth;
              newY = oppositeY - newHeight;
            } else if (handle === 'topRight') {
              newX = oppositeX;
              newY = oppositeY - newHeight;
            } else if (handle === 'bottomLeft') {
              newX = oppositeX - newWidth;
              newY = oppositeY;
            }
          }
        }
        
        // Update the image shape
        this.updateShape(shape.id, {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        }, false);
      } else if (shape.type === 'text') {
        const textShape = shape as TextShape;
        
        // Determine which dimension is being resized based on the handle
        const isWidthResize = handle === 'left' || handle === 'right' || 
                             handle === 'topLeft' || handle === 'topRight' || 
                             handle === 'bottomLeft' || handle === 'bottomRight';
        const isHeightOnlyResize = handle === 'top' || handle === 'bottom';
        
        if (isHeightOnlyResize && Math.abs(newWidth - initialBounds.width) < 1) {
          // Only height is changing (top/bottom handles) - scale font size proportionally
          const baseFontSize = initialFontSize !== undefined ? initialFontSize : (textShape.style.fontSize || 16);
          const heightRatio = newHeight / initialBounds.height;
          const newFontSize = Math.max(8, Math.min(200, baseFontSize * heightRatio));
          
          this.updateShape(shape.id, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
            style: {
              ...textShape.style,
              fontSize: newFontSize,
            },
          }, false);
        } else if (isWidthResize) {
          // Width is changing (left/right or corner handles)
          const isCornerHandle = handle === 'topLeft' || handle === 'topRight' || 
                                handle === 'bottomLeft' || handle === 'bottomRight';
          
          if (newWidth < initialBounds.width) {
            // Making smaller - auto-adjust height based on wrapping and clip text
              const calculatedHeight = this.calculateTextHeight(textShape.text, newWidth, textShape.style.fontSize || 16, textShape.style.fontFamily || 'Arial', textShape.style.fontWeight);
            this.updateShape(shape.id, {
              x: newX,
              y: newY,
              width: newWidth,
              height: calculatedHeight, // Auto-adjust height when making smaller
            }, false);
          } else {
            // Making bigger
            if (isCornerHandle) {
              // Corner handles - use dragged height (both width and height as dragged)
              this.updateShape(shape.id, {
                x: newX,
                y: newY,
                width: newWidth,
                height: newHeight, // Use dragged height from corner resize
              }, false);
            } else {
              // Edge handles (left/right) - height not affected, width can be any size
              this.updateShape(shape.id, {
                x: newX,
                y: newY,
                width: newWidth,
                height: newHeight, // Keep the dragged height, don't auto-adjust
              }, false);
            }
          }
        } else {
          // Fallback: update normally
          this.updateShape(shape.id, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          }, false);
        }
      } else {
        this.updateShape(shape.id, {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        }, false);
      }

    } else if (shape.type === 'circle') {
      // For circles, resize from center or corner to adjust radius
      const centerX = initialBounds.x + initialBounds.width / 2;
      const centerY = initialBounds.y + initialBounds.height / 2;
      newRadius = Math.max(minSize / 2, Math.sqrt(
        Math.pow(newWorldPoint.x - centerX, 2) +
        Math.pow(newWorldPoint.y - centerY, 2)
      ));
      this.updateShape(shape.id, {
        radius: newRadius,
        x: centerX - newRadius, // Adjust x, y to keep center
        y: centerY - newRadius,
      }, false);
    }
  }

  // History
  saveState() {
    this.state.history.past.push(this.state.history.present);
    this.state.history.present = this.getStateSnapshot();
    this.state.history.future = [];
    
    // Limit history size
    if (this.state.history.past.length > 50) {
      this.state.history.past.shift();
    }
  }

  canUndo(): boolean {
    return this.state.history.past.length > 0;
  }

  canRedo(): boolean {
    return this.state.history.future.length > 0;
  }

  undo() {
    if (this.state.history.past.length === 0) return;
    
    this.state.history.future.unshift(this.state.history.present);
    this.state.history.present = this.state.history.past.pop()!;
    this.restoreState(this.state.history.present);
  }

  redo() {
    if (this.state.history.future.length === 0) return;
    
    this.state.history.past.push(this.state.history.present);
    this.state.history.present = this.state.history.future.shift()!;
    this.restoreState(this.state.history.present);
  }

  private getStateSnapshot(): CanvasState {
    // Create a snapshot without the history to avoid circular references
    // The history structure itself manages the snapshots
    return {
      shapes: new Map(this.state.shapes),
      selectedIds: new Set(this.state.selectedIds),
      viewport: { ...this.state.viewport },
      history: {
        past: [],
        present: {
          shapes: new Map(this.state.shapes),
          selectedIds: new Set(this.state.selectedIds),
          viewport: { ...this.state.viewport },
          history: {} as any, // Placeholder to satisfy type
        },
        future: [],
      },
    };
  }

  private restoreState(state: CanvasState) {
    this.state.shapes = new Map(state.shapes);
    this.state.selectedIds = new Set(state.selectedIds);
    this.state.viewport = { ...state.viewport };
    this.render();
  }

  // Rendering
  render(excludeShapeId?: string) {
    if (!this.canvas || !this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);

    // Apply viewport transform
    this.ctx.save();
    this.ctx.translate(this.state.viewport.x, this.state.viewport.y);
    this.ctx.scale(this.state.viewport.zoom, this.state.viewport.zoom);

    // Draw grid - disabled for plain background
    // this.drawGrid();

    // Draw shapes
    const shapes = Array.from(this.state.shapes.values());
    for (const shape of shapes) {
      if (shape.visible !== false && shape.id !== excludeShapeId) {
        this.drawShape(shape);
      }
    }

    // Draw selection
    const selectedShapes = Array.from(this.state.selectedIds)
      .map(id => this.state.shapes.get(id))
      .filter((shape): shape is Shape => shape !== undefined);
    
    if (selectedShapes.length === 0) {
      // No selection
    } else if (selectedShapes.length === 1) {
      // Single selection - draw individual selection box
      this.drawSelection(selectedShapes[0]);
    } else {
      // Multiple selections - draw combined bounding box
      this.drawGroupSelection(selectedShapes);
    }

    this.ctx.restore();
  }

  private drawGrid() {
    if (!this.ctx) return;
    
    const gridSize = 20;
    const bounds = this.getVisibleBounds();
    
    this.ctx.strokeStyle = '#2a2a2a';
    this.ctx.lineWidth = 1 / this.state.viewport.zoom;
    
    // Vertical lines
    const startX = Math.floor(bounds.minX / gridSize) * gridSize;
    const endX = Math.ceil(bounds.maxX / gridSize) * gridSize;
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, bounds.minY);
      this.ctx.lineTo(x, bounds.maxY);
      this.ctx.stroke();
    }
    
    // Horizontal lines
    const startY = Math.floor(bounds.minY / gridSize) * gridSize;
    const endY = Math.ceil(bounds.maxY / gridSize) * gridSize;
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(bounds.minX, y);
      this.ctx.lineTo(bounds.maxX, y);
      this.ctx.stroke();
    }
  }

  private getVisibleBounds() {
    if (!this.canvas) return { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
    
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;
    
    return {
      minX: (0 - this.state.viewport.x) / this.state.viewport.zoom,
      maxX: (width - this.state.viewport.x) / this.state.viewport.zoom,
      minY: (0 - this.state.viewport.y) / this.state.viewport.zoom,
      maxY: (height - this.state.viewport.y) / this.state.viewport.zoom,
    };
  }

  private drawShape(shape: Shape) {
    if (!this.ctx) return;

    this.ctx.save();

    // Apply style
    if (shape.style.fill) {
      this.ctx.fillStyle = shape.style.fill;
    }
    if (shape.style.stroke) {
      this.ctx.strokeStyle = shape.style.stroke;
    }
    this.ctx.lineWidth = (shape.style.strokeWidth || 2) / this.state.viewport.zoom;
    this.ctx.globalAlpha = shape.style.opacity ?? 1;

    // Apply rotation
      if (shape.rotation) {
      let centerX = shape.x;
      let centerY = shape.y;
      if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image') {
        centerX = shape.x + shape.width / 2;
        centerY = shape.y + shape.height / 2;
      } else if (shape.type === 'circle') {
        centerX = shape.x + shape.radius;
        centerY = shape.y + shape.radius;
      } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
        // For lines, arrows, freehand - use first point or center of bounding box
        if (shape.points && shape.points.length > 0) {
          const xs = shape.points.map((p: Point) => p.x);
          const ys = shape.points.map((p: Point) => p.y);
          centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
          centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
        } else {
          centerX = (shape as LineShape | ArrowShape | FreehandShape).x;
          centerY = (shape as LineShape | ArrowShape | FreehandShape).y;
        }
      }
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate((shape.rotation * Math.PI) / 180);
      this.ctx.translate(-centerX, -centerY);
    }

    switch (shape.type) {
      case 'rectangle':
        const radius = shape.radius || 0;
        if (radius > 0) {
          // Draw rounded rectangle
          this.ctx.beginPath();
          this.ctx.moveTo(shape.x + radius, shape.y);
          this.ctx.lineTo(shape.x + shape.width - radius, shape.y);
          this.ctx.arc(shape.x + shape.width - radius, shape.y + radius, radius, -Math.PI / 2, 0);
          this.ctx.lineTo(shape.x + shape.width, shape.y + shape.height - radius);
          this.ctx.arc(shape.x + shape.width - radius, shape.y + shape.height - radius, radius, 0, Math.PI / 2);
          this.ctx.lineTo(shape.x + radius, shape.y + shape.height);
          this.ctx.arc(shape.x + radius, shape.y + shape.height - radius, radius, Math.PI / 2, Math.PI);
          this.ctx.lineTo(shape.x, shape.y + radius);
          this.ctx.arc(shape.x + radius, shape.y + radius, radius, Math.PI, -Math.PI / 2);
          this.ctx.closePath();
          this.ctx.fill();
          if (shape.style.stroke) {
            this.ctx.stroke();
          }
        } else {
          // Draw regular rectangle
          this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
          if (shape.style.stroke) {
            this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
          }
        }
        break;

      case 'circle':
        this.ctx.beginPath();
        this.ctx.arc(shape.x + shape.radius, shape.y + shape.radius, shape.radius, 0, Math.PI * 2);
        this.ctx.fill();
        if (shape.style.stroke) {
          this.ctx.stroke();
        }
        break;

      case 'line':
      case 'arrow':
      case 'freehand':
        this.drawPath(shape.points);
        if (shape.type === 'arrow' && shape.points.length >= 2) {
          this.drawArrowhead(shape.points[shape.points.length - 2], shape.points[shape.points.length - 1]);
        }
        break;

      case 'text':
        this.drawTextWithWrapping(shape as TextShape);
        break;

      case 'image':
        this.drawImage(shape as ImageShape);
        break;
    }

    this.ctx.restore();
  }

  private drawImage(shape: ImageShape) {
    if (!this.ctx) return;

    const img = new Image();
    img.onload = () => {
      if (!this.ctx) return;
      this.ctx.save();
      this.ctx.globalAlpha = shape.style.opacity ?? 1;
      this.ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
      this.ctx.restore();
      // Re-render after image loads
      this.render();
    };
    img.onerror = () => {
      console.error('Failed to load image:', shape.src);
    };
    img.src = shape.src;
    
    // Draw immediately if image is already loaded
    if (img.complete) {
      this.ctx.save();
      this.ctx.globalAlpha = shape.style.opacity ?? 1;
      this.ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
      this.ctx.restore();
    }
  }

  private drawPath(points: Point[]) {
    if (!this.ctx || points.length < 2) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.stroke();
  }

  // Calculate text height based on wrapped text (character by character)
  calculateTextHeight(text: string, maxWidth: number, fontSize: number, fontFamily: string, fontWeight?: string): number {
    if (!this.ctx) return fontSize * 1.2;
    
    this.ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily}`;
    const lineHeight = fontSize * 1.2;
    
    const lines: string[] = [];
    let currentLine = '';
    
    // Wrap character by character
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const testLine = currentLine + char;
      const metrics = this.ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine.length > 0) {
        // Current line is full, start a new line
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return Math.max(fontSize * 1.2, lines.length * lineHeight);
  }

  // Get text lines wrapped character by character
  private getTextLines(shape: TextShape): string[] {
    if (!this.ctx) return [];
    
    const fontSize = shape.style.fontSize || 16;
    const fontFamily = shape.style.fontFamily || 'Arial';
    let fontWeight = shape.style.fontWeight || 'normal';
    // Convert "Regular" to "normal" for CSS compatibility
    if (fontWeight === 'Regular') {
      fontWeight = 'normal';
    }
    this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const maxWidth = shape.width;
    
    const lines: string[] = [];
    let currentLine = '';
    
    // Wrap character by character
    for (let i = 0; i < shape.text.length; i++) {
      const char = shape.text[i];
      const testLine = currentLine + char;
      const metrics = this.ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine.length > 0) {
        // Current line is full, start a new line
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : [''];
  }

  // Get actual text bounds based on wrapped text
  // When width is bigger than text needs, return shape bounds (not clipped)
  // When width is smaller, return wrapped text bounds (clipped)
  private getTextBounds(shape: TextShape): { width: number; height: number } {
    if (!this.ctx) return { width: shape.width, height: shape.height };
    
    const fontSize = shape.style.fontSize || 16;
    const fontFamily = shape.style.fontFamily || 'Arial';
    let fontWeight = shape.style.fontWeight || 'normal';
    // Convert "Regular" to "normal" for CSS compatibility
    if (fontWeight === 'Regular') {
      fontWeight = 'normal';
    }
    this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const lineHeight = fontSize * 1.2;
    
    // Calculate unwrapped text width (single line)
    const unwrappedWidth = this.ctx.measureText(shape.text).width;
    
    // If shape width is bigger than unwrapped text, use shape bounds (not clipped)
    if (shape.width >= unwrappedWidth) {
      return { width: shape.width, height: shape.height };
    }
    
    // Otherwise, calculate wrapped text bounds (clipped)
    const lines = this.getTextLines(shape);
    
    // Calculate actual width (max line width, but not exceeding shape width)
    let maxLineWidth = 0;
    for (const line of lines) {
      const metrics = this.ctx.measureText(line);
      maxLineWidth = Math.max(maxLineWidth, metrics.width);
    }
    
    // Actual width is the max line width (clipped to shape width)
    const actualWidth = Math.min(maxLineWidth, shape.width);
    
    // Actual height is based on number of lines
    const actualHeight = Math.max(fontSize * 1.2, lines.length * lineHeight);
    
    return { width: actualWidth, height: actualHeight };
  }

  // Draw text with character-by-character wrapping
  private drawTextWithWrapping(shape: TextShape) {
    if (!this.ctx) return;
    
    this.ctx.save();
    
    // Set up clipping region to ensure text stays within bounds
    this.ctx.beginPath();
    this.ctx.rect(shape.x, shape.y, shape.width, shape.height);
    this.ctx.clip();
    
    // Build font string with weight
    const fontSize = shape.style.fontSize || 16;
    const fontFamily = shape.style.fontFamily || 'Arial';
    let fontWeight = shape.style.fontWeight || 'normal';
    // Convert "Regular" to "normal" for CSS compatibility
    if (fontWeight === 'Regular') {
      fontWeight = 'normal';
    }
    this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    
    // Set text alignment
    const textAlign = shape.style.textAlign || 'left';
    this.ctx.textAlign = textAlign as CanvasTextAlign;
    
    const lineHeight = fontSize * 1.2;
    const lines = this.getTextLines(shape);
    
    // Draw each line
    let y = shape.y + fontSize;
    for (const line of lines) {
      // Only draw if line is within bounds
      if (y <= shape.y + shape.height) {
        // Calculate x position based on alignment
        let x = shape.x;
        if (textAlign === 'center') {
          x = shape.x + shape.width / 2;
        } else if (textAlign === 'right') {
          x = shape.x + shape.width;
        } else if (textAlign === 'justify') {
          x = shape.x;
          // For justify, we'd need to adjust spacing, but for now use left alignment
          this.ctx.textAlign = 'left';
        }
        
        this.ctx.fillText(line, x, y);
        
        // Restore textAlign for justify
        if (textAlign === 'justify') {
          this.ctx.textAlign = textAlign as CanvasTextAlign;
        }
      }
      y += lineHeight;
    }
    
    this.ctx.restore(); // Restore clipping region
  }

  private drawArrowhead(start: Point, end: Point) {
    if (!this.ctx) return;
    
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowLength = 15 / this.state.viewport.zoom;
    const arrowAngle = Math.PI / 6;
    
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - arrowLength * Math.cos(angle - arrowAngle),
      end.y - arrowLength * Math.sin(angle - arrowAngle)
    );
    this.ctx.lineTo(
      end.x - arrowLength * Math.cos(angle + arrowAngle),
      end.y - arrowLength * Math.sin(angle + arrowAngle)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawSelection(shape: Shape) {
    if (!this.ctx) return;

    this.ctx.save();
    
    // Use consistent purple dashed style for all shapes
    this.ctx.strokeStyle = '#8b5cf6'; // Purple for all shapes
    this.ctx.lineWidth = 2 / this.state.viewport.zoom;
    this.ctx.setLineDash([5 / this.state.viewport.zoom, 5 / this.state.viewport.zoom]);

    let bounds: { x: number; y: number; width: number; height: number };

    switch (shape.type) {
      case 'rectangle':
        bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        break;
      case 'text':
        // For text shapes, use actual text bounds (wrapped text dimensions)
        const textBounds = this.getTextBounds(shape as TextShape);
        bounds = { 
          x: shape.x, 
          y: shape.y, 
          width: textBounds.width, 
          height: textBounds.height 
        };
        break;
      case 'circle':
        bounds = {
          x: shape.x,
          y: shape.y,
          width: shape.radius * 2,
          height: shape.radius * 2,
        };
        break;
      case 'line':
      case 'arrow':
      case 'freehand':
        const xs = shape.points.map((p: Point) => p.x);
        const ys = shape.points.map((p: Point) => p.y);
        bounds = {
          x: Math.min(...xs) - 5,
          y: Math.min(...ys) - 5,
          width: Math.max(...xs) - Math.min(...xs) + 10,
          height: Math.max(...ys) - Math.min(...ys) + 10,
        };
        break;
      case 'image':
        bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        break;
      default:
        return;
    }

    this.ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
    this.ctx.restore();

    // Draw resize handles for rectangles, circles, text, and images
    if (shape.type === 'rectangle' || shape.type === 'circle' || shape.type === 'text' || shape.type === 'image') {
      const isImageShape = shape.type === 'image';
      this.drawResizeHandles(bounds, false, isImageShape); // Use consistent style for all shapes
    }
  }

  private drawGroupSelection(shapes: Shape[]) {
    if (!this.ctx || shapes.length === 0) return;

    // Calculate combined bounding box for all selected shapes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of shapes) {
      let bounds: { x: number; y: number; width: number; height: number };
      
      if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image') {
        if (shape.type === 'text') {
          const textBounds = this.getTextBounds(shape as TextShape);
          bounds = {
            x: shape.x,
            y: shape.y,
            width: textBounds.width,
            height: textBounds.height,
          };
        } else {
          bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        }
      } else if (shape.type === 'circle') {
        bounds = {
          x: shape.x,
          y: shape.y,
          width: shape.radius * 2,
          height: shape.radius * 2,
        };
      } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
        const xs = shape.points.map((p: Point) => p.x);
        const ys = shape.points.map((p: Point) => p.y);
        bounds = {
          x: Math.min(...xs) - 5,
          y: Math.min(...ys) - 5,
          width: Math.max(...xs) - Math.min(...xs) + 10,
          height: Math.max(...ys) - Math.min(...ys) + 10,
        };
      } else {
        continue;
      }

      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    if (minX === Infinity) return;

    const groupBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    // Draw group selection box
    this.ctx.save();
    this.ctx.strokeStyle = '#8b5cf6'; // Purple for all shapes
    this.ctx.lineWidth = 2 / this.state.viewport.zoom;
    this.ctx.setLineDash([5 / this.state.viewport.zoom, 5 / this.state.viewport.zoom]);
    this.ctx.strokeRect(groupBounds.x - 2, groupBounds.y - 2, groupBounds.width + 4, groupBounds.height + 4);
    this.ctx.restore();

    // Draw resize handles for group selection
    this.drawResizeHandles(groupBounds, false, false);
  }

  getGroupBounds(shapes: Shape[]): { x: number; y: number; width: number; height: number } | null {
    if (shapes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of shapes) {
      let bounds: { x: number; y: number; width: number; height: number };
      
      if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image') {
        if (shape.type === 'text') {
          const textBounds = this.getTextBounds(shape as TextShape);
          bounds = {
            x: shape.x,
            y: shape.y,
            width: textBounds.width,
            height: textBounds.height,
          };
        } else {
          bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        }
      } else if (shape.type === 'circle') {
        bounds = {
          x: shape.x,
          y: shape.y,
          width: shape.radius * 2,
          height: shape.radius * 2,
        };
      } else if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
        const xs = shape.points.map((p: Point) => p.x);
        const ys = shape.points.map((p: Point) => p.y);
        bounds = {
          x: Math.min(...xs) - 5,
          y: Math.min(...ys) - 5,
          width: Math.max(...xs) - Math.min(...xs) + 10,
          height: Math.max(...ys) - Math.min(...ys) + 10,
        };
      } else {
        continue;
      }

      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    if (minX === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  getGroupResizeHandleAt(point: Point, shapes: Shape[]): ResizeHandle | null {
    if (!this.canvas || !this.ctx || shapes.length === 0) return null;

    const groupBounds = this.getGroupBounds(shapes);
    if (!groupBounds) return null;

    const handleSizeWorld = this.HANDLE_SIZE / this.state.viewport.zoom;
    const halfHandleSize = handleSizeWorld / 2;

    const handles: { [key in ResizeHandle]: Point } = {
      topLeft: { x: groupBounds.x, y: groupBounds.y },
      topRight: { x: groupBounds.x + groupBounds.width, y: groupBounds.y },
      bottomLeft: { x: groupBounds.x, y: groupBounds.y + groupBounds.height },
      bottomRight: { x: groupBounds.x + groupBounds.width, y: groupBounds.y + groupBounds.height },
      top: { x: groupBounds.x + groupBounds.width / 2, y: groupBounds.y },
      bottom: { x: groupBounds.x + groupBounds.width / 2, y: groupBounds.y + groupBounds.height },
      left: { x: groupBounds.x, y: groupBounds.y + groupBounds.height / 2 },
      right: { x: groupBounds.x + groupBounds.width, y: groupBounds.y + groupBounds.height / 2 },
    };

    const worldPoint = this.screenToWorld(point);

    for (const handleName of Object.keys(handles) as ResizeHandle[]) {
      const handlePos = handles[handleName];
      if (
        worldPoint.x >= handlePos.x - halfHandleSize &&
        worldPoint.x <= handlePos.x + halfHandleSize &&
        worldPoint.y >= handlePos.y - halfHandleSize &&
        worldPoint.y <= handlePos.y + halfHandleSize
      ) {
        return handleName as ResizeHandle;
      }
    }
    return null;
  }

  resizeGroup(shapes: Shape[], handle: ResizeHandle, newWorldPoint: Point, initialBounds: { x: number, y: number, width: number, height: number }) {
    const minSize = 10 / this.state.viewport.zoom;
    
    let newX = initialBounds.x;
    let newY = initialBounds.y;
    let newWidth = initialBounds.width;
    let newHeight = initialBounds.height;

    // Calculate new group bounds based on handle
    switch (handle) {
      case 'topLeft':
        newWidth = initialBounds.x + initialBounds.width - newWorldPoint.x;
        newHeight = initialBounds.y + initialBounds.height - newWorldPoint.y;
        newX = newWorldPoint.x;
        newY = newWorldPoint.y;
        break;
      case 'topRight':
        newWidth = newWorldPoint.x - initialBounds.x;
        newHeight = initialBounds.y + initialBounds.height - newWorldPoint.y;
        newY = newWorldPoint.y;
        break;
      case 'bottomLeft':
        newWidth = initialBounds.x + initialBounds.width - newWorldPoint.x;
        newHeight = newWorldPoint.y - initialBounds.y;
        newX = newWorldPoint.x;
        break;
      case 'bottomRight':
        newWidth = newWorldPoint.x - initialBounds.x;
        newHeight = newWorldPoint.y - initialBounds.y;
        break;
      case 'top':
        newHeight = initialBounds.y + initialBounds.height - newWorldPoint.y;
        newY = newWorldPoint.y;
        break;
      case 'bottom':
        newHeight = newWorldPoint.y - initialBounds.y;
        break;
      case 'left':
        newWidth = initialBounds.x + initialBounds.width - newWorldPoint.x;
        newX = newWorldPoint.x;
        break;
      case 'right':
        newWidth = newWorldPoint.x - initialBounds.x;
        break;
    }

    // Ensure minimum size
    if (newWidth < minSize) {
      newWidth = minSize;
      if (handle === 'topLeft' || handle === 'bottomLeft' || handle === 'left') {
        newX = initialBounds.x + initialBounds.width - minSize;
      }
    }
    if (newHeight < minSize) {
      newHeight = minSize;
      if (handle === 'topLeft' || handle === 'topRight' || handle === 'top') {
        newY = initialBounds.y + initialBounds.height - minSize;
      }
    }

    // Calculate scale factors
    const scaleX = newWidth / initialBounds.width;
    const scaleY = newHeight / initialBounds.height;
    const offsetX = newX - initialBounds.x;
    const offsetY = newY - initialBounds.y;

    // Apply transformation to all shapes
    for (const shape of shapes) {
      // Calculate shape's position relative to group bounds
      let shapeBounds: { x: number; y: number; width: number; height: number };
      
      if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'image') {
        if (shape.type === 'text') {
          const textBounds = this.getTextBounds(shape as TextShape);
          shapeBounds = {
            x: shape.x,
            y: shape.y,
            width: textBounds.width,
            height: textBounds.height,
          };
        } else {
          shapeBounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        }
      } else if (shape.type === 'circle') {
        shapeBounds = {
          x: shape.x,
          y: shape.y,
          width: shape.radius * 2,
          height: shape.radius * 2,
        };
      } else {
        continue; // Skip lines, arrows, freehand for now
      }

      const relX = shapeBounds.x - initialBounds.x;
      const relY = shapeBounds.y - initialBounds.y;

      // Apply scale and offset
      if (shape.type === 'rectangle' || shape.type === 'image') {
        this.updateShape(shape.id, {
          x: initialBounds.x + relX * scaleX + offsetX,
          y: initialBounds.y + relY * scaleY + offsetY,
          width: shapeBounds.width * scaleX,
          height: shapeBounds.height * scaleY,
        }, false);
      } else if (shape.type === 'text') {
        const textShape = shape as TextShape;
        const newFontSize = (textShape.style.fontSize || 16) * Math.min(scaleX, scaleY);
        this.updateShape(shape.id, {
          x: initialBounds.x + relX * scaleX + offsetX,
          y: initialBounds.y + relY * scaleY + offsetY,
          width: shapeBounds.width * scaleX,
          height: shapeBounds.height * scaleY,
          style: {
            ...textShape.style,
            fontSize: newFontSize,
          },
        }, false);
      } else if (shape.type === 'circle') {
        const newRadius = (shape.radius * Math.min(scaleX, scaleY));
        this.updateShape(shape.id, {
          x: initialBounds.x + relX * scaleX + offsetX,
          y: initialBounds.y + relY * scaleY + offsetY,
          radius: newRadius,
        }, false);
      }
    }
  }

  moveGroup(shapes: Shape[], deltaX: number, deltaY: number) {
    for (const shape of shapes) {
      this.updateShape(shape.id, {
        x: shape.x + deltaX,
        y: shape.y + deltaY,
      }, false);
    }
  }

  private drawResizeHandles(bounds: { x: number; y: number; width: number; height: number }, isTextShape = false, cornersOnly = false) {
    if (!this.ctx) return;

    const handleSize = this.HANDLE_SIZE / this.state.viewport.zoom;
    const halfHandleSize = handleSize / 2;

    this.ctx.save();
    // Use consistent purple color for all shapes
    this.ctx.fillStyle = '#8b5cf6';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1 / this.state.viewport.zoom;
    this.ctx.setLineDash([]); // Clear dashed line for handles

    // For images, only show corner handles
    const handles = cornersOnly ? [
      { x: bounds.x, y: bounds.y }, // topLeft
      { x: bounds.x + bounds.width, y: bounds.y }, // topRight
      { x: bounds.x, y: bounds.y + bounds.height }, // bottomLeft
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // bottomRight
    ] : [
      { x: bounds.x, y: bounds.y }, // topLeft
      { x: bounds.x + bounds.width, y: bounds.y }, // topRight
      { x: bounds.x, y: bounds.y + bounds.height }, // bottomLeft
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // bottomRight
      { x: bounds.x + bounds.width / 2, y: bounds.y }, // top
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }, // bottom
      { x: bounds.x, y: bounds.y + bounds.height / 2 }, // left
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, // right
    ];

    handles.forEach(handle => {
      this.ctx?.fillRect(handle.x - halfHandleSize, handle.y - halfHandleSize, handleSize, handleSize);
      this.ctx?.strokeRect(handle.x - halfHandleSize, handle.y - halfHandleSize, handleSize, handleSize);
    });

    this.ctx.restore();
  }

  // Serialization
  serialize(): string {
    return JSON.stringify({
      shapes: Array.from(this.state.shapes.entries()),
      viewport: this.state.viewport,
    });
  }

  deserialize(data: string) {
    try {
      const parsed = JSON.parse(data);
      this.state.shapes = new Map(parsed.shapes);
      if (parsed.viewport) {
        this.state.viewport = parsed.viewport;
      }
      this.render();
    } catch (error) {
      console.error('Failed to deserialize canvas state:', error);
    }
  }

  // Get current state (for React state updates)
  getState(): CanvasState {
    return {
      shapes: new Map(this.state.shapes),
      selectedIds: new Set(this.state.selectedIds),
      viewport: { ...this.state.viewport },
      history: this.state.history,
    };
  }
}

