'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import CanvasCanvas from '@/components/CanvasCanvas';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function CanvasCanvasPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return (
    <ProtectedRoute>
      <CanvasCanvas initialProjectId={projectId || null} />
    </ProtectedRoute>
  );
}

