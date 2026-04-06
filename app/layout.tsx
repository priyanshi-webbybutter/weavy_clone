import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Poppins } from 'next/font/google';

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
});

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
      <body className={`${poppins.variable} font-sans bg-[#0E1518] text-white m-0 p-0 overflow-hidden`}>
        <AuthProvider>
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}
