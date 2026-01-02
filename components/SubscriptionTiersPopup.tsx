'use client';

import React, { useState } from 'react';
import { X, Check, Zap, Crown, Rocket } from 'lucide-react';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  credits: number;
  popular?: boolean;
  features: string[];
  icon: React.ReactNode;
  color: string;
}

interface SubscriptionTiersPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits?: number;
  creditsRequired?: number;
  onSelectTier?: (tierId: string) => void;
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 10,
    credits: 500, // $10 = 500 credits (50 credits/$1)
    features: [
      '500 credits',
      '~33 Seedream-4 images',
      '~400 FLUX Redux images',
      'Basic support'
    ],
    icon: <Zap className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20,
    credits: 1000, // $20 = 1000 credits
    popular: true,
    features: [
      '1,000 credits',
      '~66 Seedream-4 images',
      '~800 FLUX Redux images',
      'Priority support',
      'Best value'
    ],
    icon: <Crown className="w-6 h-6" />,
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 50,
    credits: 2500, // $50 = 2,500 credits
    features: [
      '2,500 credits',
      '~166 Seedream-4 images',
      '~2,000 FLUX Redux images',
      '24/7 priority support',
      'Custom integrations',
      'Volume discounts'
    ],
    icon: <Rocket className="w-6 h-6" />,
    color: 'from-orange-500 to-orange-600'
  }
];

export default function SubscriptionTiersPopup({
  isOpen,
  onClose,
  currentCredits = 0,
  creditsRequired = 0,
  onSelectTier
}: SubscriptionTiersPopupProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSelectTier = async (tierId: string) => {
    setSelectedTier(tierId);
    setIsProcessing(true);
    
    // Call the callback if provided
    if (onSelectTier) {
      await onSelectTier(tierId);
    }
    
    // TODO: Integrate with payment processing
    // For now, just show a message
    setTimeout(() => {
      alert(`Selected ${tierId} tier. Payment integration coming soon!`);
      setIsProcessing(false);
      setSelectedTier(null);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {creditsRequired > 0 
                ? `Insufficient Credits` 
                : `Upgrade Your Plan`}
            </h2>
            {creditsRequired > 0 && (
              <p className="text-sm text-gray-400">
                You need <span className="text-yellow-400 font-semibold">{creditsRequired.toFixed(2)} credits</span> but only have{' '}
                <span className="text-red-400 font-semibold">{currentCredits.toFixed(2)} credits</span> remaining.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-[#2a2a2a] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Current Status */}
          {currentCredits > 0 && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-400">
                ⚠️ You have <span className="font-semibold">{currentCredits.toFixed(2)} credits</span> remaining.
                {creditsRequired > 0 && (
                  <> You need <span className="font-semibold">{creditsRequired.toFixed(2)} more credits</span> to continue.</>
                )}
              </p>
            </div>
          )}

          {/* Tiers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {SUBSCRIPTION_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer ${
                  tier.popular
                    ? 'border-purple-500 bg-purple-500/10 scale-105'
                    : 'border-[#2a2a2a] bg-[#1f1f1f] hover:border-[#3a3a3a]'
                } ${selectedTier === tier.id ? 'ring-2 ring-purple-500' : ''}`}
                onClick={() => handleSelectTier(tier.id)}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${tier.color} mb-4`}>
                  <div className="text-white">{tier.icon}</div>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                
                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">${tier.price}</span>
                  <span className="text-gray-400 text-sm ml-1">one-time</span>
                </div>

                <div className="mb-4">
                  <span className="text-lg font-semibold text-purple-400">{tier.credits.toLocaleString()} credits</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectTier(tier.id);
                  }}
                  disabled={isProcessing && selectedTier === tier.id}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                    tier.popular
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'
                      : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white'
                  } ${isProcessing && selectedTier === tier.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isProcessing && selectedTier === tier.id ? 'Processing...' : 'Select Plan'}
                </button>
              </div>
            ))}
          </div>

          {/* Credit Conversion Info */}
          <div className="p-4 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg">
            <p className="text-xs text-gray-400 text-center">
              💡 <span className="font-semibold">Conversion Rate:</span> 1000 credits = $20 (1 credit = $0.02)
              <br />
              Credits never expire and can be used for all AI models.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

