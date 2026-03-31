'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import Toast from './Toast';
import NotificationCenter from './NotificationCenter';
import { useApp } from '../context/AppContext';

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const { error: appError, toast, dismissToast } = useApp();
  const visibleError = appError && appError !== dismissedError ? appError : null;

  const isAuthPage = pathname === '/login' || pathname?.startsWith('/auth/') || pathname === '/forgot-password' || pathname === '/welcome';

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — slides in on mobile, always visible on md+ */}
      <div className={`fixed md:static inset-y-0 left-0 z-40 md:z-auto transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar onSearchOpen={() => setSearchOpen(true)} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden bg-blue-900 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20 shadow">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded hover:bg-blue-800 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-sm flex-1">RentFlow Uganda</span>
          <NotificationCenter />
          <button
            onClick={() => setSearchOpen(true)}
            className="p-1.5 rounded hover:bg-blue-800 transition-colors"
            aria-label="Search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {visibleError && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between text-sm text-red-700">
            <span>{visibleError}</span>
            <button
              onClick={() => setDismissedError(visibleError)}
              className="ml-4 text-red-500 hover:text-red-700 font-bold text-lg leading-none"
              aria-label="Dismiss"
            >&times;</button>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}
