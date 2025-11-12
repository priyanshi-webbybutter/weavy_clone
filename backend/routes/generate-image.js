const express = require('express');
const Replicate = require('replicate');

const router = express.Router();

// POST /api/generate-image
router.post('/generate-image', async (req, res) => {
  try {
    const {
      modelId = 'bytedance/seedream-4',
      prompt,
      imagePrompt, // Image URL for Flux image-to-image generation
      // Seedream-4 parameters
      size = '2K',
      width = 2048,
      height = 2048,
      aspectRatio = '4:3',
      maxImages = 1,
      enhancePrompt = true,
      sequentialImageGeneration = 'disabled',
      // Flux parameters
      promptUpsampling = true,
      seed,
      safetyTolerance = 2,
      raw = false,
      outputFormat = 'png',
    } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Prompt is required and must be a string',
      });
    }

    console.log('🎨 Received image generation request:', {
      modelId,
      prompt,
      imagePrompt: imagePrompt || 'none',
      ...(modelId === 'black-forest-labs/flux-1.1-pro-ultra' 
        ? { aspectRatio, promptUpsampling, seed, safetyTolerance, outputFormat, raw }
        : { size, width, height, aspectRatio, maxImages, enhancePrompt, sequentialImageGeneration } // Seedream-4
      ),
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

    let inputParams;
    let modelToRun;

    // Migrate old GPT Image 1 modelId to Seedream-4
    if (modelId === 'openai/gpt-image-1') {
      console.log('🔄 Migrating old GPT Image 1 request to Seedream-4');
      modelId = 'bytedance/seedream-4';
    }

    if (modelId === 'black-forest-labs/flux-1.1-pro-ultra') {
      // Flux 1.1 Pro Ultra parameters
      const formatMap = {
        'jpg': 'jpeg',
        'jpeg': 'jpeg',
        'png': 'png',
      };
      const mappedFormat = formatMap[outputFormat?.toLowerCase()] || 'png';

      inputParams = {
        prompt: prompt,
        aspect_ratio: aspectRatio || '1:1',
        prompt_upsampling: promptUpsampling !== false,
        output_format: mappedFormat,
        safety_tolerance: safetyTolerance || 2,
        raw: raw === true,
      };

      // Add image prompt if provided (for image-to-image generation)
      if (imagePrompt && typeof imagePrompt === 'string' && imagePrompt.trim()) {
        inputParams.image = imagePrompt;
        console.log('🖼️ Adding image prompt to Flux request:', imagePrompt);
      }

      // Only include seed if provided
      if (seed !== undefined && seed !== null) {
        inputParams.seed = seed;
      }

      modelToRun = 'black-forest-labs/flux-1.1-pro-ultra';
    } else {
      // Seedream-4 parameters
      inputParams = {
        prompt: prompt,
        size: size || '2K',
        width: width || 2048,
        height: height || 2048,
        aspect_ratio: aspectRatio || '4:3',
        max_images: maxImages || 1,
        image_input: [], // Empty array for now, can be extended later
        enhance_prompt: enhancePrompt !== false,
        sequential_image_generation: sequentialImageGeneration || 'disabled',
      };

      modelToRun = 'bytedance/seedream-4';
    }

    console.log('📤 Calling Replicate API:', modelToRun);
    console.log('📤 With params:', JSON.stringify(inputParams, null, 2));

    const output = await replicate.run(modelToRun, {
      input: inputParams,
    });

    console.log('✅ Image generation completed');
    console.log('📦 Raw output from Replicate:', JSON.stringify(output, null, 2));
    console.log('📦 Output type:', typeof output);
    console.log('📦 Is array?', Array.isArray(output));

    // Extract image URL(s) from output
    let imageUrls;
    if (Array.isArray(output)) {
      imageUrls = output.filter(url => url && typeof url === 'string');
    } else if (typeof output === 'string') {
      imageUrls = [output];
    } else if (output && typeof output === 'object') {
      // Handle object output - check common properties
      if (output.url) {
        imageUrls = [output.url];
      } else if (output.image) {
        imageUrls = [output.image];
      } else if (output.imageUrl) {
        imageUrls = [output.imageUrl];
      } else {
        // Try to find any string value in the object
        const stringValues = Object.values(output).filter(v => typeof v === 'string');
        if (stringValues.length > 0) {
          imageUrls = stringValues;
        } else {
          throw new Error(`Unexpected output format from Replicate API: ${JSON.stringify(output)}`);
        }
      }
    } else {
      throw new Error(`Unexpected output format from Replicate API. Type: ${typeof output}, Value: ${JSON.stringify(output)}`);
    }

    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('No image URLs found in Replicate API response');
    }

    console.log('🖼️ Extracted image URLs:', imageUrls);

    // Return success response with all settings used
    res.json({
      success: true,
      imageUrl: imageUrls[0], // First image for backward compatibility
      imageUrls: imageUrls, // All images if multiple were requested
      prompt: prompt,
      model: modelId,
      settings: modelId === 'black-forest-labs/flux-1.1-pro-ultra'
        ? {
            aspectRatio,
            promptUpsampling,
            seed,
            safetyTolerance,
            outputFormat,
            raw,
          }
        : {
            // Seedream-4
            size,
            width,
            height,
            aspectRatio,
            maxImages,
            enhancePrompt,
            sequentialImageGeneration,
          },
    });

  } catch (error) {
    console.error('❌ Error generating image:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    // Extract more detailed error information
    let errorMessage = error.message || 'Unknown error occurred';
    let errorDetails = error.toString();

    // Check for specific Replicate API errors
    if (error.response) {
      errorMessage = error.response.data?.detail || errorMessage;
      errorDetails = JSON.stringify(error.response.data || error.response);
      console.error('❌ Replicate API response:', error.response.data);
    }

    res.status(500).json({
      error: 'Failed to generate image',
      message: errorMessage,
      details: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
