# Image Marker Placement and Analysis System Documentation

## Overview
This document explains how the marker placement and image analysis functionality works in the canvas application.

---

## Part 1: How Markers Are Placed on Images

### User Interaction Flow

1. **Tool Selection**: User selects the "Add Mark" tool from the toolbar
2. **Image Click**: User clicks on an image in the canvas
3. **Coordinate Capture**: Click coordinates are captured and processed
4. **Marker Creation**: A visual marker is created and placed on the image
5. **Analysis Trigger**: The marker point is automatically sent for AI analysis

### Technical Implementation

**File**: `components/CanvasCanvas.tsx`

#### Step 1: Click Detection (lines ~1536-1555)

When the user clicks on an image with the "Add Mark" tool active:

```typescript
// Get next marker number for this image
const markerNumber = markedPoints.filter(p => p.imageId === imageShape.id).length + 1;

// Calculate normalized coordinates (0-1000 scale)
const interestX = Math.round(((clickWorldX - imageShape.x) / imageShape.width) * 1000);
const interestY = Math.round(((clickWorldY - imageShape.y) / imageShape.height) * 1000);
```

**Key Points:**
- Click coordinates are converted from screen → world → normalized coordinates
- Normalized coordinates are on a [0, 1000] scale relative to the image
- This allows markers to stay positioned correctly even if the image is resized/moved

#### Step 2: Marker Shape Creation (lines ~1555-1571)

A red circular marker is created:

```typescript
const markerDot: CircleShape = {
  id: `marker-${Date.now()}-${markerNumber}`,
  type: 'circle',
  x: clickWorldX - 5,
  y: clickWorldY - 5,
  radius: 5,
  style: { fill: '#ef4444', stroke: '#dc2626' },
  locked: true,  // Prevents accidental editing
  // ...
}
```

#### Step 3: Marker Metadata Storage (lines ~1572-1586)

Marker data is stored with both world and normalized coordinates:

```typescript
const newMarker: MarkedPoint = {
  id: markerDot.id,
  number: markerNumber,
  shapeId: markerDot.id,
  imageId: imageShape.id,
  worldPosition: { x: clickWorldX, y: clickWorldY },
  normalizedPosition: [interestY, interestX],  // [y, x] format
  timestamp: Date.now()
};

// Add to canvas and state
engineRef.current.addShape(markerDot);
setMarkedPoints(prev => [...prev, newMarker]);
```

#### Step 4: Position Synchronization (lines ~150-163)

Markers automatically update when their parent image is moved/resized:

```typescript
const updateMarkersForImage = (imageId: string) => {
  const imageMarkers = markedPoints.filter(m => m.imageId === imageId);

  imageMarkers.forEach(marker => {
    const x = imageShape.x + (marker.normalizedX * imageShape.width);
    const y = imageShape.y + (marker.normalizedY * imageShape.height);
    engineRef.current?.updateShape(marker.shapeId, { x, y }, false);
  });
};
```

---

## Part 2: How Images Are Analyzed After Placing a Marker

### Analysis Flow

1. **Trigger**: `analyzeMarkerPoint()` is called immediately after marker placement
2. **Data Preparation**: Image is converted to base64, coordinates are prepared
3. **API Request**: Data is sent to backend `/analyze-point` endpoint
4. **AI Processing**: Gemini AI analyzes the image at the specified coordinates
5. **Results Return**: Object name and detailed detection data are returned
6. **UI Update**: Marker is updated with analysis results

### Technical Implementation

**Frontend**: `components/CanvasCanvas.tsx` (lines ~1405-1495)

#### Step 1: Prepare Analysis Request

```typescript
const analyzeMarkerPoint = async (marker: MarkedPoint) => {
  // Get the parent image shape
  const imageShape = engineRef.current.getShape(marker.imageId) as ImageShape;

  // Convert image to base64
  const img = await loadImage(imageShape.src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const image_base64 = canvas.toDataURL('image/png').split(',')[1];
```

#### Step 2: Send API Request

```typescript
const response = await fetch('/api/analyze-point', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: marker.id,
    image_base64,
    point: marker.normalizedPosition,  // [y, x] in [0, 1000]
    lang: 'en'
  })
});
```

**Backend**: `backend/routes/analyze-point.js`

#### Phase 1: Simple Object Name (lines ~46-77)

Fast, reliable object identification:

```javascript
// Use Gemini 2.0 Flash model
const simpleModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp'
});

const normalizedY = point[0] / 1000;  // Convert to [0, 1]
const normalizedX = point[1] / 1000;

const simplePrompt = `Analyze this image. What is the single, most prominent
object or feature located at the normalized coordinates [${normalizedY}, ${normalizedX}]?
Return only the name of the object or feature, nothing else.`;

const simpleResult = await simpleModel.generateContent([
  { inlineData: { mimeType: 'image/png', data: image_base64 } },
  simplePrompt
]);

objectName = simpleResponse.text().trim();  // e.g., "sunglasses"
```

#### Phase 2: Detailed Analysis with Bounding Boxes (lines ~79-197)

Structured detection with priority system:

```javascript
// Configure model with JSON schema for structured output
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          kind: { type: 'string' },
          priority_index: { type: 'number' },
          bbox: { /* x, y, width, height */ }
        }
      }
    }
  }
});
```

**Priority Detection System** (lines ~119-136):

The AI is instructed to prioritize certain objects:
1. Glasses/sunglasses
2. Hats
3. Bottles
4. Hands
5. Faces
6. Text/letters
7. Watches
8. Jewelry
9. Buttons
10. Zippers
11. Logos
12. Labels

Objects in this list get `priority_index: 1`, others get `priority_index: 999`.

#### Step 3: Validation & Filtering (lines ~232-271)

