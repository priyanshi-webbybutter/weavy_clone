'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Give auth context time to initialize
    if (!loading) {
      console.log('🔒 ProtectedRoute check:', { hasUser: !!user, loading });
      // Small delay to ensure state is fully propagated
      const timer = setTimeout(() => {
        setIsChecking(false);
        if (!user) {
          console.log('❌ No user found, redirecting to login');
          router.push('/login');
        } else {
          console.log('✅ User authenticated, allowing access');
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // If no user after loading, don't render (will redirect)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}

