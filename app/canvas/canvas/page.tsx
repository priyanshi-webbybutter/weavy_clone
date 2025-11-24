'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// Dynamically import CanvasCanvas with SSR disabled to avoid Konva Node.js canvas dependency
const CanvasCanvas = dynamic(() => import('@/components/CanvasCanvas'), {
  ssr: false,
});

export default function CanvasCanvasPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return (
    <ProtectedRoute>
      <CanvasCanvas initialProjectId={projectId || null} />
    </ProtectedRoute>
  );
}

