'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import FlowCanvas from '@/components/FlowCanvas';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function CanvasPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return (
    <ProtectedRoute>
      <FlowCanvas initialProjectId={projectId || null} />
    </ProtectedRoute>
  );
}

