interface CanvasPreviewProps {
  images?: string[];
}

export default function CanvasPreview({ images = [] }: CanvasPreviewProps) {
  if (images.length === 0) {
    // Fallback to icon
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
        <path d="M8 6h8M8 12h8M8 18h8M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round"/>
      </svg>
    );
  }

  if (images.length === 1) {
    // Single full image
    return (
      <img
        src={images[0]}
        alt="Canvas preview"
        className="w-full h-full object-cover rounded"
      />
    );
  }

  if (images.length === 2) {
    // Side-by-side 50/50
    return (
      <div className="w-full h-full flex gap-1">
        <img src={images[0]} alt="Preview 1" className="w-1/2 h-full object-cover rounded" />
        <img src={images[1]} alt="Preview 2" className="w-1/2 h-full object-cover rounded" />
      </div>
    );
  }

  if (images.length === 3) {
    // Left large + Right stacked
    return (
      <div className="w-full h-full flex gap-1">
        <img src={images[0]} alt="Preview 1" className="w-1/2 h-full object-cover rounded" />
        <div className="w-1/2 h-full flex flex-col gap-1">
          <img src={images[1]} alt="Preview 2" className="w-full h-1/2 object-cover rounded" />
          <img src={images[2]} alt="Preview 3" className="w-full h-1/2 object-cover rounded" />
        </div>
      </div>
    );
  }

  // 4 or more images - 2x2 grid
  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1">
      <img src={images[0]} alt="Preview 1" className="w-full h-full object-cover rounded" />
      <img src={images[1]} alt="Preview 2" className="w-full h-full object-cover rounded" />
      <img src={images[2]} alt="Preview 3" className="w-full h-full object-cover rounded" />
      <img src={images[3]} alt="Preview 4" className="w-full h-full object-cover rounded" />
    </div>
  );
}