Bounding boxes are validated to ensure they contain the clicked point:

```javascript
// Check if clicked point is inside the bounding box
const pointX = clickedPointNormalized[1];  // x coordinate
const pointY = clickedPointNormalized[0];  // y coordinate

const TOLERANCE = 0.1;  // 100 pixel tolerance for AI inaccuracy

const isInside = (
  pointX >= bbox.x - TOLERANCE &&
  pointX <= bbox.x + bbox.width + TOLERANCE &&
  pointY >= bbox.y - TOLERANCE &&
  pointY <= bbox.y + bbox.height + TOLERANCE
);

// Filter out invalid detections
const validSuggestions = suggestions.filter(s => isInside);
```

#### Step 4: Sorting & Response (lines ~273-327)

Results are sorted by priority, then by bounding box size:

```javascript
validSuggestions.sort((a, b) => {
  // 1. Sort by priority index (lower = higher priority)
  if (a.priority_index !== b.priority_index) {
    return a.priority_index - b.priority_index;
  }

  // 2. Fallback to bbox area (smaller = more specific)
  const areaA = a.bbox.width * a.bbox.height;
  const areaB = b.bbox.width * b.bbox.height;
  return areaA - areaB;
});

// Return hybrid response
res.json({
  id,
  point,
  objectName,           // Simple name from Phase 1
  suggestions          // Detailed structure from Phase 2
});
```

### Frontend: Display Results

**File**: `components/MarkerSuggestionsPanel.tsx`

#### Simple Object Display (lines ~66-97)

Primary display shows the simple object name:

```tsx
{marker.objectName ? (
  <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
    <div className="text-xs text-blue-400 mb-1 uppercase">Object</div>
    <div className="text-xl font-bold text-white capitalize">
      {marker.objectName}
    </div>
  </div>
) : (
  <div className="flex items-center gap-2 text-gray-400">
    <LoadingSpinner />
    <span>Analyzing...</span>
  </div>
)}
```

#### Detailed Results (lines ~100-133)

Collapsible section shows detailed detections:

```tsx
{marker.detectionResults && marker.detectionResults.length > 0 && (
  <details>
    <summary>Detailed Analysis ({marker.detectionResults.length})</summary>
    <div className="space-y-1 mt-2">
      {marker.detectionResults.map((result, idx) => (
        <button onClick={() => onSelectSuggestion(result)}>
          <div className="text-sm font-medium">{result.label}</div>
          <div className="text-xs text-gray-500">{result.kind}</div>
        </button>
      ))}
    </div>
  </details>
)}
```

---

## Key Data Structures

### MarkedPoint Interface
```typescript
interface MarkedPoint {
  id: string;
  number: number;              // Sequential number per image
  shapeId: string;             // Canvas shape ID
  imageId: string;             // Parent image ID
  worldPosition: { x: number; y: number };
  normalizedPosition: [number, number];  // [y, x] in [0, 1000]
  objectName?: string;         // Simple name from AI
  detectionResults?: {         // Detailed analysis
    label: string;
    kind: string;
    bbox: { x, y, width, height };
  }[];
  timestamp: number;
}
```

### API Response Format
```json
{
  "id": "marker-id",
  "point": [500, 300],
  "objectName": "sunglasses",
  "suggestions": [
    {
      "label": "sunglasses",
      "kind": "object",
      "priority_index": 1,
      "bbox": { "x": 0.25, "y": 0.35, "width": 0.15, "height": 0.08 }
    },
    {
      "label": "face",
      "kind": "object",
      "priority_index": 5,
      "bbox": { "x": 0.2, "y": 0.3, "width": 0.3, "height": 0.4 }
    }
  ]
}
```

---

## Critical Files

1. **components/CanvasCanvas.tsx** - Main canvas component with marker placement logic
2. **backend/routes/analyze-point.js** - API endpoint for AI analysis
3. **components/MarkerSuggestionsPanel.tsx** - UI for displaying analysis results
4. **lib/canvas/CanvasEngine.ts** - Canvas rendering engine (marker rendering logic)

---

## Summary

### Marker Placement Process
1. Click on image with "Add Mark" tool active
2. Calculate normalized coordinates (0-1000 scale relative to image)
3. Create red circle marker at click position
4. Store metadata (world position + normalized position)
5. Automatically trigger AI analysis

### Image Analysis Process
1. Convert image to base64 format
2. Send image + coordinates to backend API
3. Gemini AI analyzes in 2 phases:
   - **Phase 1**: Fast simple object name
   - **Phase 2**: Detailed detections with bounding boxes
4. Validate bounding boxes contain clicked point
5. Sort by priority index and bbox size
6. Return simple name + detailed detections
7. Update UI with analysis results

### Key Features
- **Normalized Coordinates**: Markers stay positioned correctly when images are resized/moved
- **Hybrid AI Approach**: Simple names for speed + detailed analysis for precision
- **Priority Detection**: 12 priority object types (glasses, hats, bottles, text, etc.)
- **Bounding Box Validation**: Ensures accurate detection by filtering invalid results
- **Event System**: Cross-component communication for marker updates and deletion

---

## API Endpoint

**POST /api/analyze-point**

Request:
```json
{
  "id": "marker-id",
  "image_base64": "base64-encoded-image-data",
  "point": [500, 300],  // [y, x] in [0, 1000]
  "lang": "en"
}
```

Response:
```json
{
  "id": "marker-id",
  "point": [500, 300],
  "objectName": "sunglasses",
  "suggestions": [
    {
      "label": "sunglasses",
      "kind": "object",
      "priority_index": 1,
      "bbox": { "x": 0.25, "y": 0.35, "width": 0.15, "height": 0.08 }
    }
  ]
}
```
