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
    
    // Use the provided redirectTo or default to frontend callback
    const redirectUrl = redirectTo || `http://localhost:3000/auth/callback`;

    console.log('🔐 Received Google OAuth request');
    console.log('📍 Redirect URL:', redirectUrl);

    // Use Supabase client's signInWithOAuth method
    // This properly handles the OAuth flow with correct client configuration
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('❌ Google OAuth error:', error);
      return res.status(400).json({
        error: error.message,
        code: error.status,
      });
    }

    if (!data || !data.url) {
      console.error('❌ No OAuth URL returned');
      return res.status(500).json({
        error: 'Failed to generate OAuth URL',
      });
    }

    console.log('✅ Google OAuth URL generated:', data.url);

    res.json({
      success: true,
      url: data.url,
    });
  } catch (error) {
    console.error('❌ Error in Google OAuth:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
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
    const session = {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
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

