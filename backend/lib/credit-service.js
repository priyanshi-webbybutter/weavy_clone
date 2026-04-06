const { createClient } = require('@supabase/supabase-js');

/**
 * Credit Service - Manages user credits and token-based billing
 * Credit System: 1000 credits = $20, so 1 credit = $0.02
 */

// Credit conversion constants
const CREDITS_PER_DOLLAR = 50.0; // 1000 credits / $20 = 50 credits per dollar
const DOLLAR_PER_CREDIT = 0.02; // $20 / 1000 = $0.02 per credit

// Get Supabase client with service role key (bypasses RLS) or anon key as fallback
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Use service role key if available (bypasses RLS for backend operations)
  // Otherwise fall back to anon key
  const key = serviceRoleKey || anonKey;
  
  if (!supabaseUrl || !key) {
    throw new Error('Supabase URL and key are required');
  }
  
  const client = createClient(supabaseUrl, key);
  
  // Log warning if service role key is not set (for debugging)
  if (!serviceRoleKey && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not set - using anon key. Some operations may fail due to RLS.');
  }
  
  return client;
}

/**
 * Get credit conversion rate from database (or use default)
 */
async function getCreditConversionRate() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('credit_config')
      .select('credits_per_dollar, dollar_per_credit')
      .eq('id', 1)
      .single();
    
    if (error || !data) {
      console.warn('⚠️ Could not fetch credit config, using defaults');
      return {
        creditsPerDollar: CREDITS_PER_DOLLAR,
        dollarPerCredit: DOLLAR_PER_CREDIT
      };
    }
    
    return {
      creditsPerDollar: parseFloat(data.credits_per_dollar) || CREDITS_PER_DOLLAR,
      dollarPerCredit: parseFloat(data.dollar_per_credit) || DOLLAR_PER_CREDIT
    };
  } catch (error) {
    console.warn('⚠️ Error fetching credit config, using defaults:', error);
    return {
      creditsPerDollar: CREDITS_PER_DOLLAR,
      dollarPerCredit: DOLLAR_PER_CREDIT
    };
  }
}

/**
 * Convert dollar cost to credits
 */
async function dollarsToCredits(dollarCost) {
  const { creditsPerDollar } = await getCreditConversionRate();
  return dollarCost * creditsPerDollar;
}

/**
 * Convert credits to dollars
 */
async function creditsToDollars(credits) {
  const { dollarPerCredit } = await getCreditConversionRate();
  return credits * dollarPerCredit;
}

/**
 * Initialize credits for a new user (1000 credits = $20)
 */
async function initializeUserCredits(userId) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        credits: 1000.00 // 1000 credits = $20
      })
      .select()
      .single();

    if (error) {
      // If user already has credits, just return existing
      if (error.code === '23505') { // Unique violation
        console.log('✅ User already has credits initialized');
        const supabase = getSupabaseClient();
        const { data: existing } = await supabase
          .from('user_credits')
          .select()
          .eq('user_id', userId)
          .single();
        return existing;
      }
      
      // If RLS error and service role key not set, provide helpful error
      if (error.code === '42501' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ RLS error: SUPABASE_SERVICE_ROLE_KEY not set in environment variables');
        console.error('   Please add SUPABASE_SERVICE_ROLE_KEY to your backend/.env file');
        throw new Error('Server configuration error: Service role key required for credit initialization');
      }
      
      throw error;
    }

    console.log('✅ Initialized 100 credits for user:', userId);
    return data;
  } catch (error) {
    console.error('❌ Error initializing user credits:', error);
    throw error;
  }
}

/**
 * Get user's current credit balance
 */
async function getUserCredits(userId) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        // Don't auto-initialize here - let the caller handle it
        // This avoids RLS issues when using anon key
        throw error;
      }
      throw error;
    }

    return data?.credits || 0;
  } catch (error) {
    console.error('❌ Error getting user credits:', error);
    throw error;
  }
}

/**
 * Get model pricing per token and dollar cost
 */
async function getModelPricing(modelId) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('model_pricing')
      .select('price_per_token, model_name, provider, dollar_cost_per_unit')
      .eq('model_id', modelId)
      .single();

    if (error) {
      console.warn(`⚠️ No pricing found for model: ${modelId}, using default`);
      // Default fallback pricing (very conservative)
      return {
        price_per_token: 0.0001, // 0.0001 credits per token
        model_name: modelId,
        provider: 'unknown',
        dollar_cost_per_unit: null
      };
    }

    return data;
  } catch (error) {
    console.error('❌ Error getting model pricing:', error);
    // Return default pricing on error
    return {
      price_per_token: 0.0001,
      model_name: modelId,
      provider: 'unknown',
      dollar_cost_per_unit: null
    };
  }
}

/**
 * Calculate credits to deduct based on actual dollar cost
 * Uses the conversion rate: 1000 credits = $20 (1 credit = $0.02)
 */
