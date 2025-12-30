const fetchReplicatePricing = require('./lib/fetch-replicate-pricing');

// Credit conversion constants
const CREDITS_PER_DOLLAR = 50.0; // 1000 credits / $20 = 50 credits per dollar
const DOLLAR_PER_CREDIT = 0.02; // $20 / 1000 = $0.02 per credit

function listAllModelsPricing() {
  console.log('\n📊 All Replicate Models Used in This Project\n');
  console.log('='.repeat(90));
  
  const models = fetchReplicatePricing.REPLICATE_MODELS;
  
  // Known pricing from the fetch service
  // Updated based on actual Replicate billing
  const knownPricing = {
    'bytedance/seedream-4': 0.03,
    'black-forest-labs/flux-1.1-pro-ultra': 0.06, // Updated from 0.11 to match actual Replicate billing
    'black-forest-labs/flux-redux-dev': 0.025, // Updated from 0.15 to match actual Replicate billing
    'black-forest-labs/flux-canny-pro': 0.05, // Updated from 0.06 to match actual Replicate billing
    'reve/edit': 0.04,
    'lucataco/moondream2': 0.0015, // Updated from 0.01 - approximately $0.0013, using $0.0015 for safety margin
    'pixverse/pixverse-v4.5': 0.50,
  };
  
  console.log('\n📋 Model Pricing List:\n');
  
  models.forEach((model, index) => {
    const dollarCost = knownPricing[model.modelId];
    const creditsCost = dollarCost ? (dollarCost * CREDITS_PER_DOLLAR).toFixed(4) : 'N/A';
    
    console.log(`${index + 1}. ${model.modelName}`);
    console.log(`   Model ID: ${model.modelId}`);
    console.log(`   💵 Dollar Cost: $${dollarCost || 'N/A'} per ${model.modelId.includes('pixverse') ? 'video' : 'image'}`);
    console.log(`   ✨ Credits Cost: ${creditsCost} credits`);
    console.log('');
  });
  
  console.log('='.repeat(90));
  console.log(`\n📊 Summary:`);
  console.log(`   Total Models: ${models.length}`);
  console.log(`   Models with Pricing: ${Object.keys(knownPricing).length}`);
  
  console.log(`\n💳 Credit Conversion Rate:`);
  console.log(`   ${CREDITS_PER_DOLLAR} credits = $1`);
  console.log(`   1 credit = $${DOLLAR_PER_CREDIT}`);
  console.log(`   Formula: 1000 credits = $20`);
  
  console.log(`\n💰 Total Cost Examples:`);
  console.log(`   Generate 10 images with Seedream-4: $${(knownPricing['bytedance/seedream-4'] * 10).toFixed(2)} (${(knownPricing['bytedance/seedream-4'] * 10 * CREDITS_PER_DOLLAR).toFixed(2)} credits)`);
  console.log(`   Generate 5 images with FLUX Redux: $${(knownPricing['black-forest-labs/flux-redux-dev'] * 5).toFixed(2)} (${(knownPricing['black-forest-labs/flux-redux-dev'] * 5 * CREDITS_PER_DOLLAR).toFixed(2)} credits)`);
  console.log(`   Generate 1 video with Pixverse: $${knownPricing['pixverse/pixverse-v4.5']} (${(knownPricing['pixverse/pixverse-v4.5'] * CREDITS_PER_DOLLAR).toFixed(2)} credits)\n`);
}

listAllModelsPricing();

