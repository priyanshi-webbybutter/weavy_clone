const Replicate = require('replicate');

// Use global fetch (available in Node.js 18+)
// If using older Node.js, you may need to install node-fetch

/**
 * Run model using Predictions API to get detailed usage information
 * Returns: { output, prediction, metrics, cost }
 */
async function runWithPredictionsAPI(modelId, inputParams, options = {}) {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken || apiToken === 'your_replicate_api_token_here') {
    throw new Error('REPLICATE_API_TOKEN not set');
  }

  // Debug: Log options received
  console.log(`🔍 [Predictions API] Options received:`, {
    fixedCostPerUnit: options.fixedCostPerUnit,
    fixedCostPerUnitType: typeof options.fixedCostPerUnit,
    costPerSecond: options.costPerSecond,
    modelId: modelId
  });

  const replicate = new Replicate({ auth: apiToken });
  
  // Create prediction
  const predictionParams = {
    version: options.version || modelId, // Can specify version or use modelId
    input: inputParams
  };
  
  // Only include webhook and webhook_events_filter if webhook is provided
  if (options.webhook) {
    predictionParams.webhook = options.webhook;
    predictionParams.webhook_events_filter = options.webhookEventsFilter || ['completed'];
  }
  
  const prediction = await replicate.predictions.create(predictionParams);

  console.log(`📊 Prediction created: ${prediction.id}`);
  console.log(`📊 Status: ${prediction.status}`);

  // Poll for completion
  let finalPrediction = prediction;
  const maxWaitTime = options.maxWaitTime || 300000; // 5 minutes default
  const pollInterval = options.pollInterval || 1000; // 1 second
  const startTime = Date.now();

  while (['starting', 'processing'].includes(finalPrediction.status)) {
    // Check timeout
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error(`Prediction timeout after ${maxWaitTime}ms`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    // Reload prediction to get latest status
    finalPrediction = await replicate.predictions.get(finalPrediction.id);
    
    if (finalPrediction.status !== 'starting' && finalPrediction.status !== 'processing') {
      console.log(`📊 Prediction ${finalPrediction.id} status: ${finalPrediction.status}`);
    }
  }

  if (finalPrediction.status === 'failed' || finalPrediction.status === 'canceled') {
    throw new Error(`Prediction ${finalPrediction.status}: ${finalPrediction.error || 'Unknown error'}`);
  }

  // Extract metrics and cost information
  const metrics = finalPrediction.metrics || {};
  const logs = finalPrediction.logs || '';
  const predictTime = metrics.predict_time || 0;
  
  // For Replicate models, use fixed cost per unit (not per second)
  // Replicate charges a fixed amount per image/request, not based on GPU time
  let actualCost = null;

  // Calculate cost safely with error handling
  try {
    // Priority 1: Use fixed cost per unit if provided (for Replicate models)
    // Check if fixedCostPerUnit is a valid positive number
    const fixedCostValue = options.fixedCostPerUnit;
    const isValidFixedCost = fixedCostValue !== null && 
                              fixedCostValue !== undefined && 
                              !isNaN(fixedCostValue) && 
                              parseFloat(fixedCostValue) > 0;

    console.log(`🔍 [Cost Calculation] Checking fixedCostPerUnit:`, {
      value: fixedCostValue,
      type: typeof fixedCostValue,
      isNull: fixedCostValue === null,
      isUndefined: fixedCostValue === undefined,
      isNaN: isNaN(fixedCostValue),
      parsed: parseFloat(fixedCostValue),
      isValid: isValidFixedCost
    });

    if (isValidFixedCost) {
      actualCost = parseFloat(fixedCostValue);
      console.log(`✅ Using fixed cost per unit: $${actualCost.toFixed(6)}`);
    } 
    // Priority 2: Fallback to costPerSecond calculation only if fixedCostPerUnit is not available
    else if (options.costPerSecond !== null && options.costPerSecond !== undefined && metrics.predict_time && predictTime > 0) {
      const costPerSecondValue = parseFloat(options.costPerSecond);
      actualCost = costPerSecondValue * predictTime;
      console.log(`⚠️ Falling back to GPU time calculation: $${actualCost.toFixed(6)} (${predictTime}s × $${costPerSecondValue}/s)`);
      console.warn(`⚠️ fixedCostPerUnit was not used! Value: ${fixedCostValue}, Type: ${typeof fixedCostValue}`);
    } else {
      console.warn(`❌ No cost information available. fixedCostPerUnit: ${fixedCostValue}, costPerSecond: ${options.costPerSecond}, predictTime: ${predictTime}`);
    }
  } catch (costError) {
    console.error(`❌ Error calculating cost:`, costError);
    // Don't throw - allow function to continue with actualCost = null
    // The calling code will handle null actualCost appropriately
  }

  console.log(`📊 Prediction metrics:`, {
    predictTime: `${predictTime}s`,
    fixedCostPerUnit: options.fixedCostPerUnit !== null && options.fixedCostPerUnit !== undefined ? `$${options.fixedCostPerUnit}` : 'N/A',
    costPerSecond: options.costPerSecond ? `$${options.costPerSecond}` : 'N/A',
    actualCost: actualCost ? `$${actualCost.toFixed(6)}` : 'N/A',
    status: finalPrediction.status,
    createdAt: finalPrediction.created_at,
    completedAt: finalPrediction.completed_at
  });

  return {
    output: finalPrediction.output,
    prediction: {
      id: finalPrediction.id,
      status: finalPrediction.status,
      created_at: finalPrediction.created_at,
      completed_at: finalPrediction.completed_at,
      started_at: finalPrediction.started_at,
      metrics: metrics,
      logs: logs
    },
    metrics: {
      predictTime: predictTime,
      costPerSecond: options.costPerSecond || null, // Use options.costPerSecond instead of undefined variable
      actualCost: actualCost
    }
  };
}

