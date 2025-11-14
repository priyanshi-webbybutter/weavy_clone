'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Get session from backend
  const checkSession = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/auth/session`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
        localStorage.setItem('auth_token', data.session.access_token);
      } else {
        localStorage.removeItem('auth_token');
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  // Get session from backend on mount
  useEffect(() => {
    checkSession();
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

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || 'Signup failed' } };
      }

      // Store session if available
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        localStorage.setItem('auth_token', data.session.access_token);
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

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || 'Login failed' } };
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
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirectTo: `${window.location.origin}/auth/callback`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || 'Google OAuth failed' } };
      }

      // Redirect to Google OAuth URL
      if (data.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (error: any) {
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
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error logging out:', error);
      // Clear local state even if API call fails
      localStorage.removeItem('auth_token');
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

