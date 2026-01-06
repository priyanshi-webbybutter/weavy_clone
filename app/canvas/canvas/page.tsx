'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// Dynamically import CanvasCanvas with SSR disabled to avoid Konva Node.js canvas dependency
const CanvasCanvas = dynamic(() => import('@/components/CanvasCanvas'), {
  ssr: false,
});

function CanvasCanvasContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return (
    <ProtectedRoute>
      <CanvasCanvas initialProjectId={projectId || null} />
    </ProtectedRoute>
  );
}

export default function CanvasCanvasPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CanvasCanvasContent />
    </Suspense>
  );
}

