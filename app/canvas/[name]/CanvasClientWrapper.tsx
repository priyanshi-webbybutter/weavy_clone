'use client';

import { useSearchParams } from 'next/navigation';
import FlowCanvas from '@/components/FlowCanvas';

export default function CanvasClientWrapper() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  return <FlowCanvas initialProjectId={projectId || null} />;
}
