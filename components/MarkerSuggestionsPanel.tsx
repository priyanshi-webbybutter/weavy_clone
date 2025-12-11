interface MarkedPoint {
  id: string;
  number: number;
  shapeId: string;
  imageId: string;
  worldPosition: { x: number; y: number };
  normalizedPosition: [number, number];
  detectionResults?: {
    label: string;
    kind: string;
    bbox: { x: number; y: number; width: number; height: number };
  }[];
  timestamp: number;
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
  onSelectSuggestion,
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
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
            {marker.number}
          </div>
          <span className="text-sm font-medium text-gray-300">Detected Objects</span>
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

      {/* Detection Results */}
      {marker.detectionResults && marker.detectionResults.length > 0 ? (
        <div className="space-y-1">
          {marker.detectionResults.map((result, idx) => (
            <button
              key={idx}
              onClick={() => onSelectSuggestion(result)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#2a2a2a] rounded-md transition-colors text-left"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{result.label}</div>
                <div className="text-xs text-gray-500">{result.kind}</div>
              </div>
              {idx === 0 && (
                <svg
                  className="w-4 h-4 text-green-500 flex-shrink-0 ml-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-500 py-6">
          <svg
            className="w-8 h-8 mb-2 animate-spin"
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
      )}

      {/* Footer with coordinates */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="text-xs text-gray-500">
          <div className="flex justify-between items-center">
            <span>Position:</span>
            <span className="font-mono">
              [{marker.normalizedPosition[0]}, {marker.normalizedPosition[1]}]
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span>Scale:</span>
            <span className="font-mono">[0, 1000]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
