const Replicate = require('replicate');
const creditService = require('./credit-service');

/**
 * Fetch actual pricing from Replicate for all models we use
 * Replicate pricing is typically per second of compute time or per request
 * We'll need to estimate based on typical usage or use their pricing API if available
 */

// List of all Replicate models we use
const REPLICATE_MODELS = [
  { modelId: 'bytedance/seedream-4', modelName: 'Seedream-4' },
  { modelId: 'black-forest-labs/flux-1.1-pro-ultra', modelName: 'FLUX 1.1 Pro Ultra' },
  { modelId: 'black-forest-labs/flux-redux-dev', modelName: 'FLUX.1 Redux' },
  { modelId: 'black-forest-labs/flux-canny-pro', modelName: 'FLUX Canny Pro' },
  { modelId: 'reve/edit', modelName: 'Reve Edit' },
  { modelId: 'lucataco/moondream2', modelName: 'Moondream2 (Image Describer)' },
  { modelId: 'pixverse/pixverse-v4.5', modelName: 'Pixverse v4.5' },
];

/**
 * Fetch pricing for a single model from Replicate
 * Note: Replicate doesn't expose pricing directly in their API
 * We'll use known pricing or fetch from their website/pricing page
 */
async function fetchModelPricingFromReplicate(modelId) {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken || apiToken === 'your_replicate_api_token_here') {
      console.warn('⚠️ REPLICATE_API_TOKEN not set, cannot fetch pricing');
      return null;
    }

    const replicate = new Replicate({ auth: apiToken });
    
    // Get model info - this might include pricing in metadata
    const [owner, modelName] = modelId.split('/');
    const model = await replicate.models.get(owner, modelName);
    
    // Replicate pricing is typically:
    // - Per second of compute time
    // - Varies by hardware type
    // We'll need to use known pricing or estimate based on typical usage
    
    // Known pricing (as of 2024):
    // These are approximate costs per image/request based on typical usage
    // Updated based on actual Replicate billing
    const knownPricing = {
      'bytedance/seedream-4': 0.03, // $0.03 per image
      'black-forest-labs/flux-1.1-pro-ultra': 0.06, // $0.06 per image (updated from 0.11)
      'black-forest-labs/flux-redux-dev': 0.025, // $0.025 per image (updated from 0.15)
      'black-forest-labs/flux-canny-pro': 0.05, // $0.05 per image (updated from 0.06)
      'reve/edit': 0.04, // $0.04 per image
      'lucataco/moondream2': 0.0015, // $0.0015 per request (approximately $0.0013, using $0.0015 for safety margin)
      'pixverse/pixverse-v4.5': 0.50, // $0.50 per video
    };

    const dollarCost = knownPricing[modelId];
    
    if (dollarCost) {
      return {
        modelId,
        dollarCost,
        source: 'known_pricing'
      };
    }

    // If not in known pricing, try to estimate from model metadata
    // Replicate models typically show pricing on their website
    // For now, we'll return null and use database fallback
    console.warn(`⚠️ No known pricing for ${modelId}, using database value`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching pricing for ${modelId}:`, error);
    return null;
  }
}

/**
 * Fetch and update pricing for all Replicate models
 */
async function fetchAndUpdateAllReplicatePricing() {
  console.log('🔄 Fetching pricing for all Replicate models...');
  
  const results = [];
  const { creditsPerDollar } = await creditService.getCreditConversionRate();
  
  for (const model of REPLICATE_MODELS) {
    try {
      const pricing = await fetchModelPricingFromReplicate(model.modelId);
      
      if (pricing && pricing.dollarCost) {
        // Update database with fetched pricing
        // price_per_token is used for calculation, but for Replicate models we use dollar_cost_per_unit
        const pricePerToken = pricing.dollarCost / 1000; // Convert to per-token equivalent for calculation
        const creditsCost = pricing.dollarCost * creditsPerDollar;
        
        await creditService.updateModelPricing(
          model.modelId,
          pricePerToken,
          model.modelName,
          'replicate',
          pricing.dollarCost
        );
        
        results.push({
          modelId: model.modelId,
          modelName: model.modelName,
          success: true,
          dollarCost: pricing.dollarCost,
          creditsCost: creditsCost.toFixed(4),
          source: pricing.source
        });
        
        console.log(`✅ Updated pricing for ${model.modelId}: $${pricing.dollarCost} (${creditsCost.toFixed(4)} credits)`);
      } else {
        results.push({
          modelId: model.modelId,
          modelName: model.modelName,
          success: false,
          error: 'No pricing found'
        });
        console.warn(`⚠️ Could not fetch pricing for ${model.modelId}`);
      }
    } catch (error) {
      console.error(`❌ Error updating pricing for ${model.modelId}:`, error);
      results.push({
        modelId: model.modelId,
        modelName: model.modelName,
        success: false,
        error: error.message
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Finished fetching pricing. Updated ${successCount}/${results.length} models`);
  
  return {
    results,
    summary: {
      total: results.length,
      updated: successCount,
      failed: results.length - successCount
    }
  };
}

module.exports = {
  fetchModelPricingFromReplicate,
  fetchAndUpdateAllReplicatePricing,
  REPLICATE_MODELS
};

