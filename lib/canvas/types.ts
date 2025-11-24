// lib/canvas/types.ts

export type ShapeType = 'rectangle' | 'circle' | 'line' | 'text' | 'arrow' | 'freehand';

export interface Point {
  x: number;
  y: number;
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string; // e.g., 'normal', 'bold', '100', '200', etc.
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  rotation?: number;
  style: ShapeStyle;
  locked?: boolean;
  visible?: boolean;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
  radius?: number; // Corner radius for rounded rectangles
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  radius: number;
}

export interface LineShape extends BaseShape {
  type: 'line';
  points: Point[];
}

export interface TextShape extends BaseShape {
  type: 'text';
  width: number;
  height: number;
  text: string;
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  points: Point[];
}

export interface FreehandShape extends BaseShape {
  type: 'freehand';
  points: Point[];
}

export type Shape = RectangleShape | CircleShape | LineShape | TextShape | ArrowShape | FreehandShape;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasState {
  shapes: Map<string, Shape>;
  selectedIds: Set<string>;
  viewport: Viewport;
  history: {
    past: CanvasState[];
    present: CanvasState;
    future: CanvasState[];
  };
}

export type Tool = 'select' | 'rectangle' | 'circle' | 'line' | 'text' | 'arrow' | 'freehand' | 'pan';

