const express = require('express');
const Replicate = require('replicate');
const supabase = require('../lib/supabase');
const creditService = require('../lib/credit-service');
const fetchReplicatePricing = require('../lib/fetch-replicate-pricing');
const replicatePredictions = require('../lib/replicate-predictions');

const router = express.Router();

// Helper to get authenticated user
async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  if (!token) return null;
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (error) {
    return null;
  }
}

// POST /api/generate-image
router.post('/generate-image', async (req, res) => {
  try {
    // Get authenticated user for credit tracking
    const user = await getAuthenticatedUser(req);
    
    let {
      modelId = 'bytedance/seedream-4',
      prompt,
      imagePrompt, // legacy field used by other models
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
      // Flux Redux parameters (snake_case preferred)
      redux_image,
      // Flux Canny Pro parameters
      control_image,
      steps,
      prompt_upsampling,
      safety_tolerance,
      aspect_ratio,
      // Reve Edit parameters
      image,
      version,
      num_outputs = 1,
      num_inference_steps = 28,
      guidance = 3,
      output_format = 'webp',
      output_quality = 80,
      disable_safety_checker = false,
      megapixels = '1',
    } = req.body;

    if (typeof modelId === 'string') {
      modelId = modelId.trim();
    }

    const isFluxReduxModel = modelId === 'black-forest-labs/flux-redux-dev';
    const isFluxCannyModel = modelId === 'black-forest-labs/flux-canny-pro';
    const isReveEditModel = modelId === 'reve/edit';
    const requiresPrompt = !isFluxReduxModel && !isReveEditModel; // Canny and Reve Edit need prompt, Redux doesn't

    // Validate prompt for models that need text input
    if (requiresPrompt && (!prompt || typeof prompt !== 'string' || !prompt.trim())) {
      return res.status(400).json({
        error: 'Prompt is required and must be a string',
      });
    }

    console.log('🎨 Received image generation request:', {
      modelId,
      prompt: requiresPrompt ? prompt : '[image-only]',
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

    if (requiresPrompt) {
      console.log('🎨 Starting image generation with prompt:', prompt);
    } else {
      console.log('🎨 Starting image generation (image-only Redux workflow)');
    }
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
    } else if (modelId === 'black-forest-labs/flux-redux-dev') {
      const sourceImage = redux_image || imagePrompt;
      if (!sourceImage || typeof sourceImage !== 'string' || !sourceImage.trim()) {
        return res.status(400).json({
          error: 'FLUX.1 Redux [dev] requires a connected source image',
        });
      }

      // Validate the source image URL format
      if (!sourceImage.startsWith('http://') && !sourceImage.startsWith('https://')) {
        return res.status(400).json({
          error: 'Invalid source image URL format. Must be a valid HTTP/HTTPS URL.',
          details: `Received: ${sourceImage}`,
        });
      }

      // Try to validate the URL is accessible (quick HEAD request)
      // This helps catch invalid/expired URLs before sending to Replicate
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const headResponse = await fetch(sourceImage, { 
          method: 'HEAD', 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!headResponse.ok) {
          console.error(`❌ Source image URL returned status ${headResponse.status}: ${sourceImage}`);
          return res.status(400).json({
            error: 'Source image URL is not accessible',
            message: `The connected image URL returned a ${headResponse.status} error. The image may have expired or been deleted. Please regenerate the source image and try again.`,
            details: `URL: ${sourceImage}`,
          });
        }
        
        console.log(`✅ Source image URL validated successfully: ${sourceImage}`);
      } catch (urlError) {
        if (urlError.name === 'AbortError') {
          console.warn(`⚠️ Source image URL validation timed out: ${sourceImage}`);
          // Continue anyway - might be a slow server
        } else if (urlError.message && urlError.message.includes('404')) {
          console.error(`❌ Source image URL not found (404): ${sourceImage}`);
          return res.status(400).json({
            error: 'Source image not found',
            message: 'The connected image URL returned a 404 error. The image may have expired or been deleted. Please regenerate the source image and try again.',
            details: `URL: ${sourceImage}`,
          });
        } else {
          console.warn(`⚠️ Could not validate source image URL: ${urlError.message}`);
          // Continue anyway - might be a network issue, let Replicate handle it
        }
      }

      inputParams = {
        redux_image: sourceImage,
        aspect_ratio: aspect_ratio || aspectRatio || '1:1',
        guidance: guidance ?? 3,
        megapixels: megapixels || '1',
        num_outputs,
        num_inference_steps,
        output_format: (output_format || outputFormat || 'webp').toLowerCase(),
        output_quality,
        disable_safety_checker: disable_safety_checker === true,
      };

      if (seed !== undefined && seed !== null) {
        inputParams.seed = seed;
      }

      modelToRun = 'black-forest-labs/flux-redux-dev';
    } else if (modelId === 'black-forest-labs/flux-canny-pro') {
      const sourceImage = control_image || imagePrompt;
      if (!sourceImage || typeof sourceImage !== 'string' || !sourceImage.trim()) {
        return res.status(400).json({
          error: 'FLUX Canny Pro requires a connected control image',
        });
      }

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          error: 'FLUX Canny Pro requires a text prompt',
        });
      }

      // Validate the source image URL format
      if (!sourceImage.startsWith('http://') && !sourceImage.startsWith('https://')) {
        return res.status(400).json({
          error: 'Invalid control image URL format. Must be a valid HTTP/HTTPS URL.',
          details: `Received: ${sourceImage}`,
        });
      }

      // Try to validate the URL is accessible
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const headResponse = await fetch(sourceImage, { 
          method: 'HEAD', 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!headResponse.ok) {
          console.error(`❌ Control image URL returned status ${headResponse.status}: ${sourceImage}`);
          return res.status(400).json({
            error: 'Control image URL is not accessible',
            message: `The connected image URL returned a ${headResponse.status} error. The image may have expired or been deleted. Please regenerate the source image and try again.`,
            details: `URL: ${sourceImage}`,
          });
        }
        
        console.log(`✅ Control image URL validated successfully: ${sourceImage}`);
      } catch (urlError) {
        if (urlError.name === 'AbortError') {
          console.warn(`⚠️ Control image URL validation timed out: ${sourceImage}`);
        } else if (urlError.message && urlError.message.includes('404')) {
          console.error(`❌ Control image URL not found (404): ${sourceImage}`);
          return res.status(400).json({
            error: 'Control image not found',
            message: 'The connected image URL returned a 404 error. The image may have expired or been deleted. Please regenerate the source image and try again.',
            details: `URL: ${sourceImage}`,
          });
        } else {
          console.warn(`⚠️ Could not validate control image URL: ${urlError.message}`);
        }
      }

      inputParams = {
        control_image: sourceImage,
        prompt: prompt,
        guidance: guidance ?? 30,
        steps: steps || num_inference_steps || 50,
        safety_tolerance: safety_tolerance ?? 6,
        prompt_upsampling: prompt_upsampling === true,
        output_format: (output_format || outputFormat || 'jpg').toLowerCase(),
      };

      if (seed !== undefined && seed !== null) {
        inputParams.seed = seed;
      }

      modelToRun = 'black-forest-labs/flux-canny-pro';
    } else if (modelId === 'reve/edit') {
      const sourceImage = image || imagePrompt;
      if (!sourceImage || typeof sourceImage !== 'string' || !sourceImage.trim()) {
        return res.status(400).json({
          error: 'Reve Edit requires a connected image',
        });
      }

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          error: 'Reve Edit requires a text prompt',
        });
      }

      // Validate the source image URL format
      if (!sourceImage.startsWith('http://') && !sourceImage.startsWith('https://')) {
        return res.status(400).json({
          error: 'Invalid image URL format. Must be a valid HTTP/HTTPS URL.',
          details: `Received: ${sourceImage}`,
        });
      }

      // Try to validate the URL is accessible
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const headResponse = await fetch(sourceImage, { 
          method: 'HEAD', 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!headResponse.ok) {
          console.error(`❌ Image URL returned status ${headResponse.status}: ${sourceImage}`);
          return res.status(400).json({
            error: 'Image URL is not accessible',
            message: `The connected image URL returned a ${headResponse.status} error. The image may have expired or been deleted. Please regenerate the source image and try again.`,
            details: `URL: ${sourceImage}`,
          });
        }
        
        console.log(`✅ Image URL validated successfully: ${sourceImage}`);
      } catch (urlError) {
        if (urlError.name === 'AbortError') {
          console.warn(`⚠️ Image URL validation timed out: ${sourceImage}`);
        } else if (urlError.message && urlError.message.includes('404')) {
          console.error(`❌ Image URL not found (404): ${sourceImage}`);
          return res.status(400).json({
            error: 'Image not found',
            message: 'The connected image URL returned a 404 error. The image may have expired or been deleted. Please regenerate the source image and try again.',
            details: `URL: ${sourceImage}`,
          });
        } else {
          console.warn(`⚠️ Could not validate image URL: ${urlError.message}`);
        }
      }

      inputParams = {
        image: sourceImage,
        prompt: prompt,
        version: version || 'latest',
      };

      modelToRun = 'reve/edit';
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

    // Fetch and update pricing for this model if it's a Replicate model
    // This ensures we always have the latest pricing before calculating credits
    if (modelToRun && modelToRun.includes('/') && !modelToRun.startsWith('gemini')) {
      try {
        const pricing = await fetchReplicatePricing.fetchModelPricingFromReplicate(modelToRun);
        if (pricing && pricing.dollarCost) {
          const pricePerToken = pricing.dollarCost / 1000;
          const modelName = modelToRun.split('/').pop().replace(/-/g, ' ');
          await creditService.updateModelPricing(
            modelToRun,
            pricePerToken,
            modelName,
            'replicate',
            pricing.dollarCost
          );
          console.log(`✅ Updated pricing for ${modelToRun}: $${pricing.dollarCost}`);
        }
      } catch (pricingError) {
        console.warn(`⚠️ Could not fetch pricing for ${modelToRun}, using database value:`, pricingError.message);
      }
    }

    // Check credits before processing (after we know which model will be used)
    // Use modelId since modelToRun will be set later, but they should be the same
    if (user) {
      // Estimate tokens (Replicate models charge per image, we'll use 1000 tokens as estimate)
      const creditCheck = await creditService.hasEnoughCredits(user.id, modelId, 1000);
      if (!creditCheck.hasEnough) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `You need ${creditCheck.requiredCredits.toFixed(4)} credits but only have ${creditCheck.currentCredits.toFixed(2)} credits remaining.`,
          creditsRemaining: creditCheck.currentCredits,
          creditsRequired: creditCheck.requiredCredits
        });
      }
    }

    console.log('📤 Calling Replicate API:', modelToRun);
    console.log('📤 With params:', JSON.stringify(inputParams, null, 2));

    // Use Predictions API to get detailed metrics, with fallback to simple API
    let output;
    let predictionMetrics = null;
    let actualCost = null;
    let predictionResult = null;

    try {
      // Get pricing for this model (from database)
      const pricing = await creditService.getModelPricing(modelToRun || modelId);
      
      // For Replicate models, use fixed cost per unit directly
      // Replicate charges a fixed amount per image, not per second
      const fixedCostPerUnit = pricing.dollar_cost_per_unit !== null && pricing.dollar_cost_per_unit !== undefined 
        ? parseFloat(pricing.dollar_cost_per_unit) 
        : null;

      console.log(`💰 Pricing for ${modelToRun || modelId}: fixedCostPerUnit = $${fixedCostPerUnit || 'null'}`);

      // Use Predictions API to get detailed metrics
      predictionResult = await replicatePredictions.runWithPredictionsAPI(
        modelToRun,
        inputParams,
        {
          fixedCostPerUnit: fixedCostPerUnit, // Use fixed cost for Replicate models (do NOT pass costPerSecond)
          maxWaitTime: 300000, // 5 minutes
          pollInterval: 1000 // 1 second
        }
      );

      output = predictionResult.output;
      predictionMetrics = predictionResult.metrics;
      actualCost = predictionResult.metrics.actualCost;

      console.log('✅ Image generation completed with metrics');
      console.log('📊 Prediction ID:', predictionResult.prediction.id);
      console.log('📊 Predict Time:', `${predictionMetrics.predictTime}s`);
      console.log('📊 Actual Cost:', actualCost ? `$${actualCost.toFixed(6)}` : 'N/A');
    } catch (predictionError) {
      console.warn('⚠️ Predictions API failed, falling back to replicate.run():', predictionError.message);
      // Fallback to simple API
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
      });
      output = await replicate.run(modelToRun, {
        input: inputParams,
      });
      console.log('✅ Image generation completed (using fallback API)');
    }

    console.log('📦 Raw output from Replicate:', JSON.stringify(output, null, 2));
    console.log('📦 Output type:', typeof output);
    console.log('📦 Is array?', Array.isArray(output));
    console.log('📦 Output constructor:', output?.constructor?.name);

    // Helper function to resolve File objects and extract URLs
    const resolveOutputItem = async (item) => {
      if (!item) return null;
      
      // If it's already a string URL, return it
      if (typeof item === 'string') {
        return item;
      }
      
      // If it's a File object or has a url() method
      if (typeof item === 'object') {
        // Try url() method first (for File objects)
        if (typeof item.url === 'function') {
          try {
            const url = await item.url();
            console.log('📦 Resolved File.url():', url);
            return url;
          } catch (err) {
            console.warn('⚠️ Failed to resolve output file URL:', err);
          }
        }
        
        // Try direct url property
        if (typeof item.url === 'string') {
          return item.url;
        }
        
        // Try href property
        if (typeof item.href === 'string') {
          return item.href;
        }
        
        // Try toString() method (some File objects might have this)
        if (typeof item.toString === 'function') {
          try {
            const str = item.toString();
            if (str && str.startsWith('http')) {
              return str;
            }
          } catch (err) {
            // Ignore toString errors
          }
        }
        
        // For File objects, try to access the underlying URL
        // Replicate File objects sometimes have a _url or url property
        if (item._url) {
          return item._url;
        }
      }
      
      return null;
    };

    // Extract image URL(s) from output
    let imageUrls;
    if (Array.isArray(output)) {
      const resolved = await Promise.all(output.map(resolveOutputItem));
      imageUrls = resolved.filter(Boolean);
    } else if (typeof output === 'string') {
      imageUrls = [output];
    } else if (output && typeof output === 'object') {
      // Handle object output - check common properties
      if (output.url) {
        const resolved = await resolveOutputItem(output.url);
        imageUrls = resolved ? [resolved] : [];
      } else if (output.image) {
        const resolved = await resolveOutputItem(output.image);
        imageUrls = resolved ? [resolved] : [];
      } else if (output.imageUrl) {
        imageUrls = [output.imageUrl];
      } else if (output.output) {
        // Some models return { output: [...] }
        const resolved = await resolveOutputItem(output.output);
        if (resolved) {
          imageUrls = Array.isArray(resolved) ? resolved : [resolved];
        } else if (Array.isArray(output.output)) {
          const resolvedArray = await Promise.all(output.output.map(resolveOutputItem));
          imageUrls = resolvedArray.filter(Boolean);
        }
      } else {
        // Try to find any string value or File object in the object
        const values = Object.values(output);
        const resolvedValues = await Promise.all(values.map(resolveOutputItem));
        imageUrls = resolvedValues.filter(Boolean);
        
        // If still no URLs, try to find any string that looks like a URL
        if (imageUrls.length === 0) {
          const stringValues = values.filter(v => typeof v === 'string' && (v.startsWith('http') || v.startsWith('https')));
          if (stringValues.length > 0) {
            imageUrls = stringValues;
          }
        }
      }
      
      // If still no URLs found, throw error with details
      if (!imageUrls || imageUrls.length === 0) {
        throw new Error(`Unexpected output format from Replicate API: ${JSON.stringify(output, null, 2)}`);
      }
    } else {
      throw new Error(`Unexpected output format from Replicate API. Type: ${typeof output}, Value: ${JSON.stringify(output)}`);
    }

    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('No image URLs found in Replicate API response');
    }

    // Validate URLs are actually URLs
    const validUrls = imageUrls.filter(url => {
      if (typeof url !== 'string') {
        console.warn('⚠️ Invalid URL type:', typeof url, url);
        return false;
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.warn('⚠️ URL does not start with http/https:', url);
        return false;
      }
      return true;
    });

    if (validUrls.length === 0) {
      throw new Error(`No valid image URLs found. Extracted URLs: ${JSON.stringify(imageUrls)}`);
    }

    console.log('🖼️ Extracted image URLs:', validUrls);

    // Deduct credits after successful image generation
    // Use actual cost from Predictions API if available, otherwise use database pricing
    let creditInfo = null;
    if (user) {
      try {
        // Use actual cost if available from Predictions API, otherwise use database pricing
        let dollarCostToUse = actualCost;
        
        if (!dollarCostToUse) {
          // Fallback to database pricing (this should always be available)
          const pricing = await creditService.getModelPricing(modelToRun || modelId);
          dollarCostToUse = pricing.dollar_cost_per_unit || null;
          
          if (!dollarCostToUse) {
            console.warn(`⚠️ No pricing found for ${modelToRun || modelId}, using default estimate`);
            dollarCostToUse = 0.03; // Default fallback
          }
        }

        const deductResult = await creditService.deductCredits(
          user.id,
          modelToRun || modelId,
          1, // units
          null, // tokens
          dollarCostToUse // Pass actual cost if available
        );
        
        if (!deductResult.success) {
          console.warn('⚠️ Failed to deduct credits, but image was generated');
          creditInfo = {
            success: false,
            error: deductResult.error,
            creditsRemaining: deductResult.remainingCredits
          };
        } else {
          console.log(`✅ Deducted ${deductResult.creditsDeducted.toFixed(4)} credits ($${dollarCostToUse?.toFixed(6) || 'N/A'}). Remaining: ${deductResult.remainingCredits.toFixed(2)}`);
          creditInfo = {
            success: true,
            modelUsed: deductResult.modelUsed || modelToRun || modelId,
            modelName: deductResult.modelName,
            tokensUsed: deductResult.tokensUsed,
            creditsDeducted: deductResult.creditsDeducted,
            creditsRemaining: deductResult.remainingCredits,
            dollarCost: dollarCostToUse,
            provider: deductResult.provider,
            // Add prediction metrics if available
            predictionId: predictionResult ? predictionResult.prediction.id : null,
            predictTime: predictionMetrics?.predictTime || null,
            actualCost: actualCost
          };
        }
      } catch (creditError) {
        console.error('⚠️ Error deducting credits (non-fatal):', creditError);
        creditInfo = {
          success: false,
          error: creditError.message
        };
      }
    }

    // Return success response with all settings used
    res.json({
      success: true,
      imageUrl: validUrls[0], // First image for backward compatibility
      imageUrls: validUrls, // All images if multiple were requested
      prompt: requiresPrompt ? prompt : null,
      model: modelId,
      credits: creditInfo, // Include credit information
      settings: modelId === 'black-forest-labs/flux-1.1-pro-ultra'
        ? {
            aspectRatio,
            promptUpsampling,
            seed,
            safetyTolerance,
            outputFormat,
            raw,
          }
        : modelId === 'black-forest-labs/flux-redux-dev'
          ? {
              aspect_ratio: aspect_ratio || aspectRatio,
              guidance,
              megapixels,
              num_outputs,
              output_format: output_format || outputFormat,
              output_quality,
              num_inference_steps,
              disable_safety_checker,
              seed,
            }
          : modelId === 'black-forest-labs/flux-canny-pro'
            ? {
                guidance: guidance ?? 30,
                steps: steps || num_inference_steps || 50,
                safety_tolerance: safety_tolerance ?? 6,
                prompt_upsampling: prompt_upsampling === true,
                output_format: output_format || outputFormat || 'jpg',
                seed,
              }
          : modelId === 'reve/edit'
            ? {
                version: version || 'latest',
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
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    
    // Extract more detailed error information
    let errorMessage = error.message || 'Unknown error occurred';
    let errorDetails = error.toString();
    let statusCode = 500;

    // Check for specific Replicate API errors
    if (error.response) {
      errorMessage = error.response.data?.detail || error.response.data?.message || errorMessage;
      errorDetails = JSON.stringify(error.response.data || error.response);
      statusCode = error.response.status || 500;
      console.error('❌ Replicate API response:', error.response.data);
      console.error('❌ Replicate API status:', error.response.status);
    } else if (error.request) {
      console.error('❌ Replicate API request error:', error.request);
      errorMessage = 'Failed to connect to Replicate API';
    } else if (error.message) {
      // Check for common error patterns
      if (error.message.includes('404')) {
        errorMessage = 'Model or resource not found. Please check the model ID.';
        statusCode = 404;
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = 'Invalid API token. Please check your REPLICATE_API_TOKEN.';
        statusCode = 401;
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
        statusCode = 429;
      }
    }

    // Log full error object for debugging
    try {
      console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.error('❌ Could not stringify error:', e);
    }

    res.status(statusCode).json({
      error: 'Failed to generate image',
      message: errorMessage,
      details: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
