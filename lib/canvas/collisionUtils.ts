/**
 * Collision detection utilities for canvas shape placement
 */

import { Shape, Point, CircleShape } from './types';

/**
 * Represents a rectangle bounding box
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Gets the bounding box for any shape type
 * @param shape - The shape to get bounds for
 * @returns Rectangle bounding box containing the shape
 */
export function getShapeBounds(shape: Shape): Rect {
  switch (shape.type) {
    case 'rectangle':
    case 'image':
    case 'text':
      return {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height
      };

    case 'circle':
      const circleShape = shape as CircleShape;
      return {
        x: circleShape.x,
        y: circleShape.y,
        width: circleShape.radius * 2,
        height: circleShape.radius * 2,
      };

    case 'line':
    case 'arrow':
    case 'freehand':
      // Type assertion needed for shapes with points
      const shapeWithPoints = shape as { points: Point[]; x: number; y: number };
      if (!shapeWithPoints.points || shapeWithPoints.points.length === 0) {
        return { x: shape.x, y: shape.y, width: 0, height: 0 };
      }

      const xs = shapeWithPoints.points.map(p => p.x);
      const ys = shapeWithPoints.points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };

    default:
      // Fallback for unknown shape types
      return { x: (shape as any).x || 0, y: (shape as any).y || 0, width: 0, height: 0 };
  }
}

/**
 * Checks if two rectangles overlap (includes touching edges as overlap)
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns true if rectangles overlap, false otherwise
 */
export function rectsOverlap(rect1: Rect, rect2: Rect): boolean {
  return !(
    rect1.x + rect1.width <= rect2.x ||  // rect1 is left of rect2
    rect2.x + rect2.width <= rect1.x ||  // rect2 is left of rect1
    rect1.y + rect1.height <= rect2.y || // rect1 is above rect2
    rect2.y + rect2.height <= rect1.y    // rect2 is above rect1
  );
}

/**
 * Checks if a rectangle overlaps with any shapes in the list
 * @param candidateRect - Rectangle to test for collisions
 * @param shapes - List of shapes to check against
 * @param excludeIds - Optional shape IDs to exclude from collision check (e.g., placeholder being replaced)
 * @param buffer - Optional buffer distance to add around shapes (default 10px)
 * @returns true if collision detected, false if clear
 */
export function hasCollision(
  candidateRect: Rect,
  shapes: Shape[],
  excludeIds: string[] = [],
  buffer: number = 10
): boolean {
  for (const shape of shapes) {
    // Skip excluded shapes
    if (excludeIds.includes(shape.id)) continue;

    // Skip invisible shapes
    if (shape.visible === false) continue;

    // Get shape bounds and add buffer
    const shapeBounds = getShapeBounds(shape);
    const bufferedBounds: Rect = {
      x: shapeBounds.x - buffer,
      y: shapeBounds.y - buffer,
      width: shapeBounds.width + (buffer * 2),
      height: shapeBounds.height + (buffer * 2),
    };

    if (rectsOverlap(candidateRect, bufferedBounds)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates the center point of a rectangle
 * @param rect - Rectangle to get center of
 * @returns Center point {x, y}
 */
export function getRectCenter(rect: Rect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

/**
 * Calculates Euclidean distance between two points
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance between points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Expands a rectangle by a margin on all sides
 * @param rect - Rectangle to expand
 * @param margin - Margin to add on all sides
 * @returns Expanded rectangle
 */
export function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + (margin * 2),
    height: rect.height + (margin * 2),
  };
}
