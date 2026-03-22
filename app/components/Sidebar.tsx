'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'H' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/ai-contract', label: 'AI Contract', icon: 'AI' },
  { href: '/reminders', label: 'AI Reminders', icon: 'RM' },
  { href: '/ai-insights', label: 'AI Insights', icon: 'IN' },
  { href: '/properties', label: 'Properties', icon: 'P' },
  { href: '/tenants', label: 'Tenants', icon: 'T' },
  { href: '/leases', label: 'Leases', icon: 'L' },
  { href: '/payments', label: 'Payments', icon: '$' },
  { href: '/maintenance', label: 'Maintenance', icon: 'M' },
  { href: '/expenses', label: 'Expenses', icon: 'E' },
  { href: '/tax-reports', label: 'Tax Reports', icon: 'R' },
  { href: '/reconcile', label: 'Reconcile', icon: '⚖' },
  { href: '/import', label: 'Import Data', icon: '↓' },
  { href: '/settings', label: 'Settings', icon: 'S' },
];

export default function Sidebar({ onSearchOpen }: { onSearchOpen?: () => void }) {
  const pathname = usePathname();
  const { applications } = useApp();
  const { user, signOut } = useAuth();

  const pendingApps = applications.filter(a => a.status === 'Pending').length;

  return (
    <aside className="w-64 bg-blue-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-blue-800">
        <h1 className="text-xl font-bold">RentFlow Uganda</h1>
        <p className="text-blue-300 text-sm">Property Management</p>
      </div>

      {user && (
        <div className="p-4 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold">
              {user.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-xs text-blue-300">Signed in</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-2 pt-2">
        <button
          onClick={onSearchOpen}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-blue-300 hover:bg-blue-800 transition-colors text-sm mb-1"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-xs bg-blue-800 px-1.5 py-0.5 rounded opacity-75">⌘K</kbd>
        </button>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                isActive ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-800'
              }`}>
              <span className="w-8 h-8 rounded bg-blue-800 flex items-center justify-center text-sm font-bold">{item.icon}</span>
              <span>{item.label}</span>
              {item.href === '/properties' && pendingApps > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingApps}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blue-800">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-blue-200 hover:bg-blue-800 transition-colors"
        >
          <span className="w-8 h-8 rounded bg-blue-800 flex items-center justify-center text-sm font-bold">&rarr;</span>
          <span>Sign Out</span>
        </button>
      </div>

      <div className="p-4 border-t border-blue-800 text-blue-300 text-xs">
        RentFlow Uganda v1.0
      </div>
    </aside>
  );
}
