import FlowCanvas from '@/components/FlowCanvas';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function Home() {
  return (
    <ProtectedRoute>
      <FlowCanvas />
    </ProtectedRoute>
  );
}
