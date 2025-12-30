const express = require('express');
const Replicate = require('replicate');
const supabase = require('../lib/supabase');
const creditService = require('../lib/credit-service');
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

// POST /api/describe-image
router.post('/describe-image', async (req, res) => {
  try {
    // Get authenticated user for credit tracking
    const user = await getAuthenticatedUser(req);
    
    // Check credits before processing
    if (user) {
      const creditCheck = await creditService.hasEnoughCredits(user.id, 'lucataco/moondream2', 500);
      if (!creditCheck.hasEnough) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: `You need ${creditCheck.requiredCredits.toFixed(4)} credits but only have ${creditCheck.currentCredits.toFixed(2)} credits remaining.`,
          creditsRemaining: creditCheck.currentCredits,
          creditsRequired: creditCheck.requiredCredits
        });
      }
    }

    const { imageUrl, modelName, modelInstructions } = req.body;

    // Validate image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({
        error: 'Image URL is required and must be a string',
      });
    }

    console.log('🖼️ Received image description request:', { imageUrl, modelName, modelInstructions });

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

    // Use selected model or default to Moondream2
    const selectedModel = modelName || 'gemini-2.5-flash';
    const instructions = modelInstructions || 'Describe this image in detail. Include all important elements, colors, objects, people, text, and the overall scene.';
    
    // Map model names to Replicate model identifiers
    // For now, we'll use a default model mapping - this can be expanded later
    const modelMap = {
      'gemini-2.5-flash': 'lucataco/moondream2:72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31',
      // Add more model mappings here as needed
    };
    
    const modelWithVersion = modelMap[selectedModel] || process.env.IMAGE_DESCRIPTION_MODEL || 'lucataco/moondream2:72ccb656353c348c1385df54b237eeb7bfa874bf11486cf0b9473e691b662d31';
    
    // Input parameters
    const inputParams = {
      image: imageUrl,
      prompt: instructions,
    };

    console.log('📤 Using model:', selectedModel, '->', modelWithVersion);
    console.log('📤 With instructions:', instructions);
    console.log('📤 With params:', JSON.stringify(inputParams, null, 2));

    // Use Predictions API to get detailed metrics, with fallback to simple API
    let output;
    let predictionMetrics = null;
    let actualCost = null;
    let predictionResult = null;

    try {
      // Get pricing for this model
      const pricing = await creditService.getModelPricing('lucataco/moondream2');
      
      // For Replicate models, use fixed cost per unit directly
      const fixedCostPerUnit = pricing.dollar_cost_per_unit !== null && pricing.dollar_cost_per_unit !== undefined 
        ? parseFloat(pricing.dollar_cost_per_unit) 
        : null;

      console.log(`💰 Pricing for lucataco/moondream2: fixedCostPerUnit = $${fixedCostPerUnit || 'null'}`);

      // Use Predictions API
      predictionResult = await replicatePredictions.runWithPredictionsAPI(
        modelWithVersion,
        inputParams,
        {
          fixedCostPerUnit: fixedCostPerUnit, // Use fixed cost (do NOT pass costPerSecond)
          maxWaitTime: 60000, // 1 minute for description
          pollInterval: 1000
        }
      );

      output = predictionResult.output;
      predictionMetrics = predictionResult.metrics;
      actualCost = predictionResult.metrics.actualCost;

      console.log('✅ Image description completed with metrics');
      console.log('📊 Prediction ID:', predictionResult.prediction.id);
      console.log('📊 Predict Time:', `${predictionMetrics.predictTime}s`);
    } catch (predictionError) {
      console.warn('⚠️ Predictions API failed, falling back to replicate.run():', predictionError.message);
      // Fallback to simple API
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
      });
      output = await replicate.run(modelWithVersion, {
        input: inputParams,
      });
      console.log('✅ Image description completed (using fallback API)');
    }

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

    // Deduct credits after successful description
    // Use actual cost from Predictions API if available
    let creditInfo = null;
    if (user) {
      try {
        // Use actual cost if available from Predictions API, otherwise use database pricing
        let dollarCostToUse = actualCost;
        
        if (!dollarCostToUse) {
          const pricing = await creditService.getModelPricing('lucataco/moondream2');
          dollarCostToUse = pricing.dollar_cost_per_unit || null;
        }

        const deductResult = await creditService.deductCredits(
          user.id,
          'lucataco/moondream2',
          1, // units
          null, // tokens
          dollarCostToUse // Pass actual cost if available
        );
        
        if (!deductResult.success) {
          console.warn('⚠️ Failed to deduct credits, but description was generated');
          creditInfo = {
            success: false,
            error: deductResult.error,
            creditsRemaining: deductResult.remainingCredits
          };
        } else {
          console.log(`✅ Deducted ${deductResult.creditsDeducted.toFixed(4)} credits ($${dollarCostToUse?.toFixed(6) || 'N/A'}). Remaining: ${deductResult.remainingCredits.toFixed(2)}`);
          creditInfo = {
            success: true,
            modelUsed: deductResult.modelUsed || 'lucataco/moondream2',
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

    res.json({
      success: true,
      description: description,
      imageUrl: imageUrl,
      credits: creditInfo // Include credit information in the response
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

