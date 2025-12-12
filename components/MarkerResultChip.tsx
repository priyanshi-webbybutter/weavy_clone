import React, { useState, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';

export interface Detection {
  label: string;
  kind: string;
  priority_index: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface MarkerResult {
  markerId: string;
  markerNumber: number;
  label: string;
  imageUrl: string;
  markerPosition: { x: number; y: number };
  zoomRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  detections?: Detection[]; // All detected objects from this marker
  selectedDetectionIndex?: number; // Currently selected detection (default 0)
}

interface MarkerResultChipProps {
  marker: MarkerResult;
  onRemove: (markerId: string) => void;
  isLoading?: boolean;
}

// Convert bbox from {x, y, width, height} to [x1, y1, x2, y2]
function convertBboxToCorners(bbox: { x: number; y: number; width: number; height: number }): number[] {
  const x1 = bbox.x;
  const y1 = bbox.y;
  const x2 = bbox.x + bbox.width;
  const y2 = bbox.y + bbox.height;
  return [x1, y1, x2, y2];
}

export function MarkerResultChip({ marker, onRemove, isLoading }: MarkerResultChipProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Convert bbox to [x1, y1, x2, y2] format
  const bboxCorners = useMemo(() => {
    if (!marker.zoomRegion) return null;
    return convertBboxToCorners(marker.zoomRegion);
  }, [marker.zoomRegion]);

  // Format coordinates for display
  const coordsDisplay = useMemo(() => {
    if (!bboxCorners) return null;
    return `[${bboxCorners.map(c => c.toFixed(3)).join(', ')}]`;
  }, [bboxCorners]);

  // Calculate zoom transform based on marker position and zoom region
  const zoomTransform = useMemo(() => {
    if (isLoading) return null;

    const { markerPosition, zoomRegion } = marker;

    // If zoom region provided, use it for precise zooming
    if (zoomRegion) {
      const centerX = zoomRegion.x + zoomRegion.width / 2;
      const centerY = zoomRegion.y + zoomRegion.height / 2;
      const zoomLevel = 3.5; // 3.5x zoom

      return {
        scale: zoomLevel,
        translateX: -(centerX - 0.5) * 100 * zoomLevel,
        translateY: -(centerY - 0.5) * 100 * zoomLevel
      };
    }

    // Fallback: zoom to marker position
    const zoomLevel = 3;
    return {
      scale: zoomLevel,
      translateX: -(markerPosition.x - 0.5) * 100 * zoomLevel,
      translateY: -(markerPosition.y - 0.5) * 100 * zoomLevel
    };
  }, [marker, isLoading]);

  return (
    <div className="relative inline-flex flex-col gap-1">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-blue-500/50 rounded-full">
        {/* Marker Number Icon */}
        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
          {isLoading ? '·' : marker.markerNumber}
        </div>

        {/* Label Text */}
        <span className="text-sm text-white font-medium">
          {isLoading ? 'Analyzing...' : marker.label}
        </span>

        {/* Loading Spinner or Image Thumbnail */}
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        ) : (
          <div className="relative">
            <div
              className="relative w-8 h-8 rounded overflow-hidden cursor-pointer"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <img
                src={marker.imageUrl}
                alt={marker.label}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Hover Zoom Overlay */}
            {isHovered && zoomTransform && (
              <div className="absolute -top-20 -right-2 w-32 h-32 rounded-lg overflow-hidden border-2 border-blue-500 shadow-2xl z-50 bg-black pointer-events-none">
                <img
                  src={marker.imageUrl}
                  alt={marker.label}
                  className="w-full h-full object-cover transition-transform duration-200"
                  style={{
                    transform: `scale(${zoomTransform.scale}) translate(${zoomTransform.translateX}%, ${zoomTransform.translateY}%)`,
                    transformOrigin: 'center center'
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={() => onRemove(marker.markerId)}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Remove marker"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
