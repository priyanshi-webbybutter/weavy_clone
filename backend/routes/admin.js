const express = require('express');
const supabase = require('../lib/supabase');
const creditService = require('../lib/credit-service');

const router = express.Router();

// Helper to check if user is admin
async function isAdmin(user) {
  if (!user) return false;
  
  // Debug: Log what we're checking
  console.log('🔍 Checking admin status for user:', {
    email: user.email,
    id: user.id,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
  });
  
  // Check if user has admin role in app_metadata or user_metadata
  // Admins are typically identified by app_metadata.role === 'admin'
  // or user_metadata.role === 'admin'
  const isAdminUser = 
    user.app_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'admin' ||
    user.app_metadata?.is_admin === true ||
    user.user_metadata?.is_admin === true;
  
  console.log('🔍 Admin check result:', isAdminUser);
  return isAdminUser;
}

// Middleware to check admin access
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    
    // Use admin API to get full user metadata
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    
    // First verify the token and get user ID
    const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token);
    
    if (tokenError || !tokenUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get full user with metadata using admin API
    const { data: { user: fullUser }, error: userError } = await adminSupabase.auth.admin.getUserById(tokenUser.id);

    if (userError || !fullUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const adminStatus = await isAdmin(fullUser);
    if (!adminStatus) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    req.adminUser = fullUser;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/admin/login - Admin login (same as regular login but checks admin status)
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    console.log('🔐 Admin login attempt:', { email });

    // Sign in user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    // IMPORTANT: Fetch user with admin API to get full metadata
    // The regular signInWithPassword might not return app_metadata
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY not set - cannot verify admin status');
      return res.status(500).json({
        error: 'Server configuration error: Service role key required',
      });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Get user with full metadata using admin API
    const { data: { user: fullUser }, error: userError } = await adminSupabase.auth.admin.getUserById(data.user.id);

    if (userError || !fullUser) {
      console.error('❌ Error fetching user:', userError);
      return res.status(500).json({
        error: 'Failed to verify admin status',
        message: userError?.message,
      });
    }

    // Check if user is admin using the full user object
    const adminStatus = await isAdmin(fullUser);
    if (!adminStatus) {
      console.log('❌ User is not admin:', {
        email: fullUser.email,
        app_metadata: fullUser.app_metadata,
        user_metadata: fullUser.user_metadata,
      });
      return res.status(403).json({
        error: 'Access denied: Admin credentials required',
        debug: {
          email: fullUser.email,
          hasAppMetadata: !!fullUser.app_metadata,
          hasUserMetadata: !!fullUser.user_metadata,
          app_metadata: fullUser.app_metadata,
          user_metadata: fullUser.user_metadata,
        },
      });
    }

    console.log('✅ Admin logged in successfully:', fullUser.id);

    res.json({
      success: true,
      user: fullUser, // Return full user with metadata
      session: data.session,
      isAdmin: true,
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// GET /api/admin/users - Get all users with details
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    // Use service role to bypass RLS and get all users
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return res.status(500).json({
        error: 'Service role key not configured',
      });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users from auth.users
    const { data: users, error: usersError } = await adminSupabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return res.status(500).json({
        error: 'Failed to fetch users',
        message: usersError.message,
      });
    }

    // Get credit balances for all users
    const { data: creditsData, error: creditsError } = await adminSupabase
      .from('user_credits')
      .select('user_id, credits, created_at, updated_at');

    // Get transaction counts and totals per user, including model_name
    const { data: transactionsData, error: transactionsError } = await adminSupabase
      .from('credit_transactions')
      .select('user_id, model_name, credits_deducted, tokens_used, created_at');

    // Get project counts per user
    const { data: projectsData, error: projectsError } = await adminSupabase
      .from('projects')
      .select('user_id, id, created_at');

    // Create maps for quick lookup
    const creditsMap = new Map();
    if (creditsData) {
      creditsData.forEach(credit => {
        creditsMap.set(credit.user_id, credit);
      });
    }

    // Get credit conversion rate to calculate dollar costs
    const conversionRate = await creditService.getCreditConversionRate();
    const dollarPerCredit = conversionRate.dollarPerCredit || 0.02; // Default: $0.02 per credit

    const transactionsMap = new Map();
    const modelUsageMap = new Map(); // Map<userId, Map<modelName, {count, credits, dollarCost}>>
    
    if (transactionsData) {
      transactionsData.forEach(transaction => {
        const userId = transaction.user_id;
        const modelName = transaction.model_name || 'unknown';
        
        // Aggregate total transactions per user
        if (!transactionsMap.has(userId)) {
          transactionsMap.set(userId, {
            count: 0,
            totalCreditsDeducted: 0,
            totalDollarCost: 0,
            lastTransaction: null,
          });
        }
        const stats = transactionsMap.get(userId);
        stats.count++;
        const creditsDeducted = parseFloat(transaction.credits_deducted || 0);
        stats.totalCreditsDeducted += creditsDeducted;
        // Calculate dollar cost from credits (1 credit = $0.02)
        stats.totalDollarCost += creditsDeducted * dollarPerCredit;
        if (!stats.lastTransaction || new Date(transaction.created_at) > new Date(stats.lastTransaction)) {
          stats.lastTransaction = transaction.created_at;
        }
        
        // Aggregate per model per user
        if (!modelUsageMap.has(userId)) {
          modelUsageMap.set(userId, new Map());
        }
        const userModels = modelUsageMap.get(userId);
        if (!userModels.has(modelName)) {
          userModels.set(modelName, {
            count: 0,
            totalCredits: 0,
            totalDollarCost: 0,
            totalTokens: 0,
          });
        }
        const modelStats = userModels.get(modelName);
        modelStats.count++;
        modelStats.totalCredits += creditsDeducted;
        modelStats.totalDollarCost += creditsDeducted * dollarPerCredit;
        modelStats.totalTokens += parseInt(transaction.tokens_used || 0);
      });
    }

    const projectsMap = new Map();
    if (projectsData) {
      projectsData.forEach(project => {
        const userId = project.user_id;
        if (!projectsMap.has(userId)) {
          projectsMap.set(userId, []);
        }
        projectsMap.get(userId).push(project);
      });
    }

    // Combine user data with credits, transactions, and projects
    const usersWithDetails = await Promise.all(users.users.map(async (user) => {
      const credits = creditsMap.get(user.id);
      const transactions = transactionsMap.get(user.id) || {
        count: 0,
        totalCreditsDeducted: 0,
        totalDollarCost: 0,
        lastTransaction: null,
      };
      const projects = projectsMap.get(user.id) || [];
      const projectCount = projects.length;
      const lastProject = projects.length > 0 
        ? projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null;

      // Get model usage for this user
      const userModelUsage = modelUsageMap.get(user.id);
      const modelUsage = [];
      if (userModelUsage) {
        userModelUsage.forEach((stats, modelName) => {
          modelUsage.push({
            modelName: modelName,
            count: stats.count,
            totalCredits: stats.totalCredits.toFixed(4),
            totalDollarCost: stats.totalDollarCost.toFixed(6),
            totalTokens: stats.totalTokens,
          });
        });
        // Sort by total credits (descending)
        modelUsage.sort((a, b) => parseFloat(b.totalCredits) - parseFloat(a.totalCredits));
      }

      return {
        id: user.id,
        email: user.email,
        emailConfirmed: user.email_confirmed_at !== null,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        appMetadata: user.app_metadata,
        userMetadata: user.user_metadata,
        isAdmin: await isAdmin(user),
        credits: {
          balance: credits?.credits || 0,
          createdAt: credits?.created_at,
          updatedAt: credits?.updated_at,
        },
        transactions: {
          count: transactions.count,
          totalCreditsDeducted: transactions.totalCreditsDeducted.toFixed(4),
          totalDollarCost: transactions.totalDollarCost.toFixed(6),
          lastTransaction: transactions.lastTransaction,
        },
        modelUsage: modelUsage, // Add model usage data
        projects: {
          count: projectCount,
          lastProject: lastProject ? {
            id: lastProject.id,
            createdAt: lastProject.created_at,
          } : null,
        },
      };
    }));

    // Sort by creation date (newest first)
    usersWithDetails.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      success: true,
      users: usersWithDetails,
      total: usersWithDetails.length,
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// GET /api/admin/stats - Get overall statistics
router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return res.status(500).json({
        error: 'Service role key not configured',
      });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Get total users
    const { data: usersData } = await adminSupabase.auth.admin.listUsers();
    const totalUsers = usersData?.users?.length || 0;

    // Get total credits in system
    const { data: creditsData } = await adminSupabase
      .from('user_credits')
      .select('credits');
    const totalCredits = creditsData?.reduce((sum, c) => sum + parseFloat(c.credits || 0), 0) || 0;

    // Get total transactions
    const { data: transactionsData } = await adminSupabase
      .from('credit_transactions')
      .select('credits_deducted');
    const totalTransactions = transactionsData?.length || 0;
    const totalCreditsDeducted = transactionsData?.reduce((sum, t) => sum + parseFloat(t.credits_deducted || 0), 0) || 0;
    // Calculate dollar cost from credits (1 credit = $0.02)
    const conversionRate = await creditService.getCreditConversionRate();
    const dollarPerCredit = conversionRate.dollarPerCredit || 0.02;
    const totalDollarCost = totalCreditsDeducted * dollarPerCredit;

    // Get total projects
    const { data: projectsData } = await adminSupabase
      .from('projects')
      .select('id');
    const totalProjects = projectsData?.length || 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalCredits,
        totalTransactions,
        totalCreditsDeducted: totalCreditsDeducted.toFixed(4),
        totalDollarCost: totalDollarCost.toFixed(6),
        totalProjects,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;

