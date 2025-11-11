import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

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
      <body className="bg-[#0a0a0a] text-white">
        <Sidebar />
        <main className="ml-[68px] h-screen overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
