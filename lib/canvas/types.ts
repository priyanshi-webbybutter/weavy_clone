// lib/canvas/types.ts

export type ShapeType = 'rectangle' | 'circle' | 'line' | 'text' | 'arrow' | 'freehand' | 'image';

export interface Point {
  x: number;
  y: number;
}

export interface TextShadow {
  enabled?: boolean;
  color?: string;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
  angle?: number; // Angle in degrees for offset direction
  outlineWidth?: number;
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  lineDash?: number[]; // Dash pattern for lines/arrows: [dashLength, gapLength]
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string; // e.g., 'normal', 'bold', '100', '200', etc.
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  // Text-specific styles
  textShadow?: TextShadow;
  textBorder?: boolean; // Whether to show text border/outline
  textBorderColor?: string;
  textBorderWidth?: number;
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
  connectionMetadata?: {
    sourceImageId?: string;  // ID of the reference image (start point)
    targetImageId?: string;  // ID of the generated image (end point)
    arrowIndex?: number;     // Index for offset when multiple arrows connect same images
  };
}

export interface FreehandShape extends BaseShape {
  type: 'freehand';
  points: Point[];
}

export interface ImageShape extends BaseShape {
  type: 'image';
  width: number;
  height: number;
  src: string; // Image source URL or data URL
  generationMetadata?: {
    referenceImageIds?: string[]; // IDs of images used as references for generation
    generatedAt?: Date; // When this image was generated
    prompt?: string; // The prompt used to generate this image
  };
}

export type Shape = RectangleShape | CircleShape | LineShape | TextShape | ArrowShape | FreehandShape | ImageShape;

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

