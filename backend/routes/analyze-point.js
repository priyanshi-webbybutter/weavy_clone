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
      console.log(`⏳ Rate limited, retrying in ${(delay/1000).toFixed(1)}s... (attempt ${i + 1}/${maxRetries})`);
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

    // Simple, direct Gemini API call (exactly like reference demo)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp'
    });

    const prompt = `Analyze this image. What is the single, most prominent object or feature located at the normalized coordinates [${normalizedX.toFixed(4)}, ${normalizedY.toFixed(4)}]? Normalized coordinates are 0.0 (top/left) to 1.0 (bottom/right). Return only the name of the object or feature, nothing else.`;

    const result = await retryWithBackoff(async () => {
      return await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: image_base64
          }
        },
        prompt
      ]);
    });

    const response = await result.response;
    const objectName = response.text().trim();

    console.log(`✅ Detected object: "${objectName}"`);

    res.json({ objectName });

  } catch (error) {
    console.error('❌ Error analyzing point:', error);
    res.status(500).json({
      error: 'Failed to analyze point',
      message: error.message
    });
  }
});

module.exports = router;
