const express = require('express');
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

// GET /api/credits - Get user's current credit balance
router.get('/credits', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    // Try to get credits, and if user doesn't have a record, initialize it
    let credits;
    try {
      credits = await creditService.getUserCredits(user.id);
    } catch (error) {
      // If user doesn't have credits record, initialize it
      if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
        console.log('📝 User has no credits record, initializing...');
        try {
          await creditService.initializeUserCredits(user.id);
          credits = await creditService.getUserCredits(user.id);
        } catch (initError) {
          console.error('❌ Error initializing credits:', initError);
          // If initialization fails, return 0 credits instead of error
          credits = 0;
        }
      } else {
        throw error;
      }
    }

    res.json({
      success: true,
      credits: parseFloat(credits),
      userId: user.id
    });
  } catch (error) {
    console.error('❌ Error getting credits:', error);
    res.status(500).json({
      error: 'Failed to get credits',
      message: error.message,
    });
  }
});

// GET /api/credits/transactions - Get user's credit transaction history
router.get('/credits/transactions', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      success: true,
      transactions: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('❌ Error getting transactions:', error);
    res.status(500).json({
      error: 'Failed to get transactions',
      message: error.message,
    });
  }
});

// GET /api/credits/models-pricing - Get list of all Replicate models with their pricing
router.get('/credits/models-pricing', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get all Replicate models from database
    const { data: models, error } = await supabase
      .from('model_pricing')
      .select('model_id, model_name, dollar_cost_per_unit, price_per_token, provider, last_updated')
      .eq('provider', 'replicate')
      .order('model_name', { ascending: true });

    if (error) throw error;

    // Get credit conversion rate
    const { creditsPerDollar } = await creditService.getCreditConversionRate();

    // Format the response with credits calculation
    const modelsWithCredits = (models || []).map(model => ({
      modelId: model.model_id,
      modelName: model.model_name,
      dollarCost: model.dollar_cost_per_unit ? parseFloat(model.dollar_cost_per_unit) : null,
      creditsCost: model.dollar_cost_per_unit 
        ? (parseFloat(model.dollar_cost_per_unit) * creditsPerDollar).toFixed(4)
        : null,
      pricePerToken: model.price_per_token ? parseFloat(model.price_per_token) : null,
      lastUpdated: model.last_updated,
      provider: model.provider
    }));

    res.json({
      success: true,
      models: modelsWithCredits,
      totalModels: modelsWithCredits.length,
      creditConversionRate: {
        creditsPerDollar: creditsPerDollar,
        dollarPerCredit: 1 / creditsPerDollar,
        formula: '1000 credits = $20'
      }
    });
  } catch (error) {
    console.error('❌ Error getting models pricing:', error);
    res.status(500).json({
      error: 'Failed to get models pricing',
      message: error.message,
    });
  }
});

// POST /api/credits/fetch-pricing - Fetch and update pricing for all Replicate models
router.post('/credits/fetch-pricing', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    // For now, allow any authenticated user to trigger pricing fetch
    // In production, you might want to restrict this to admins
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required',
      });
    }

    console.log('🔄 Fetching pricing for all Replicate models...');
    const response = await fetchReplicatePricing.fetchAndUpdateAllReplicatePricing();

    res.json({
      success: true,
      results: response.results,
      summary: response.summary,
      message: `Updated ${response.summary.updated} out of ${response.summary.total} models`
    });
  } catch (error) {
    console.error('❌ Error fetching pricing:', error);
    res.status(500).json({
      error: 'Failed to fetch pricing',
      message: error.message,
    });
  }
});

module.exports = router;

