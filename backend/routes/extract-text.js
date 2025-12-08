const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * POST /api/extract-text
 * Extract text from an image using Gemini 2.5 Flash
 *
 * Request body:
 * {
 *   imageUrl: string  // URL of the image to extract text from
 * }
 *
 * Response:
 * {
 *   success: true,
 *   textRegions: [
 *     {
 *       text: string,      // Extracted text
 *       location: string   // Location description
 *     }
 *   ],
 *   imageUrl: string
 * }
 */
router.post('/extract-text', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    // Validate image URL
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return res.status(400).json({
        error: 'Image URL is required and must be a valid string',
      });
    }

    console.log('📝 Received text extraction request:', { imageUrl });

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured',
        message: 'Please add your Gemini API key to backend/.env file',
      });
    }

    console.log('📝 Starting text extraction with Gemini 2.0 Flash...');

    // Fetch the image
    let imageData;
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageData = buffer.toString('base64');
    } catch (fetchError) {
      console.error('❌ Error fetching image:', fetchError);
      return res.status(400).json({
        error: 'Failed to fetch image',
        message: 'Could not download the image from the provided URL. The URL may be invalid or the image may have been deleted.',
        details: fetchError.message,
      });
    }

    // Use Gemini 2.0 Flash for OCR
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `Extract ALL text from this image.
For each distinct text element, provide:
1. The exact text content
2. A brief description of its location/context in the image

Return the response in this JSON format:
{
  "textRegions": [
    {"text": "exact text here", "location": "top left corner"},
    {"text": "another text", "location": "center of image"}
  ]
}

If no text is found, return: {"textRegions": []}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/png',
          data: imageData,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();

    console.log('📝 Gemini OCR response:', text);

    // Parse JSON response
    let parsedResponse;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse JSON, treating as plain text:', parseError);
      // Fallback: treat entire response as a single text region
      parsedResponse = {
        textRegions: text.trim() ? [{ text: text.trim(), location: 'unknown' }] : [],
      };
    }

    const textRegions = parsedResponse.textRegions || [];

    if (textRegions.length === 0) {
      console.log('📝 No text detected in image');
      return res.json({
        success: true,
        textRegions: [],
        imageUrl: imageUrl,
        message: 'No text detected in the image',
      });
    }

    console.log(`✅ Extracted ${textRegions.length} text region(s)`);

    res.json({
      success: true,
      textRegions: textRegions,
      imageUrl: imageUrl,
    });

  } catch (error) {
    console.error('❌ Error extracting text:', error);
    console.error('❌ Error stack:', error.stack);

    let errorMessage = error.message || 'Unknown error occurred';
    let statusCode = 500;

    // Handle specific error types
    if (error.message && error.message.includes('API key')) {
      errorMessage = 'Invalid or missing Gemini API key';
      statusCode = 401;
    } else if (error.message && error.message.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.';
      statusCode = 429;
    }

    res.status(statusCode).json({
      error: 'Failed to extract text',
      message: errorMessage,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
