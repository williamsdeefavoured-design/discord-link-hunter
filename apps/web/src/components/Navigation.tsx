'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, ListFilter, Activity, Settings, ShieldCheck, ScanSearch } from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', href: '/', icon: Activity },
  { name: 'Discover', href: '/discover', icon: Compass },
  { name: 'Jobs', href: '/jobs', icon: ListFilter },
  { name: 'Results', href: '/results', icon: ShieldCheck },
  { name: 'System', href: '/settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-[#263345] bg-[#0b111aec] backdrop-blur-lg">
      <div className="max-w-[1420px] mx-auto px-4 sm:px-7 xl:px-10">
        <div className="min-h-[72px] flex items-center justify-between gap-5">
          <Link href="/" className="flex items-center gap-3 shrink-0 group" aria-label="Link Hunter home">
            <div className="h-10 w-10 rounded-[9px] border border-[#54788b] bg-[#173142] flex items-center justify-center text-[#a9d8e6] group-hover:border-[#87bbc6] transition-colors">
              <ScanSearch className="h-5 w-5" strokeWidth={1.65} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[16px] font-bold tracking-[-.055em] text-[#eff5fa]">LINK HUNTER<span className="text-[#7db6ba]">.</span></span>
              <span className="text-[9px] tracking-[.16em] text-[#8b9cac] font-semibold uppercase">Research intelligence</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-stretch gap-1 self-stretch" aria-label="Main navigation">
            {NAV_ITEMS.map(({ name, href, icon: Icon }) => (
              <Link key={href} href={href} data-current={pathname === href} aria-current={pathname === href ? 'page' : undefined}
                className={`workspace-nav-link inline-flex items-center gap-2 px-3.5 pt-[3px] text-[13px] font-medium ${pathname === href ? '' : 'text-[#8f9fb0]'}`}>
                <Icon className="h-[14px] w-[14px]" strokeWidth={1.7} /><span>{name}</span>
              </Link>
            ))}
          </nav>
          <span className="hidden xl:flex items-center gap-2 text-[10px] tracking-[.13em] uppercase text-[#9eafc0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#73b9aa]" aria-hidden="true" /> Private workspace
          </span>
        </div>
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto -mx-2 px-2 pb-0" aria-label="Mobile navigation">
          {NAV_ITEMS.map(({ name, href, icon: Icon }) => (
            <Link key={href} href={href} data-current={pathname === href} aria-current={pathname === href ? 'page' : undefined}
              className={`workspace-nav-link inline-flex shrink-0 items-center gap-1.5 px-3 py-3 text-[12px] ${pathname === href ? '' : 'text-[#91a4b5]'}`}>
              <Icon className="h-3.5 w-3.5" /><span>{name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
