import React from 'react';
import FlowCanvas from '@/components/FlowCanvas';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import CanvasClientWrapper from './CanvasClientWrapper';

export default async function CanvasPageWithName({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  return (
    <ProtectedRoute>
      <CanvasClientWrapper />
    </ProtectedRoute>
  );
}

