'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, ListFilter, Activity, Settings, ShieldCheck, Terminal } from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', href: '/', icon: Activity },
  { name: 'Discover', href: '/discover', icon: Compass },
  { name: 'Jobs', href: '/jobs', icon: ListFilter },
  { name: 'Results', href: '/results', icon: ShieldCheck },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">Discord Link Hunter</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v2.1
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              Ready
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

