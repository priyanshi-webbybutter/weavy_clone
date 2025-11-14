const express = require('express');
const Replicate = require('replicate');

const router = express.Router();

// POST /api/generate-video
router.post('/generate-video', async (req, res) => {
  try {
    const {
      modelId = 'pixverse/pixverse-v5',
      prompt,
      aspectRatio = '16:9',
      duration = 5,
      quality = '720p',
      effect = 'none',
      negativePrompt = '',
    } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Prompt is required and must be a string',
      });
    }

    console.log('🎬 Received video generation request:', {
      modelId,
      prompt,
      aspectRatio,
      duration,
      quality,
      effect,
      negativePrompt: negativePrompt || 'none',
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

    console.log('🎬 Starting video generation with prompt:', prompt);
    console.log('⏳ This may take 30-60 seconds...');

    // Prepare input parameters for Pixverse v5
    const inputParams = {
      prompt: prompt,
      aspect_ratio: aspectRatio,
      duration: duration,
      quality: quality,
      effect: effect,
    };
    
    // Only add negative_prompt if provided
    if (negativePrompt && negativePrompt.trim()) {
      inputParams.negative_prompt = negativePrompt.trim();
    }

    console.log('📤 Calling Replicate API:', modelId);
    console.log('📤 With params:', JSON.stringify(inputParams, null, 2));

    const output = await replicate.run(modelId, {
      input: inputParams,
    });

    console.log('✅ Video generation completed');
    console.log('📦 Raw output from Replicate:', JSON.stringify(output, null, 2));

    // Extract video URL from output
    let videoUrl = '';
    if (typeof output === 'string') {
      videoUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      videoUrl = output[0];
    } else if (output && typeof output === 'object') {
      // Handle object responses - try to extract video URL from common fields
      if (output.video) {
        videoUrl = output.video;
      } else if (output.url) {
        videoUrl = output.url;
      } else if (output.output) {
        videoUrl = typeof output.output === 'string' ? output.output : output.output[0];
      } else if (output.files && Array.isArray(output.files) && output.files.length > 0) {
        videoUrl = output.files[0];
      } else {
        // Try to find any string value that looks like a URL
        const values = Object.values(output);
        const urlValue = values.find((v) => typeof v === 'string' && (v.startsWith('http') || v.startsWith('https')));
        if (urlValue) {
          videoUrl = urlValue;
        }
      }
    }

    if (!videoUrl) {
      console.error('❌ Could not extract video URL from output:', output);
      return res.status(500).json({
        error: 'Failed to extract video URL from model output',
        message: 'The model returned an unexpected format. Please check the console for details.',
        details: { output },
      });
    }

    console.log('✅ Extracted video URL:', videoUrl);

    res.json({
      success: true,
      videoUrl: videoUrl,
    });
  } catch (error) {
    console.error('❌ Error generating video:', error);
    
    // Extract detailed error message
    let errorMessage = 'Failed to generate video';
    let errorDetails = {};

    if (error.response) {
      // Replicate API error response
      errorMessage = error.response.data?.detail || error.message || errorMessage;
      errorDetails = error.response.data || {};
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({
      error: errorMessage,
      message: errorMessage,
      details: errorDetails,
    });
  }
});

module.exports = router;

