import { useEffect, useRef } from 'react';
import { MarkerResult, Detection } from './MarkerResultChip';
import { Loader2 } from 'lucide-react';

interface MarkerChipWithDropdownProps {
  marker: MarkerResult;
  allMarkers: MarkerResult[];
  isSelected: boolean;
  isDropdownOpen: boolean;
  onToggleDropdown: (markerId: string) => void;
  onSelectMarker: (markerId: string, detectionIndex?: number) => void;
  onRemoveMarker: (markerId: string) => void;
}

export function MarkerChipWithDropdown({
  marker,
  allMarkers,
  isSelected,
  isDropdownOpen,
  onToggleDropdown,
  onSelectMarker,
  onRemoveMarker
}: MarkerChipWithDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggleDropdown(''); // Close dropdown
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen, onToggleDropdown]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Chip Container */}
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
          isSelected
            ? 'bg-purple-600 border-purple-500'
            : 'bg-[#1a1a1a] border-blue-500/50'
        } border hover:border-purple-500`}
      >
        {/* Clickable area for dropdown toggle */}
        <div
          onClick={() => onToggleDropdown(marker.markerId)}
          className="flex items-center gap-2 flex-1 cursor-pointer"
        >
          {/* Marker Number Badge */}
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
            {marker.markerNumber}
          </div>

          {/* Label */}
          <span className="text-sm font-medium text-white">
            {marker.label}
          </span>

          {/* Loading Spinner or Chevron Icon */}
          {marker.isLoading ? (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          ) : (
            <svg
              className={`w-4 h-4 text-white transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveMarker(marker.markerId);
          }}
          className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
          aria-label="Remove marker"
        >
          ×
        </button>
      </div>

      {/* Dropdown Menu - Show loading state or detections */}
      {isDropdownOpen && (
        <div className="absolute z-50 mt-2 w-64 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl">
          <div className="p-2">
            {marker.isLoading ? (
              <div className="flex items-center gap-2 px-2 py-3">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-sm text-gray-400">Analyzing...</span>
              </div>
            ) : marker.detections && marker.detections.length > 0 ? (
              <>
                <div className="text-xs text-gray-400 mb-2 px-2">
                  Detected objects at marker #{marker.markerNumber}:
                </div>
                <ul className="space-y-1">
                  {marker.detections.map((detection, index) => {
                    const isSelected = index === (marker.selectedDetectionIndex ?? 0);
                    return (
                      <li
                        key={index}
                        onClick={() => {
                          onSelectMarker(marker.markerId, index);
                          onToggleDropdown(''); // Close dropdown
                        }}
                        className={`p-2 rounded-md cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-purple-600/20 font-semibold'
                            : 'hover:bg-[#2a2a2a]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              detection.priority_index === 1 ? 'bg-green-500' :
                              detection.priority_index < 10 ? 'bg-blue-500' : 'bg-gray-500'
                            }`} />
                            <span className="text-sm text-white capitalize">{detection.label}</span>
                          </div>
                          <span className="text-xs text-gray-500">{detection.kind}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <div className="px-2 py-3 text-sm text-gray-400">
                No detections found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
