import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Weavy - AI Design Canvas',
  description: 'AI-powered design workflows with node-based canvas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-white m-0 p-0 overflow-hidden">
        <AuthProvider>
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}
