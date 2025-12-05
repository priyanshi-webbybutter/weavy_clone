/**
 * Smart placement algorithm for generated images and placeholders
 */

import { Shape, Point } from './types';
import {
  Rect,
  getShapeBounds,
  hasCollision,
  getRectCenter,
  distance,
} from './collisionUtils';

/**
 * Configuration for placement algorithm
 */
export interface PlacementConfig {
  /** Minimum gap between shapes (default: 50) */
  minGap: number;
  /** Preferred gap for primary positions (default: 80) */
  preferredGap: number;
  /** Maximum search iterations before fallback (default: 50) */
  maxIterations: number;
  /** Spiral search step size (default: 100) */
  spiralStep: number;
}

const DEFAULT_CONFIG: PlacementConfig = {
  minGap: 50,
  preferredGap: 80,
  maxIterations: 50,
  spiralStep: 100,
};

/**
 * Represents a candidate placement position with priority score
 */
interface PlacementCandidate {
  rect: Rect;
  score: number; // Lower is better
  type: 'adjacent' | 'diagonal' | 'spiral' | 'fallback';
}

/**
 * Finds optimal placement for a new shape on the canvas
 *
 * @param itemWidth - Width of item to place
 * @param itemHeight - Height of item to place
 * @param allShapes - All shapes currently on canvas
 * @param referenceShapes - Selected reference shapes (empty if no selection)
 * @param existingPlaceholderIds - IDs of placeholders to exclude from collision
 * @param config - Placement configuration
 * @returns Optimal {x, y} position
 */
export function findOptimalPlacement(
  itemWidth: number,
  itemHeight: number,
  allShapes: Shape[],
  referenceShapes: Shape[] = [],
  existingPlaceholderIds: string[] = [],
  config: Partial<PlacementConfig> = {}
): Point {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Case 1: Empty canvas - place at origin
  if (allShapes.length === 0) {
    return { x: 100, y: 100 };
  }

  // Case 2: Has reference shapes - try near references
  if (referenceShapes.length > 0) {
    const result = findNearReferences(
      itemWidth,
      itemHeight,
      allShapes,
      referenceShapes,
      existingPlaceholderIds,
      cfg
    );
    if (result) return result;
  }

  // Case 3: No references or all near-reference positions blocked
  // Use spiral search from canvas center or rightmost content
  return findSpiralPlacement(
    itemWidth,
    itemHeight,
    allShapes,
    existingPlaceholderIds,
    cfg
  );
}

/**
 * Phase 1 & 2: Find placement near reference shapes
 */
function findNearReferences(
  itemWidth: number,
  itemHeight: number,
  allShapes: Shape[],
  referenceShapes: Shape[],
  excludeIds: string[],
  config: PlacementConfig
): Point | null {
  const candidates: PlacementCandidate[] = [];

  // Calculate reference center for distance scoring
  const referenceBounds = referenceShapes.map(getShapeBounds);
  const referenceCenter = getAverageCenter(referenceBounds);

  // Try each reference shape
  for (const refShape of referenceShapes) {
    const refBounds = getShapeBounds(refShape);

    // Phase 1: Adjacent positions (right, below, left, above)
    const adjacentPositions = [
      // Right (highest priority)
      {
        x: refBounds.x + refBounds.width + config.preferredGap,
        y: refBounds.y,
        priority: 1
      },
      // Below (second priority)
      {
        x: refBounds.x,
        y: refBounds.y + refBounds.height + config.preferredGap,
        priority: 2
      },
      // Left (third priority - less natural)
      {
        x: refBounds.x - itemWidth - config.preferredGap,
        y: refBounds.y,
        priority: 3
      },
      // Above (fourth priority)
      {
        x: refBounds.x,
        y: refBounds.y - itemHeight - config.preferredGap,
        priority: 4
      },
    ];

    // Phase 2: Diagonal positions
    const diagonalPositions = [
      // Bottom-right
      {
        x: refBounds.x + refBounds.width + config.preferredGap,
        y: refBounds.y + refBounds.height + config.preferredGap,
        priority: 5
      },
      // Top-right
      {
        x: refBounds.x + refBounds.width + config.preferredGap,
        y: refBounds.y - itemHeight - config.preferredGap,
        priority: 6
      },
      // Bottom-left
      {
        x: refBounds.x - itemWidth - config.preferredGap,
        y: refBounds.y + refBounds.height + config.preferredGap,
        priority: 7
      },
      // Top-left
      {
        x: refBounds.x - itemWidth - config.preferredGap,
        y: refBounds.y - itemHeight - config.preferredGap,
        priority: 8
      },
    ];

    // Test all positions
    const allPositions = [...adjacentPositions, ...diagonalPositions];

    for (const pos of allPositions) {
      const candidateRect: Rect = {
        x: pos.x,
        y: pos.y,
        width: itemWidth,
        height: itemHeight,
      };

      // Check collision
      if (!hasCollision(candidateRect, allShapes, excludeIds, config.minGap)) {
        // Calculate score: priority + distance from reference center
        const center = getRectCenter(candidateRect);
        const dist = distance(center, referenceCenter);
        const score = pos.priority * 1000 + dist; // Priority weighs heavily

        candidates.push({
          rect: candidateRect,
          score: score,
          type: pos.priority <= 4 ? 'adjacent' : 'diagonal',
        });
      }
    }
  }

  // Return best candidate (lowest score)
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    return { x: candidates[0].rect.x, y: candidates[0].rect.y };
  }

  return null; // No collision-free position found near references
}

