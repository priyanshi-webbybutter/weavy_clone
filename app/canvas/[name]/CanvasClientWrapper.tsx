'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FlowCanvas from '@/components/FlowCanvas';

function CanvasClientWrapperContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return <FlowCanvas initialProjectId={projectId || null} />;
}

export default function CanvasClientWrapper() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CanvasClientWrapperContent />
    </Suspense>
  );
}
