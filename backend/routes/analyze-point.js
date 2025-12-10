const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/analyze-point', async (req, res) => {
  try {
    const { id, image_base64, point, lang = 'en' } = req.body;

    if (!image_base64 || !point || !Array.isArray(point) || point.length !== 2) {
      return res.status(400).json({
        error: 'Missing required fields: image_base64, point [y, x]'
      });
    }

    console.log(`🔍 Analyzing point [${point[0]}, ${point[1]}] in image`);

    // Configure Gemini model with strict JSON schema
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
              priority_index: {
                type: 'number',
                description: 'Priority of this object based on the ABSOLUTE PRIORITY list. Use 1 for highest priority, 2 for second highest, etc. Use 999 for objects not in the priority list.'
              },
              bbox: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' }
                },
                required: ['x', 'y', 'width', 'height']
              }
            },
            required: ['label', 'kind', 'priority_index', 'bbox']
          }
        }
      }
    });

    const prompt = `VISUAL GROUNDING TASK: Identify the object at EXACT pixel [${point[0]}, ${point[1]}] on a 1000x1000 normalized grid.

CRITICAL INSTRUCTION: Look at the PRECISE pixel location [${point[0]}, ${point[1]}]. What object is DIRECTLY UNDER that specific pixel?

ABSOLUTE PRIORITY LIST (THIS OVERRIDES GENERAL SPECIFICITY OR BBOX SIZE):
If the pixel is on any of these objects, it MUST be the FIRST item with priority_index=1:

PRIMARY OBJECTS (priority_index=1):
1. GLASSES (lens, frame, temple, even tiny reflections on lens) → "sunglasses" or "glasses"
2. HAT (brim, crown, band, even small logos on hat) → "hat"
3. BOTTLE (body, cap, label, even small brand text) → "bottle" or "perfume bottle"
4. HAND (fingers, palm, wrist, nails, rings, even fingertip) → "hand"
5. FACE (cheek, nose, forehead, but NOT glasses on face) → "face"
6. TEXT/LETTERS (any visible text, letters, numbers, logos, brand names) → "text" or specific text content
7. WATCH (watch face, strap, crown, even small details) → "watch"
8. JEWELRY (ring, bracelet, necklace, earring, even small gems) → specific jewelry type
9. BUTTON (clothing button, even tiny ones) → "button"
10. ZIPPER (zipper teeth, pull tab, even small parts) → "zipper"
11. LOGO (brand logo, emblem, symbol, even small ones) → "logo" or brand name
12. LABEL (product label, tag, even small text on labels) → "label"

IMPORTANT: Detect SMALL OBJECTS and FINE DETAILS. Even if an object is tiny (jewelry, buttons, text, small logos), you MUST detect it if the pixel is on it.

For objects NOT in the priority list above, use priority_index=999.

INCORRECT EXAMPLE (THIS IS WRONG):
❌ Pixel at [373, 559] on sunglasses lens → [{"label": "face", "priority_index": 1}, {"label": "person", "priority_index": 999}]
✅ Pixel at [373, 559] on sunglasses lens → [{"label": "sunglasses", "priority_index": 1}, {"label": "face", "priority_index": 999}]

CRITICAL BOUNDING BOX REQUIREMENT:
The clicked point is at coordinates [${point[0]/1000}, ${point[1]/1000}] in [0, 1] scale (where 0,0 is top-left).
This means x=${point[1]/1000}, y=${point[0]/1000}.

For EVERY object you detect, the bounding box MUST satisfy:
- bbox.x <= ${point[1]/1000} <= bbox.x + bbox.width
- bbox.y <= ${point[0]/1000} <= bbox.y + bbox.height

If the clicked point is NOT inside your bounding box, your detection is WRONG and will be rejected.
Draw the bounding box around the EXACT object instance that contains the clicked pixel.

DETECTION GUIDELINES:
- Look closely at the exact pixel - what is the SMALLEST object visible there?
- For text: detect individual letters, words, or brand names
- For small objects: detect buttons, zippers, jewelry, watch details, logos
- Be precise with bounding boxes - they should tightly fit the detected object
- Return multiple levels of detail (e.g., "text" → "shirt" → "person")

Return JSON array with up to 6 items, each with:
- label: object name at that pixel (lowercase, specific, can be text content like "nike" or "a")
- kind: "object" or "feature" or "text"
- priority_index: 1 for priority objects, 999 for others
- bbox: bounding box in [0, 1] normalized coordinates {x, y, width, height} that MUST contain point [${point[1]/1000}, ${point[0]/1000}]

Examples:
- Pixel on letter "N" in "NIKE" logo → [{"label": "nike", "kind": "text", "priority_index": 1}, {"label": "logo", "kind": "object", "priority_index": 1}, {"label": "shirt", "kind": "object", "priority_index": 999}]
- Pixel on small button → [{"label": "button", "kind": "object", "priority_index": 1}, {"label": "shirt", "kind": "object", "priority_index": 999}]
- Pixel on watch crown → [{"label": "watch", "kind": "object", "priority_index": 1}, {"label": "wrist", "kind": "object", "priority_index": 999}]`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/png',
          data: image_base64
        }
      },
      prompt
    ]);

    const response = await result.response;
    const text = response.text();
    let suggestions = JSON.parse(text);

    // Convert clicked point to [0, 1] normalized coordinates
    const clickedPointNormalized = [point[0] / 1000, point[1] / 1000]; // [y, x]
    console.log(`📍 Clicked point (normalized): [${clickedPointNormalized[0].toFixed(3)}, ${clickedPointNormalized[1].toFixed(3)}]`);

    // Log all suggestions before filtering
    console.log(`\n🔍 Raw suggestions from Gemini (${suggestions.length}):`);
    suggestions.forEach((s, idx) => {
      const priorityStr = typeof s.priority_index === 'number' ? `priority=${s.priority_index}` : 'NO PRIORITY';
      if (s.bbox) {
        console.log(`  ${idx + 1}. "${s.label}" (${priorityStr}) - bbox: [${s.bbox.x.toFixed(3)}, ${s.bbox.y.toFixed(3)}, ${s.bbox.width.toFixed(3)}, ${s.bbox.height.toFixed(3)}]`);
      } else {
        console.log(`  ${idx + 1}. "${s.label}" (${priorityStr}) - NO BBOX`);
      }
    });

    // Validate and filter suggestions - bbox must contain clicked point
    const validSuggestions = suggestions.filter(s => {
      if (!s.label || !s.kind || !s.bbox) {
        console.log(`⚠️ Filtered out "${s.label}" - missing required fields`);
        return false;
      }

      const bbox = s.bbox;
      if (typeof bbox.x !== 'number' || typeof bbox.y !== 'number' ||
          typeof bbox.width !== 'number' || typeof bbox.height !== 'number') {
        console.log(`⚠️ Filtered out "${s.label}" - invalid bbox types`);
        return false;
      }

      // Check if clicked point is inside the bounding box
      // Note: point is [y, x] but bbox is {x, y, width, height}
      const pointX = clickedPointNormalized[1]; // x coordinate
      const pointY = clickedPointNormalized[0]; // y coordinate

      const isInside = (
        pointX >= bbox.x &&
        pointX <= bbox.x + bbox.width &&
        pointY >= bbox.y &&
        pointY <= bbox.y + bbox.height
      );

      if (!isInside) {
        console.log(`⚠️ Filtered out "${s.label}" - bbox doesn't contain clicked point`);
        console.log(`   Point: (${pointX.toFixed(3)}, ${pointY.toFixed(3)}) not in bbox: [${bbox.x.toFixed(3)}, ${bbox.y.toFixed(3)}, ${(bbox.x + bbox.width).toFixed(3)}, ${(bbox.y + bbox.height).toFixed(3)}]`);
      }

      return isInside;
    });

    // HYBRID SORT: Priority index first, then bbox area as fallback
    validSuggestions.sort((a, b) => {
      // 1. Check for priority index (if present and valid)
      const hasPriorityA = typeof a.priority_index === 'number' && a.priority_index > 0;
      const hasPriorityB = typeof b.priority_index === 'number' && b.priority_index > 0;

      if (hasPriorityA && hasPriorityB) {
        // Both have priority index, sort by the index (lower = higher priority)
        if (a.priority_index !== b.priority_index) {
          return a.priority_index - b.priority_index;
        }
        // If same priority, fall through to area sort
      } else if (hasPriorityA) {
        // Only A has priority index, A goes first
        return -1;
      } else if (hasPriorityB) {
        // Only B has priority index, B goes first
        return 1;
      }

      // 2. Fallback to BBox Area (if no relevant priority index or same priority)
      const areaA = a.bbox.width * a.bbox.height;
      const areaB = b.bbox.width * b.bbox.height;
      return areaA - areaB; // Smaller area first
    });

    console.log(`\n✅ Valid suggestions after filtering and sorting (${validSuggestions.length}):`);
    validSuggestions.forEach((s, idx) => {
      const area = (s.bbox.width * s.bbox.height * 1000000).toFixed(0); // Convert to pixels^2
      const priorityStr = typeof s.priority_index === 'number' ? `priority=${s.priority_index}` : 'NO PRIORITY';
      console.log(`  ${idx + 1}. "${s.label}" (${priorityStr}, area: ${area}px²)`);
    });

    if (validSuggestions.length > 0) {
      const first = validSuggestions[0];
      const priorityStr = typeof first.priority_index === 'number' ? ` with priority=${first.priority_index}` : '';
      console.log(`🎯 First detection: "${first.label}"${priorityStr}\n`);
    } else {
      console.log(`⚠️ No valid detections found\n`);
    }

    res.json({
      id,
      point,
      suggestions: validSuggestions
    });

  } catch (error) {
    console.error('❌ Error analyzing point:', error);
    res.status(500).json({
      error: 'Failed to analyze point',
      message: error.message
    });
  }
});

module.exports = router;
