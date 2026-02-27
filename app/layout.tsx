import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './components/AuthProvider';
import LayoutContent from './components/LayoutContent';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RentFlow Uganda',
  description: 'Property management for Ugandan landlords',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <AppProvider>
            <LayoutContent>{children}</LayoutContent>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
