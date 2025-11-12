const express = require('express');
const Replicate = require('replicate');

const router = express.Router();

// POST /api/describe-image
router.post('/describe-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    // Validate image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({
        error: 'Image URL is required and must be a string',
      });
    }

    console.log('🖼️ Received image description request:', { imageUrl });

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

    console.log('🖼️ Starting image description...');
    console.log('⏳ This may take 5-15 seconds...');

    // Use Moondream2 model with specific version
    const modelWithVersion = process.env.IMAGE_DESCRIPTION_MODEL || 'lucataco/moondream2:72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31';
    
    // Moondream2 input parameters
    const inputParams = {
      image: imageUrl,
      prompt: 'Describe this image in detail. Include all important elements, colors, objects, people, text, and the overall scene.',
    };

    console.log('📤 Using model:', modelWithVersion);
    console.log('📤 With params:', JSON.stringify(inputParams, null, 2));

    // Use replicate.run() with model and version
    const output = await replicate.run(modelWithVersion, {
      input: inputParams,
    });

    console.log('✅ Image description completed');
    console.log('📦 Raw output from Replicate:', JSON.stringify(output, null, 2));

    // Extract description from output
    let description = '';
    if (typeof output === 'string') {
      description = output;
    } else if (Array.isArray(output) && output.length > 0) {
      description = output.join(' ');
    } else if (output && typeof output === 'object') {
      // Handle object responses - try to extract text from common fields
      if (output.text) {
        description = output.text;
      } else if (output.description) {
        description = output.description;
      } else if (output.output) {
        description = typeof output.output === 'string' ? output.output : JSON.stringify(output.output);
      } else {
        description = JSON.stringify(output);
      }
    } else {
      description = 'Unable to generate description';
    }

    console.log('📝 Final description:', description);

    res.json({
      success: true,
      description: description,
      imageUrl: imageUrl,
    });
  } catch (error) {
    console.error('❌ Error describing image:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error';
    let errorDetails = null;
    
    if (error.response) {
      errorDetails = error.response.data || error.response;
      errorMessage = error.response.data?.detail || error.response.data?.message || errorMessage;
      console.error('❌ Replicate API response:', error.response.data);
    }
    
    res.status(500).json({
      error: 'Failed to describe image',
      message: errorMessage,
      details: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;

