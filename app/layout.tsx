import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './components/AuthProvider';
import LayoutContent from './components/LayoutContent';
import { ThemeProvider } from './components/ThemeProvider';
import { RoleProvider } from './context/RoleContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RentFlow Uganda',
  description: 'Property management for Ugandan landlords',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <RoleProvider>
                <LayoutContent>{children}</LayoutContent>
              </RoleProvider>
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
