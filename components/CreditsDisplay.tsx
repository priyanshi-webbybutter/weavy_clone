'use client';

import React, { useState, useEffect } from 'react';
import { Coins, AlertCircle } from 'lucide-react';
import SubscriptionTiersPopup from './SubscriptionTiersPopup';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface CreditsDisplayProps {
  className?: string;
  showButton?: boolean;
}

export default function CreditsDisplay({ className = '', showButton = true }: CreditsDisplayProps) {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubscriptionPopup, setShowSubscriptionPopup] = useState(false);

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/credits`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch credits: ${response.status}`);
      }

      const data = await response.json();
      setCredits(data.credits);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching credits:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
    
    // Refresh credits every 30 seconds
    const interval = setInterval(fetchCredits, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const hasNoCredits = credits !== null && credits <= 0;
  const isLowCredits = credits !== null && credits > 0 && credits < 10;

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-red-400 ${className}`}>
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">Error loading credits</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${
        hasNoCredits 
          ? 'bg-red-500/20 text-red-400' 
          : isLowCredits 
          ? 'bg-yellow-500/20 text-yellow-400' 
          : 'bg-[#2a2a2a] text-gray-300'
      }`}>
        <Coins className="w-4 h-4" />
        <span className="text-sm font-medium">
          {credits !== null ? credits.toFixed(2) : '0.00'} credits
        </span>
      </div>

      {showButton && hasNoCredits && (
        <button
          onClick={() => setShowSubscriptionPopup(true)}
          className="px-3 py-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-sm font-medium rounded-md transition-colors"
        >
          Buy Credits
        </button>
      )}
      
      {/* Subscription Tiers Popup */}
      {showSubscriptionPopup && (
        <SubscriptionTiersPopup
          isOpen={showSubscriptionPopup}
          onClose={() => setShowSubscriptionPopup(false)}
          currentCredits={credits || 0}
          creditsRequired={0}
          onSelectTier={async (tierId) => {
            // TODO: Implement payment processing
            console.log('Selected tier:', tierId);
            fetchCredits(); // Refresh after purchase
          }}
        />
      )}
    </div>
  );
}

// Hook to get credits and refresh function
export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCredits = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/credits`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch credits: ${response.status}`);
      }

      const data = await response.json();
      setCredits(data.credits);
    } catch (err) {
      console.error('Error fetching credits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCredits();
  }, []);

  return { credits, loading, refreshCredits };
}

