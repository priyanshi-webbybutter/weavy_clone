import React from 'react';
import { Arrow } from '@/lib/arrows/Arrow';
import { Point } from '@/lib/arrows/types';
import { Shape, ImageShape } from '@/lib/canvas/types';

interface CanvasArrowsProps {
  shapes: Shape[];
  viewport: { x: number; y: number; zoom: number };
  updateTrigger?: number;
  isSelecting?: boolean;
}

export const CanvasArrows: React.FC<CanvasArrowsProps> = ({ shapes, viewport, updateTrigger, isSelecting }) => {
  // Extract all image shapes with generation metadata
  const generatedImages = shapes.filter(
    s => s.type === 'image' && (s as ImageShape).generationMetadata?.referenceImageIds
  ) as ImageShape[];

  // Build array of arrow connections
  const arrowConnections = generatedImages.flatMap(targetImage => {
    const refIds = targetImage.generationMetadata?.referenceImageIds || [];
    const referenceImages = shapes.filter(
      s => s.type === 'image' && refIds.includes(s.id)
    ) as ImageShape[];

    return referenceImages.map((refImage, index) => ({
      id: `arrow-${refImage.id}-${targetImage.id}`,
      sourceImage: refImage,
      targetImage: targetImage,
      arrowIndex: index
    }));
  });

  // Convert canvas coordinates to screen coordinates
  const toScreenCoords = (x: number, y: number): Point => ({
    x: x * viewport.zoom + viewport.x,
    y: y * viewport.zoom + viewport.y
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {arrowConnections.map(({ id, sourceImage, targetImage, arrowIndex }) => {
        // Calculate edge-to-edge points
        const { startPoint, endPoint } = calculateEdgeToEdgePoints(
          sourceImage,
          targetImage,
          arrowIndex
        );

        // Convert to screen coordinates
        const screenStart = toScreenCoords(startPoint.x, startPoint.y);
        const screenEnd = toScreenCoords(endPoint.x, endPoint.y);

        return (
          <Arrow
            key={id}
            startPoint={screenStart}
            endPoint={screenEnd}
            config={{
              arrowColor: '#ff6b6b',         // Match current red color
              strokeWidth: 2,
              arrowHeadEndingSize: 12,
              dotEndingRadius: 4,
              dotEndingBackground: '#ff6b6b',
              hoverableLineWidth: 20
            }}
            tooltip={`Reference → Generated`}
            disablePointerEvents={isSelecting}
          />
        );
      })}
    </div>
  );
};

// Helper function - calculate edge-to-edge connection points
function calculateEdgeToEdgePoints(
  sourceImage: ImageShape,
  targetImage: ImageShape,
  arrowIndex: number
): { startPoint: Point; endPoint: Point } {
  const sourceBounds = {
    left: sourceImage.x,
    right: sourceImage.x + sourceImage.width,
    top: sourceImage.y,
    bottom: sourceImage.y + sourceImage.height,
    centerX: sourceImage.x + sourceImage.width / 2,
    centerY: sourceImage.y + sourceImage.height / 2
  };

  const targetBounds = {
    left: targetImage.x,
    right: targetImage.x + targetImage.width,
    top: targetImage.y,
    bottom: targetImage.y + targetImage.height,
    centerX: targetImage.x + targetImage.width / 2,
    centerY: targetImage.y + targetImage.height / 2
  };

  const dx = targetBounds.centerX - sourceBounds.centerX;
  const dy = targetBounds.centerY - sourceBounds.centerY;

  let startPoint: Point;
  let endPoint: Point;

  const offset = arrowIndex * 15;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal
    if (dx > 0) {
      startPoint = { x: sourceBounds.right, y: sourceBounds.centerY + offset };
      endPoint = { x: targetBounds.left, y: targetBounds.centerY + offset };
    } else {
      startPoint = { x: sourceBounds.left, y: sourceBounds.centerY + offset };
      endPoint = { x: targetBounds.right, y: targetBounds.centerY + offset };
    }
  } else {
    // Vertical
    if (dy > 0) {
      startPoint = { x: sourceBounds.centerX + offset, y: sourceBounds.bottom };
      endPoint = { x: targetBounds.centerX + offset, y: targetBounds.top };
    } else {
      startPoint = { x: sourceBounds.centerX + offset, y: sourceBounds.top };
      endPoint = { x: targetBounds.centerX + offset, y: targetBounds.bottom };
    }
  }

  return { startPoint, endPoint };
}