async function calculateCreditsToDeduct(modelId, tokensUsed, actualTokensUsed = null) {
  try {
    const pricing = await getModelPricing(modelId);
    
    // Use actual tokens if provided, otherwise use estimated
    const tokens = actualTokensUsed !== null ? actualTokensUsed : tokensUsed;
    
    // Calculate dollar cost first
    let dollarCost = null;
    if (pricing.dollar_cost_per_unit !== null && pricing.dollar_cost_per_unit !== undefined) {
      // For Replicate models: dollar_cost_per_unit is per image/request
      if (pricing.provider === 'replicate') {
        dollarCost = parseFloat(pricing.dollar_cost_per_unit);
      } else {
        // For token-based models: calculate from tokens
        dollarCost = parseFloat(pricing.dollar_cost_per_unit) * tokens;
      }
    } else if (pricing.provider === 'gemini') {
      // For Gemini: price_per_token is already in dollars per token
      // e.g., 0.000000075 = $0.075 per 1M tokens = $0.000000075 per token
      dollarCost = parseFloat(pricing.price_per_token) * tokens;
    }
    
    // Convert dollar cost to credits using conversion rate
    // 1000 credits = $20, so 1 credit = $0.02, or 50 credits = $1
    let creditsToDeduct = 0;
    if (dollarCost !== null && dollarCost !== undefined) {
      creditsToDeduct = await dollarsToCredits(dollarCost);
    } else {
      // Fallback: use old token-based calculation if dollar cost not available
      creditsToDeduct = parseFloat(pricing.price_per_token) * tokens;
      console.warn(`⚠️ No dollar cost for ${modelId}, using token-based calculation`);
    }
    
    return {
      creditsToDeduct: Math.max(0.0001, creditsToDeduct), // Minimum 0.0001 credits
      pricePerToken: pricing.price_per_token,
      modelName: pricing.model_name,
      provider: pricing.provider,
      dollarCost: dollarCost,
      actualTokensUsed: actualTokensUsed !== null ? actualTokensUsed : tokens
    };
  } catch (error) {
    console.error('❌ Error calculating credits:', error);
    // Fallback: use default pricing
    return {
      creditsToDeduct: Math.max(0.0001, 0.0001 * tokensUsed),
      pricePerToken: 0.0001,
      modelName: modelId,
      provider: 'unknown',
      dollarCost: null,
      actualTokensUsed: tokensUsed
    };
  }
}

/**
 * Deduct credits from user account
 * Returns: { success: boolean, remainingCredits: number, error?: string, ...creditInfo }
 */
async function deductCredits(userId, modelId, tokensUsed, actualTokensUsed = null, actualDollarCost = null) {
  try {
    // Get current credits
    const currentCredits = await getUserCredits(userId);
    
    // Calculate credits to deduct with actual token usage
    let { creditsToDeduct, pricePerToken, modelName, provider, dollarCost, actualTokensUsed: finalTokens } = 
      await calculateCreditsToDeduct(modelId, tokensUsed, actualTokensUsed);
    
    // Override dollar cost if actual cost is provided (from Predictions API)
    if (actualDollarCost !== null && actualDollarCost !== undefined) {
      dollarCost = actualDollarCost;
      // Recalculate credits based on actual cost
      creditsToDeduct = await dollarsToCredits(actualDollarCost);
      console.log(`💰 Using actual cost from Predictions API: $${actualDollarCost.toFixed(6)} = ${creditsToDeduct.toFixed(4)} credits`);
    }
    
    // Check if user has enough credits
    if (currentCredits < creditsToDeduct) {
      return {
        success: false,
        remainingCredits: currentCredits,
        error: 'Insufficient credits',
        creditsNeeded: creditsToDeduct
      };
    }

    // Deduct credits
    const newBalance = currentCredits - creditsToDeduct;
    
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_credits')
      .update({ credits: newBalance })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Record transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        model_name: modelName,
        tokens_used: finalTokens,
        credits_deducted: creditsToDeduct,
        price_per_token: pricePerToken,
        credits_before: currentCredits,
        credits_after: newBalance
      });

    console.log(`✅ Deducted ${creditsToDeduct.toFixed(4)} credits from user ${userId}. Remaining: ${newBalance.toFixed(2)}`);

    return {
      success: true,
      remainingCredits: newBalance,
      creditsDeducted: creditsToDeduct,
      modelUsed: modelId,
      modelName: modelName,
      tokensUsed: finalTokens,
      dollarCost: dollarCost,
      provider: provider
    };
  } catch (error) {
    console.error('❌ Error deducting credits:', error);
    throw error;
  }
}

/**
 * Check if user has enough credits for a request
 */
async function hasEnoughCredits(userId, modelId, estimatedTokens = 1000) {
  try {
    const currentCredits = await getUserCredits(userId);
    const { creditsToDeduct } = await calculateCreditsToDeduct(modelId, estimatedTokens);
    
    return {
      hasEnough: currentCredits >= creditsToDeduct,
      currentCredits,
      requiredCredits: creditsToDeduct
    };
  } catch (error) {
    console.error('❌ Error checking credits:', error);
    return {
      hasEnough: false,
      currentCredits: 0,
      requiredCredits: 0
    };
  }
}

/**
 * Update model pricing (for admin use or dynamic updates)
 */
async function updateModelPricing(modelId, pricePerToken, modelName, provider, dollarCostPerUnit = null) {
  try {
    const supabase = getSupabaseClient();
    const updateData = {
      model_id: modelId,
      model_name: modelName,
      price_per_token: pricePerToken,
      provider: provider,
      last_updated: new Date().toISOString()
    };
    
    // Add dollar_cost_per_unit if provided
    if (dollarCostPerUnit !== null && dollarCostPerUnit !== undefined) {
      updateData.dollar_cost_per_unit = dollarCostPerUnit;
    }
    
    const { data, error } = await supabase
      .from('model_pricing')
      .upsert(updateData, {
        onConflict: 'model_id'
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Updated pricing for model ${modelId}: $${dollarCostPerUnit || 'N/A'} per unit, ${pricePerToken} per token`);
    return data;
  } catch (error) {
    console.error('❌ Error updating model pricing:', error);
    throw error;
  }
}

module.exports = {
  initializeUserCredits,
  getUserCredits,
  getModelPricing,
  calculateCreditsToDeduct,
  deductCredits,
  hasEnoughCredits,
  updateModelPricing,
  getCreditConversionRate,
  dollarsToCredits,
  creditsToDollars
};

