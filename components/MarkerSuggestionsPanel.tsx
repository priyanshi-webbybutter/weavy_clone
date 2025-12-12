interface MarkedPoint {
  id: string;
  number: number;
  shapeId: string;
  imageId: string;
  normalizedX: number;
  normalizedY: number;
  timestamp: number;
  objectName: string | null;
  isAnalyzing: boolean;
}

interface MarkerSuggestionsPanelProps {
  marker: MarkedPoint;
  position: { x: number; y: number };
  onClose: () => void;
  onSelectSuggestion: (suggestion: any) => void;
  onDelete: (markerId: string) => void;
}

export function MarkerSuggestionsPanel({
  marker,
  position,
  onClose,
  onDelete,
}: MarkerSuggestionsPanelProps) {
  return (
    <div
      className="absolute z-50 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl p-3 min-w-[250px] max-w-[300px]"
      style={{ left: position.x, top: position.y + 20 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
            {marker.number}
          </div>
          <span className="text-sm font-medium text-gray-300">Detected Object</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Delete Button */}
          <button
            onClick={() => onDelete(marker.id)}
            className="text-red-400 hover:text-red-300 text-sm transition-colors"
            title="Delete marker"
          >
            Delete
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Object Name Display */}
      {marker.isAnalyzing ? (
        <div className="mb-4 p-3 bg-gray-500/10 border border-gray-500/30 rounded-md">
          <div className="flex items-center gap-2 text-gray-400">
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm">Analyzing...</span>
          </div>
        </div>
      ) : marker.objectName ? (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
          <div className="text-xs text-blue-400 mb-1 uppercase tracking-wide">Object</div>
          <div className="text-xl font-bold text-white capitalize">{marker.objectName}</div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
          <div className="text-sm text-red-400">Analysis failed</div>
        </div>
      )}

      {/* Footer with coordinates */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-500">
          <div className="flex justify-between items-center">
            <span>Position:</span>
            <span className="font-mono">
              [{marker.normalizedX.toFixed(4)}, {marker.normalizedY.toFixed(4)}]
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span>Scale:</span>
            <span className="font-mono">[0.0, 1.0]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
