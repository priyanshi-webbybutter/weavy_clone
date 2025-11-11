const express = require('express');
const Replicate = require('replicate');

const router = express.Router();

// POST /api/generate-image
router.post('/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Prompt is required and must be a string',
      });
    }

    // Check for API token
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken || apiToken === 'your_replicate_api_token_here') {
      return res.status(500).json({
        error: 'REPLICATE_API_TOKEN is not configured',
        message: 'Please add your Replicate API token to backend/.env file',
      });
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: apiToken,
    });

    console.log('🎨 Starting image generation with prompt:', prompt);
    console.log('⏳ This may take 10-30 seconds...');

    // Run the Flux 1.1 Pro Ultra model
    const output = await replicate.run(
      'black-forest-labs/flux-1.1-pro-ultra',
      {
        input: {
          prompt: prompt,
          aspect_ratio: '1:1',
          output_format: 'webp',
          output_quality: 80,
          safety_tolerance: 2,
        },
      }
    );

    console.log('✅ Image generation completed');

    // Extract image URL from output
    let imageUrl;
    if (Array.isArray(output)) {
      imageUrl = output[0];
    } else if (typeof output === 'string') {
      imageUrl = output;
    } else {
      throw new Error('Unexpected output format from Replicate API');
    }

    // Return success response
    res.json({
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      model: 'flux-1.1-pro-ultra',
    });

  } catch (error) {
    console.error('❌ Error generating image:', error);

    res.status(500).json({
      error: 'Failed to generate image',
      message: error.message || 'Unknown error occurred',
      details: error.toString(),
    });
  }
});

module.exports = router;
