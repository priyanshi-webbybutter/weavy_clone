require('dotenv').config();
const creditService = require('./lib/credit-service');

/**
 * Script to update model pricing in the database
 * Usage: node update-model-pricing.js
 */

// Pricing updates based on actual Replicate billing
// Update these values based on your actual Replicate billing data
const pricingUpdates = {
  'bytedance/seedream-4': 0.03, // $0.03 per image (verified)
  'black-forest-labs/flux-1.1-pro-ultra': 0.11, // Verify this
  'black-forest-labs/flux-redux-dev': 0.025, // $0.025 per image (updated)
  'black-forest-labs/flux-canny-pro': 0.06, // Verify this
  'reve/edit': 0.04, // Verify this
  'lucataco/moondream2': 0.01, // $0.01 per request (verify this)
  'pixverse/pixverse-v4.5': 0.50, // $0.50 per video (verify this)
};

async function updateModelPricing() {
  console.log('\n🔄 Updating Model Pricing in Database\n');
  console.log('='.repeat(80));

  const results = [];
  const { creditsPerDollar } = await creditService.getCreditConversionRate();

  for (const [modelId, dollarCost] of Object.entries(pricingUpdates)) {
    try {
      // Get model name from REPLICATE_MODELS
      const modelNameMap = {
        'bytedance/seedream-4': 'Seedream-4',
        'black-forest-labs/flux-1.1-pro-ultra': 'FLUX 1.1 Pro Ultra',
        'black-forest-labs/flux-redux-dev': 'FLUX.1 Redux',
        'black-forest-labs/flux-canny-pro': 'FLUX Canny Pro',
        'reve/edit': 'Reve Edit',
        'lucataco/moondream2': 'Moondream2 (Image Describer)',
        'pixverse/pixverse-v4.5': 'Pixverse v4.5',
      };

      const modelName = modelNameMap[modelId] || modelId;
      const creditsCost = dollarCost * creditsPerDollar;

      // Update pricing in database
      await creditService.updateModelPricing(
        modelId,
        dollarCost / 1000, // price_per_token (not used for Replicate, but kept for compatibility)
        modelName,
        'replicate',
        dollarCost // dollar_cost_per_unit
      );

      results.push({
        modelId,
        modelName,
        dollarCost,
        creditsCost: creditsCost.toFixed(4),
        status: '✅ Updated'
      });

      console.log(`✅ Updated ${modelName}:`);
      console.log(`   Model ID: ${modelId}`);
      console.log(`   Dollar Cost: $${dollarCost} per ${modelId.includes('pixverse') ? 'video' : 'image'}`);
      console.log(`   Credits Cost: ${creditsCost.toFixed(4)} credits`);
      console.log('');
    } catch (error) {
      console.error(`❌ Error updating ${modelId}:`, error.message);
      results.push({
        modelId,
        modelName: modelId,
        dollarCost,
        status: `❌ Error: ${error.message}`
      });
    }
  }

  console.log('='.repeat(80));
  console.log('\n📊 Update Summary:\n');
  
  const successCount = results.filter(r => r.status === '✅ Updated').length;
  const failCount = results.length - successCount;

  results.forEach(result => {
    console.log(`${result.status} ${result.modelId}`);
    if (result.status === '✅ Updated') {
      console.log(`   → $${result.dollarCost} = ${result.creditsCost} credits`);
    }
  });

  console.log(`\n✅ Successfully updated: ${successCount}/${results.length}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}/${results.length}`);
  }

  console.log('\n💡 Next Steps:');
  console.log('   1. Verify pricing by generating images/videos with each model');
  console.log('   2. Check your Replicate billing to confirm actual costs');
  console.log('   3. Update pricingUpdates object if you find discrepancies');
  console.log('   4. Re-run this script to update the database\n');
}

// Run the update
updateModelPricing().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

