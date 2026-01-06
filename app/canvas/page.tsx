'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FlowCanvas from '@/components/FlowCanvas';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

function CanvasPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return (
    <ProtectedRoute>
      <FlowCanvas initialProjectId={projectId || null} />
    </ProtectedRoute>
  );
}

export default function CanvasPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CanvasPageContent />
    </Suspense>
  );
}