/**
 * Phase 3: Spiral search pattern expanding from starting point
 */
function findSpiralPlacement(
  itemWidth: number,
  itemHeight: number,
  allShapes: Shape[],
  excludeIds: string[],
  config: PlacementConfig
): Point {
  // Calculate starting point: center of existing content or rightmost edge
  const contentBounds = getContentBounds(allShapes);

  let startX: number, startY: number;

  if (contentBounds) {
    // Try right of rightmost content first
    startX = contentBounds.x + contentBounds.width + config.preferredGap;
    startY = contentBounds.y;
  } else {
    // Fallback to origin
    startX = 100;
    startY = 100;
  }

  // Try starting position first
  const startRect: Rect = { x: startX, y: startY, width: itemWidth, height: itemHeight };
  if (!hasCollision(startRect, allShapes, excludeIds, config.minGap)) {
    return { x: startX, y: startY };
  }

  // Spiral search pattern (right, down, left, up with increasing radius)
  let x = startX;
  let y = startY;
  const step = config.spiralStep;
  let iteration = 0;

  // Directions: right, down, left, up
  const directions = [
    { dx: 1, dy: 0 },  // right
    { dx: 0, dy: 1 },  // down
    { dx: -1, dy: 0 }, // left
    { dx: 0, dy: -1 }, // up
  ];

  while (iteration < config.maxIterations) {
    for (let dir = 0; dir < 4; dir++) {
      const steps = Math.ceil((iteration + 1) / 2); // Increase steps every 2 directions

      for (let i = 0; i < steps; i++) {
        x += directions[dir].dx * step;
        y += directions[dir].dy * step;

        const candidateRect: Rect = {
          x: x,
          y: y,
          width: itemWidth,
          height: itemHeight,
        };

        if (!hasCollision(candidateRect, allShapes, excludeIds, config.minGap)) {
          return { x, y };
        }
      }
    }

    iteration++;
  }

  // Phase 4: Fallback - guarantee placement far from all content
  return getFallbackPlacement(itemWidth, itemHeight, allShapes, config);
}

/**
 * Phase 4: Guaranteed fallback placement
 */
function getFallbackPlacement(
  itemWidth: number,
  itemHeight: number,
  allShapes: Shape[],
  config: PlacementConfig
): Point {
  const contentBounds = getContentBounds(allShapes);

  if (contentBounds) {
    // Place far to the right of all content
    return {
      x: contentBounds.x + contentBounds.width + config.preferredGap * 3,
      y: contentBounds.y,
    };
  }

  // Ultimate fallback
  return { x: 100, y: 100 };
}

/**
 * Helper: Get bounding box of all shapes
 */
function getContentBounds(shapes: Shape[]): Rect | null {
  if (shapes.length === 0) return null;

  const allBounds = shapes
    .filter(s => s.visible !== false)
    .map(getShapeBounds);

  if (allBounds.length === 0) return null;

  const minX = Math.min(...allBounds.map(b => b.x));
  const minY = Math.min(...allBounds.map(b => b.y));
  const maxX = Math.max(...allBounds.map(b => b.x + b.width));
  const maxY = Math.max(...allBounds.map(b => b.y + b.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Helper: Get average center point of multiple rectangles
 */
function getAverageCenter(rects: Rect[]): Point {
  if (rects.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;

  for (const rect of rects) {
    const center = getRectCenter(rect);
    sumX += center.x;
    sumY += center.y;
  }

  return {
    x: sumX / rects.length,
    y: sumY / rects.length,
  };
}

/**
 * Helper: Find placement for multiple items at once
 * Ensures they don't overlap each other
 *
 * @param itemsToPlace - Array of items with width/height to place
 * @param allShapes - All shapes currently on canvas
 * @param referenceShapes - Selected reference shapes
 * @param existingPlaceholderIds - IDs of placeholders to exclude
 * @param config - Placement configuration
 * @returns Array of {x, y} positions for each item
 */
export function findMultiPlacement(
  itemsToPlace: Array<{ width: number; height: number }>,
  allShapes: Shape[],
  referenceShapes: Shape[] = [],
  existingPlaceholderIds: string[] = [],
  config: Partial<PlacementConfig> = {}
): Point[] {
  const positions: Point[] = [];
  const tempShapes: Shape[] = [...allShapes];
  const excludeIds = [...existingPlaceholderIds];

  for (let i = 0; i < itemsToPlace.length; i++) {
    const item = itemsToPlace[i];

    // Find placement for this item
    const position = findOptimalPlacement(
      item.width,
      item.height,
      tempShapes,
      referenceShapes,
      excludeIds,
      config
    );

    positions.push(position);

    // Add this item as a temporary shape to avoid overlap with next items
    const tempId = `temp-placement-${i}`;
    tempShapes.push({
      id: tempId,
      type: 'rectangle',
      x: position.x,
      y: position.y,
      width: item.width,
      height: item.height,
      style: {},
      visible: true,
    } as any);

    excludeIds.push(tempId);
  }

  return positions;
}
