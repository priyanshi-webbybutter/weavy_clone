'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get parameters from URL query and hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // Check both query params and hash for code
        const code = urlParams.get('code') || hashParams.get('code');
        const error = urlParams.get('error') || hashParams.get('error');
        const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        console.log('🔄 OAuth callback received:', { 
          hasCode: !!code, 
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          error, 
          errorDescription,
          fullUrl: window.location.href
        });

        if (error) {
          console.error('❌ OAuth error:', error, errorDescription);
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => {
            router.push(`/login?error=${encodeURIComponent(errorDescription || error)}`);
          }, 2000);
          return;
        }

        // If we have tokens in the hash, use them directly
        if (accessToken) {
          console.log('✅ Found access token in hash, storing session...');
          localStorage.setItem('auth_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
          }
          
          // Get user info using the token
          try {
            const response = await fetch(`${API_BASE_URL}/auth/session`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });

            const data = await response.json();
            
            if (data.user) {
              setStatus('Authentication successful! Redirecting...');
              setTimeout(() => {
                window.location.href = '/';
              }, 500);
              return;
            }
          } catch (err) {
            console.error('Error fetching user info:', err);
          }
        }

        if (!code) {
          console.error('❌ No code or token in callback URL');
          setStatus('No authorization code received. Redirecting...');
          setTimeout(() => {
            router.push('/login?error=no_code');
          }, 2000);
          return;
        }

        setStatus('Exchanging code for session...');
        console.log('🔄 Exchanging code for session...');

        // Exchange code for session via backend
        const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('❌ Backend error:', data);
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => {
            router.push(`/login?error=${encodeURIComponent(data.error || 'oauth_failed')}`);
          }, 2000);
          return;
        }

        if (data.session && data.user) {
          console.log('✅ OAuth successful, storing session:', {
            userId: data.user.id,
            hasToken: !!data.session.access_token,
          });
          
          // Store session token
          localStorage.setItem('auth_token', data.session.access_token);
          
          setStatus('Authentication successful! Redirecting...');
          
          // Force page reload to update auth state
          setTimeout(() => {
            window.location.href = '/';
          }, 500);
        } else {
          console.error('❌ Missing session or user in response:', data);
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => {
            router.push('/login?error=oauth_failed');
          }, 2000);
        }
      } catch (error: any) {
        console.error('❌ OAuth callback error:', error);
        setStatus('An error occurred. Redirecting...');
        setTimeout(() => {
          router.push(`/login?error=${encodeURIComponent(error.message || 'oauth_failed')}`);
        }, 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="text-white text-lg mb-2">{status}</div>
        <div className="text-gray-400 text-sm">Please wait...</div>
      </div>
    </div>
  );
}

