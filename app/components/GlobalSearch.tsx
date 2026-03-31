'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useRouter } from 'next/navigation';

type ResultType = 'Tenant' | 'Property' | 'Lease' | 'Page';

interface SearchResult {
  type: ResultType;
  label: string;
  sub: string;
  href: string;
}

const QUICK_LINKS: SearchResult[] = [
  { type: 'Page', label: 'Dashboard', sub: '/', href: '/' },
  { type: 'Page', label: 'Tenants', sub: '/tenants', href: '/tenants' },
  { type: 'Page', label: 'Payments', sub: '/payments', href: '/payments' },
  { type: 'Page', label: 'Leases', sub: '/leases', href: '/leases' },
  { type: 'Page', label: 'Properties', sub: '/properties', href: '/properties' },
  { type: 'Page', label: 'Maintenance', sub: '/maintenance', href: '/maintenance' },
  { type: 'Page', label: 'Tax Reports', sub: '/tax-reports', href: '/tax-reports' },
];

const TYPE_COLORS: Record<ResultType, string> = {
  Tenant: 'bg-blue-100 text-blue-700',
  Property: 'bg-green-100 text-green-700',
  Lease: 'bg-yellow-100 text-yellow-700',
  Page: 'bg-gray-100 text-gray-600',
};

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { tenants, properties, leases } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return [
      ...tenants
        .filter(t => t.full_name.toLowerCase().includes(q) || t.phone.includes(q) || t.email.toLowerCase().includes(q))
        .map(t => ({ type: 'Tenant' as const, label: t.full_name, sub: t.phone || t.email, href: '/tenants' })),
      ...properties
        .filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.district.toLowerCase().includes(q))
        .map(p => ({ type: 'Property' as const, label: p.name, sub: p.district || p.address, href: '/properties' })),
      ...leases
        .filter(l => {
          const tenant = tenants.find(t => t.id === l.tenant_id);
          return tenant?.full_name.toLowerCase().includes(q) || l.status.toLowerCase().includes(q);
        })
        .map(l => {
          const tenant = tenants.find(t => t.id === l.tenant_id);
          return { type: 'Lease' as const, label: tenant ? `Lease — ${tenant.full_name}` : 'Lease', sub: l.status.replace(/_/g, ' '), href: '/leases' };
        }),
    ].slice(0, 8);
  }, [query, tenants, properties, leases]);

  const displayItems = query.trim() ? results : QUICK_LINKS;

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, displayItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && displayItems[selectedIndex]) navigate(displayItems[selectedIndex].href);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search tenants, properties, leases..."
            aria-label="Search tenants, properties, leases"
            role="combobox"
            aria-expanded={query.length > 0}
            aria-autocomplete="list"
            className="flex-1 text-gray-800 placeholder-gray-400 outline-none text-sm"
          />
          <kbd className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded shrink-0">Esc</kbd>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {query.trim() && results.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            <>
              <p className="px-4 pt-3 pb-1 text-xs text-gray-400 font-medium uppercase tracking-wide">
                {query.trim() ? 'Results' : 'Quick Links'}
              </p>
              {displayItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => navigate(item.href)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${TYPE_COLORS[item.type]}`}>{item.type}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                    <p className="text-xs text-gray-500 truncate">{item.sub}</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-400">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