/**
 * Get account usage information from Replicate
 */
async function getAccountUsage() {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken || apiToken === 'your_replicate_api_token_here') {
      throw new Error('REPLICATE_API_TOKEN not set');
    }

    const replicate = new Replicate({ auth: apiToken });
    
    // Try to get account information
    // Note: Replicate SDK may not have accounts.get() - using HTTP API directly
    try {
      const response = await fetch('https://api.replicate.com/v1/account', {
        headers: {
          'Authorization': `Token ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const account = await response.json();
        console.log('📊 Account info:', {
          username: account.username,
          name: account.name,
          type: account.type
        });

        return {
          account: account,
          note: 'Usage data not available via API - check Replicate dashboard'
        };
      } else {
        console.warn('⚠️ Could not fetch account info from Replicate API');
        return {
          account: null,
          note: 'Account info not available - check Replicate dashboard at https://replicate.com/account'
        };
      }
    } catch (fetchError) {
      console.warn('⚠️ Error fetching account info:', fetchError.message);
      return {
        account: null,
        note: 'Account info not available - check Replicate dashboard'
      };
    }
  } catch (error) {
    console.error('❌ Error getting account usage:', error);
    return null;
  }
}

/**
 * Get recent predictions to calculate usage
 */
async function getRecentPredictions(limit = 50) {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken || apiToken === 'your_replicate_api_token_here') {
      throw new Error('REPLICATE_API_TOKEN not set');
    }

    const replicate = new Replicate({ auth: apiToken });
    
    // List recent predictions using SDK
    let predictions;
    try {
      predictions = await replicate.predictions.list();
    } catch (sdkError) {
      // Fallback to HTTP API if SDK method doesn't exist
      console.warn('⚠️ SDK predictions.list() failed, using HTTP API:', sdkError.message);
      const response = await fetch(`https://api.replicate.com/v1/predictions?limit=${limit}`, {
        headers: {
          'Authorization': `Token ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      predictions = await response.json();
    }

    // Calculate total usage from predictions
    let totalPredictTime = 0;
    let totalCost = 0;
    const predictionsByModel = {};

    for (const prediction of predictions.results || []) {
      if (prediction.status === 'succeeded' && prediction.metrics) {
        const predictTime = prediction.metrics.predict_time || 0;
        totalPredictTime += predictTime;
        
        // Group by model
        const modelId = prediction.version?.model?.owner + '/' + prediction.version?.model?.name;
        if (modelId && modelId !== 'undefined/undefined') {
          if (!predictionsByModel[modelId]) {
            predictionsByModel[modelId] = {
              count: 0,
              totalTime: 0,
              modelId: modelId
            };
          }
          predictionsByModel[modelId].count++;
          predictionsByModel[modelId].totalTime += predictTime;
        }
      }
    }

    return {
      totalPredictions: predictions.results?.length || 0,
      totalPredictTime: totalPredictTime,
      predictionsByModel: predictionsByModel,
      recentPredictions: predictions.results?.slice(0, 10) || []
    };
  } catch (error) {
    console.error('❌ Error getting recent predictions:', error);
    return null;
  }
}

module.exports = {
  runWithPredictionsAPI,
  getAccountUsage,
  getRecentPredictions
};

