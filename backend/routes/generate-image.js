const express = require('express');
const Replicate = require('replicate');

const router = express.Router();

// POST /api/generate-image
router.post('/generate-image', async (req, res) => {
  try {
    const {
      prompt,
      background = 'opaque',
      numberOfImages = 1,
      outputFormat = 'jpg',
      quality = 'high',
      size = '1024x1024',
    } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Prompt is required and must be a string',
      });
    }

    console.log('🎨 Received image generation request with settings:', {
      prompt,
      background,
      numberOfImages,
      outputFormat,
      quality,
      size,
    });

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

    // Map quality to output_quality value (0-100)
    const qualityMap = {
      high: 90,
      medium: 80,
      low: 60,
    };

    // Map size to aspect_ratio
    const aspectRatioMap = {
      '1024x1024': '1:1',
      '1536x1024': '3:2',
      '1024x1536': '2:3',
    };

    // Run the Flux model with settings
    const output = await replicate.run(
      'bytedance/seedream-4',
      {
        input: {
          prompt: prompt,
          aspect_ratio: aspectRatioMap[size] || '1:1',
          output_format: outputFormat,
          output_quality: qualityMap[quality] || 80,
          max_images: 1,
          num_outputs: numberOfImages,
          enhance_prompt: true,
          sequential_image_generation: "disabled",
          // Note: Replicate may not support background transparency directly
          // This parameter might need adjustment based on model capabilities
        },
      }
    );

    console.log('✅ Image generation completed');

    // Extract image URL(s) from output
    let imageUrls;
    if (Array.isArray(output)) {
      imageUrls = output;
    } else if (typeof output === 'string') {
      imageUrls = [output];
    } else {
      throw new Error('Unexpected output format from Replicate API');
    }

    // Return success response with all settings used
    res.json({
      success: true,
      imageUrl: imageUrls[0], // First image for backward compatibility
      imageUrls: imageUrls, // All images if multiple were requested
      prompt: prompt,
      model: 'flux-kontext-max',
      settings: {
        background,
        numberOfImages,
        outputFormat,
        quality,
        size,
      },
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
