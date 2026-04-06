'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signInWithGoogle: () => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const parseResponseBody = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const checkSessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get session from backend with retry mechanism
  const checkSession = async (retryCount = 0): Promise<boolean> => {
    const MAX_RETRIES = 2;
    
    // Prevent multiple simultaneous checks
    if (isCheckingSession && retryCount === 0) {
      return false;
    }

    setIsCheckingSession(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        setIsCheckingSession(false);
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Check if response is OK before parsing
      if (!response.ok) {
        // Only clear session on 401 (Unauthorized) - token is invalid
        if (response.status === 401) {
          console.log('❌ Token invalid (401), clearing session');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
          setSession(null);
          setLoading(false);
          setIsCheckingSession(false);
          return false;
        }
        // For other errors (500, network issues), don't clear session
        // The token might still be valid, just server issue
        console.warn('⚠️ Session check failed but keeping token:', response.status);
        setLoading(false);
        setIsCheckingSession(false);
        return false;
      }

      const data = await response.json();
      
      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
        localStorage.setItem('auth_token', data.session.access_token);
        // Store refresh token if available
        if (data.session.refresh_token) {
          localStorage.setItem('refresh_token', data.session.refresh_token);
        }
        setLoading(false);
        setIsCheckingSession(false);
        return true; // Session is valid
      } else {
        // Only clear if explicitly told user/session is null (not network error)
        console.log('❌ No user/session in response, clearing');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setSession(null);
        setLoading(false);
        setIsCheckingSession(false);
        return false; // Session is invalid
      }
    } catch (error) {
      // Network errors - retry before giving up
      if (retryCount < MAX_RETRIES && error instanceof TypeError) {
        console.log(`🔄 Retrying session check (${retryCount + 1}/${MAX_RETRIES})...`);
        setIsCheckingSession(false);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return checkSession(retryCount + 1);
      }
      
      // After retries exhausted or non-network error, don't clear session
      // Network errors shouldn't invalidate a potentially valid token
      console.error('⚠️ Network error checking session (keeping token):', error);
      setLoading(false);
      setIsCheckingSession(false);
      return false;
    }
  };

  // Debounced session check to prevent rapid successive calls
  const debouncedCheckSession = () => {
    if (checkSessionTimeoutRef.current) {
      clearTimeout(checkSessionTimeoutRef.current);
    }
    checkSessionTimeoutRef.current = setTimeout(() => {
      checkSession();
    }, 300); // Wait 300ms before checking
  };

  // Get session from backend on mount and set up periodic refresh
  useEffect(() => {
    checkSession();
    
    // Refresh session every 30 minutes (before expiry)
    // This keeps the session alive as long as the user is active
    const refreshInterval = setInterval(() => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        console.log('🔄 Refreshing session...');
        checkSession();
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Also refresh when window regains focus (user comes back to tab)
    // Use debounced version to prevent rapid checks on rapid tab switches
    const handleFocus = () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        console.log('🔄 Window focused, refreshing session...');
        debouncedCheckSession();
      }
    };
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
      if (checkSessionTimeoutRef.current) {
        clearTimeout(checkSessionTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await parseResponseBody(response);

      if (!response.ok) {
        const message = data.message || data.error || data.raw || 'Signup failed';
        return { error: { message } };
      }

      // Store session if available
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        localStorage.setItem('auth_token', data.session.access_token);
        // Store refresh token if available
        if (data.session.refresh_token) {
          localStorage.setItem('refresh_token', data.session.refresh_token);
        }
      }

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Network error' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await parseResponseBody(response);

      if (!response.ok) {
        const message = data.message || data.error || data.raw || 'Login failed';
        return { error: { message } };
      }

      // Store session
      if (data.session && data.user) {
        console.log('✅ Login successful, storing session:', {
          userId: data.user.id,
          hasToken: !!data.session.access_token,
        });
        setSession(data.session);
        setUser(data.user);
        localStorage.setItem('auth_token', data.session.access_token);
        // Store refresh token if available
        if (data.session.refresh_token) {
          localStorage.setItem('refresh_token', data.session.refresh_token);
        }
        // State is now updated, no need to call checkSession
      } else {
        console.warn('⚠️ Login response missing session or user:', data);
      }

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Network error' } };
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('🔄 Initiating Google OAuth...');
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirectTo: `${window.location.origin}/auth/callback`,
        }),
      });

      const data = await parseResponseBody(response);
      console.log('📦 Backend response:', { ok: response.ok, data });

      if (!response.ok) {
        console.error('❌ Backend error response:', data);
        return { 
          error: { 
            message: data.message || data.error || data.raw || 'Google OAuth failed',
            error: data.error,
            code: data.code
          } 
        };
      }

      // Redirect to Google OAuth URL
      if (data.url) {
        console.log('✅ Redirecting to Google OAuth URL');
        window.location.href = data.url;
        return { error: null };
      } else {
        console.error('❌ No OAuth URL in response:', data);
        return { error: { message: 'No OAuth URL received from server' } };
      }
    } catch (error: any) {
      console.error('❌ Network error:', error);
      return { error: { message: error.message || 'Network error' } };
    }
  };

  const signOut = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }

      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error logging out:', error);
      // Clear local state even if API call fails
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

