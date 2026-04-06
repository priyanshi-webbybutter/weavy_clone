const express = require('express');
const supabase = require('../lib/supabase');
const creditService = require('../lib/credit-service');

const router = express.Router();

// POST /api/auth/signup
router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Email is required and must be a string',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Password is required and must be a string',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters',
      });
    }

    console.log('📝 Received signup request:', { email });

    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('❌ Signup error:', error);
      return res.status(400).json({
        error: error.message,
        code: error.status,
      });
    }

    console.log('✅ User signed up successfully:', data.user?.id);

    // Initialize 100 credits for new user
    if (data.user?.id) {
      try {
        await creditService.initializeUserCredits(data.user.id);
      } catch (creditError) {
        console.error('⚠️ Failed to initialize credits (non-fatal):', creditError);
        // Don't fail signup if credit initialization fails
      }
    }

    res.json({
      success: true,
      user: data.user,
      session: data.session,
      message: 'Account created successfully. Please check your email to confirm your account.',
    });
  } catch (error) {
    console.error('❌ Error in signup:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Email is required and must be a string',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Password is required and must be a string',
      });
    }

    console.log('🔐 Received login request:', { email });

    // Sign in user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Login error:', error);
      return res.status(400).json({
        error: error.message,
        code: error.status,
      });
    }

    console.log('✅ User logged in successfully:', data.user?.id);

    res.json({
      success: true,
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('❌ Error in login:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// POST /api/auth/google
router.post('/auth/google', async (req, res) => {
  try {
    console.log('🔐 Google OAuth route hit!');
    console.log('📦 Request body:', req.body);
    
    const { redirectTo } = req.body;
    
    // Use the provided redirectTo or default based on environment
    // IMPORTANT: This must match the redirect URL configured in Supabase Dashboard
    const defaultRedirectUrl = process.env.NODE_ENV === 'production'
      ? `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/auth/callback`
      : `http://localhost:3000/auth/callback`;
    
    const redirectUrl = redirectTo || defaultRedirectUrl;

    console.log('🔐 Received Google OAuth request');
    console.log('📍 Redirect URL (frontend callback):', redirectUrl);
    console.log('📍 Supabase callback (internal): https://fcvklxgzvqqzexywrmry.supabase.co/auth/v1/callback');

    // Check if Supabase client is properly initialized
    if (!supabase || !supabase.auth) {
      console.error('❌ Supabase client not properly initialized');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Supabase client not initialized',
      });
    }

    // Check environment variables
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing Supabase configuration');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Supabase URL or ANON key not configured',
      });
    }

    // Use Supabase client's signInWithOAuth method
    // Note: This should work on server-side and return a URL for client redirect
    let data, error;
    try {
      console.log('🔄 Calling signInWithOAuth with:', {
        provider: 'google',
        redirectTo: redirectUrl,
        supabaseUrl: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'not set',
      });
      
      // Call signInWithOAuth - this should return { data: { url: string }, error: null }
      const result = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      console.log('📦 OAuth result type:', typeof result);
      console.log('📦 OAuth result keys:', result ? Object.keys(result) : 'null');
      console.log('📦 OAuth result.data:', result?.data);
      console.log('📦 OAuth result.error:', result?.error);
      
      if (!result) {
        throw new Error('signInWithOAuth returned null or undefined');
      }
      
      data = result.data;
      error = result.error;
    } catch (oauthError) {
      console.error('❌ Exception in signInWithOAuth:', oauthError);
      console.error('❌ Error name:', oauthError.name);
      console.error('❌ Error message:', oauthError.message);
      console.error('❌ Error stack:', oauthError.stack);
      
      // Check for specific error types
      if (oauthError.message?.includes('redirect_uri_mismatch')) {
        return res.status(400).json({
          error: 'OAuth configuration error',
          message: 'Redirect URI mismatch. Please check your Supabase OAuth settings.',
          hint: 'Make sure the redirect URL is added to your Supabase project\'s OAuth redirect URLs',
        });
      }
      
      return res.status(500).json({
        error: 'OAuth initialization failed',
        message: oauthError.message || 'Failed to initialize OAuth flow',
        details: process.env.NODE_ENV === 'development' ? {
          name: oauthError.name,
          message: oauthError.message,
          stack: oauthError.stack,
        } : undefined,
      });
    }

    if (error) {
      console.error('❌ Google OAuth error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return res.status(400).json({
        error: error.message || 'OAuth authentication failed',
        code: error.status,
        details: error,
      });
    }

    if (!data || !data.url) {
      console.error('❌ No OAuth URL returned');
      console.error('❌ Data received:', data);
      return res.status(500).json({
        error: 'Failed to generate OAuth URL',
        message: 'No URL returned from OAuth provider',
      });
    }

    console.log('✅ Google OAuth URL generated:', data.url);

    res.json({
      success: true,
      url: data.url,
    });
  } catch (error) {
    console.error('❌ Error in Google OAuth:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// POST /api/auth/logout
router.post('/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Set the session using the token
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        await supabase.auth.signOut();
        console.log('✅ User logged out successfully:', user.id);
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('❌ Error in logout:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// GET /api/auth/session
router.get('/auth/session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        user: null,
        session: null,
      });
    }

    const token = authHeader.substring(7);
    
    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.log('❌ Invalid token or user not found');
      return res.json({
        user: null,
        session: null,
      });
    }

    // Create a session object with the token
    // Note: We construct a minimal session object since we only have the access token
    // Increased expiry to 7 days (604800 seconds) instead of 1 hour
    const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
    const session = {
      access_token: token,
      token_type: 'bearer',
      expires_in: SESSION_EXPIRY_SECONDS,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS,
      refresh_token: null, // Refresh token not available from getUser
      user: user,
    };

    console.log('✅ Session validated for user:', user.id);

    res.json({
      user,
      session,
    });
  } catch (error) {
    console.error('❌ Error getting session:', error);
    res.json({
      user: null,
      session: null,
    });
  }
});

// POST /api/auth/resend-confirmation
router.post('/auth/resend-confirmation', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Email is required and must be a string',
      });
    }

    console.log('📧 Resending confirmation email to:', email);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      console.error('❌ Resend confirmation error:', error);
      return res.status(400).json({
        error: error.message,
        code: error.status,
      });
    }

    console.log('✅ Confirmation email sent');

    res.json({
      success: true,
      message: 'Confirmation email sent successfully',
    });
  } catch (error) {
    console.error('❌ Error resending confirmation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// POST /api/auth/google/callback
router.post('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    console.log('🔄 Processing Google OAuth callback');
    console.log('📦 Request body:', { hasCode: !!code, codeLength: code?.length });

    if (!code || typeof code !== 'string') {
      console.error('❌ Missing or invalid code');
      return res.status(400).json({
        error: 'Authorization code is required',
      });
    }

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('❌ OAuth callback error:', error);
      return res.status(400).json({
        error: error.message,
        code: error.status,
      });
    }

    if (!data.session || !data.user) {
      console.error('❌ Missing session or user in response');
      return res.status(400).json({
        error: 'Failed to create session',
      });
    }

    // Initialize credits for new Google OAuth users
    if (data.user?.id) {
      try {
        await creditService.initializeUserCredits(data.user.id);
      } catch (creditError) {
        console.error('⚠️ Failed to initialize credits (non-fatal):', creditError);
        // Don't fail OAuth if credit initialization fails
      }
    }

    console.log('✅ Google OAuth successful:', {
      userId: data.user.id,
      hasSession: !!data.session,
      hasToken: !!data.session.access_token,
    });

    res.json({
      success: true,
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('❌ Error in Google OAuth callback:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;

