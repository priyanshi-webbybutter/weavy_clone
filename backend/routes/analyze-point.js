const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Exponential backoff retry logic (from reference demo)
 * Handles API rate limiting gracefully
 */
async function retryWithBackoff(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Check if it's a retryable error (rate limit, temporary failure)
      const isRetryable = error.message?.includes('429') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.message?.includes('UNAVAILABLE');

      if (!isRetryable) throw error;

      // Exponential backoff with jitter
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      console.log(`⏳ Rate limited, retrying in ${(delay / 1000).toFixed(1)}s... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

router.post('/analyze-point', async (req, res) => {
  try {
    const { image_base64, normalizedX, normalizedY } = req.body;

    if (!image_base64 || normalizedX === undefined || normalizedY === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: image_base64, normalizedX, normalizedY'
      });
    }

    console.log(`🔍 Analyzing point [${normalizedX.toFixed(4)}, ${normalizedY.toFixed(4)}]`);

    // Structured output with bounding boxes and priority system
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash'
    });

    const prompt = `You are a precise object detection AI. A user clicked at normalized coordinates [${normalizedX.toFixed(4)}, ${normalizedY.toFixed(4)}] on this image (where 0.0 is top/left and 1.0 is bottom/right).

Your task:
1. FIRST, identify the SPECIFIC object that the user clicked on at those exact coordinates
2. THEN, detect other prominent objects in the image

For each detected object, return:
- label: Short name (e.g., 'sunglasses', 'hat', 'person', 'bottle')
- kind: Category (e.g., 'object', 'person', 'text', 'accessory')
- priority_index:
  * Use 1 for the object AT the clicked coordinates (highest priority)
  * Use 2-6 for other important items (Glasses, Hats, Bottles, Hands, Faces, Text)
  * Use 999 for background/other objects
- bbox: Normalized bounding box {x, y, width, height} where x,y is top-left corner

IMPORTANT: The first object in the array MUST be the object at the clicked coordinates with priority_index: 1

Return ONLY a JSON array of detected objects.`;

    const responseSchema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "label": { "type": "STRING" },
          "kind": { "type": "STRING" },
          "priority_index": { "type": "INTEGER" },
          "bbox": {
            "type": "OBJECT",
            "properties": {
              "x": { "type": "NUMBER" },
              "y": { "type": "NUMBER" },
              "width": { "type": "NUMBER" },
              "height": { "type": "NUMBER" }
            },
            "required": ["x", "y", "width", "height"]
          }
        },
        "required": ["label", "kind", "priority_index", "bbox"]
      }
    };

    const result = await retryWithBackoff(async () => {
      return await model.generateContent({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: image_base64
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });
    });

    const response = await result.response;
    const jsonText = response.text().trim();

    let detections = [];
    try {
      detections = JSON.parse(jsonText);
      if (!Array.isArray(detections)) {
        throw new Error("Response is not an array");
      }
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return res.status(500).json({
        error: 'Failed to parse AI response',
        message: parseError.message
      });
    }

    // Sort by priority (lower = higher priority)
    detections.sort((a, b) => a.priority_index - b.priority_index);

    console.log(`✅ Detected ${detections.length} objects`);
    detections.slice(0, 3).forEach(d => {
      console.log(`   - ${d.label} (priority: ${d.priority_index})`);
    });

    res.json({ detections });

  } catch (error) {
    console.error('❌ Error analyzing point:', error);
    res.status(500).json({
      error: 'Failed to analyze point',
      message: error.message
    });
  }
});

module.exports = router;
