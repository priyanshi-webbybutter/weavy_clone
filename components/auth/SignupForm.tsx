'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setGoogleLoading(true);
    
    const { error } = await signInWithGoogle();
    
    if (error) {
      console.error('Google signup error:', error);
      setError(error.message);
      setGoogleLoading(false);
    }
    // Note: On success, user will be redirected to Google, then back to /auth/callback
    // The loading state will persist until redirect
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign Up</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6] transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">
                <p className="mb-2">Account created successfully!</p>
                <p className="text-xs text-green-300">
                  Please check your email to confirm your account before logging in.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-2 px-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : success ? 'Account created!' : 'Sign Up'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2a2a2a]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#1a1a1a] text-gray-400">Or continue with</span>
            </div>
          </div>

          {/* Google Signup Button */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading || success}
            className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Already have an account?{' '}
              <a href="/login" className="text-[#8b5cf6] hover:text-[#7c3aed] font-medium">
                Login
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

