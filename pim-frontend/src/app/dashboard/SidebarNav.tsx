"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, useRef } from 'react';

// Icons
function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 10.5 12 3l9 7.5"/>
      <path d="M5 10.5V21h14V10.5"/>
    </svg>
  );
}
function IconBox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 7l9-4 9 4-9 4-9-4Z"/>
      <path d="M3 7v10l9 4 9-4V7"/>
      <path d="M12 11v10"/>
    </svg>
  );
}
function IconBook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4Z"/>
      <path d="M18 4v16"/>
    </svg>
  );
}
function IconPlug(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 7v6m6-6v6"/>
      <path d="M7 13h10a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4Z"/>
    </svg>
  );
}
function IconSparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 2l1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2Z"/>
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>
    </svg>
  );
}
function IconGear(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/>
      <path d="M19.4 15a7.8 7.8 0 0 0 .1-6l2-1.2-2-3.5-2.3.7a8 8 0 0 0-5.4-2.3l-.5-2.2H10l-.5 2.2A8 8 0 0 0 4.1 5L1.8 4.2l-2 3.5 2 1.2a7.8 7.8 0 0 0 .1 6l-2 1.2 2 3.5 2.3-.7a8 8 0 0 0 5.4 2.3l.5 2.2h3.6l.5-2.2a8 8 0 0 0 5.4-2.3l2.3.7 2-3.5-2-1.2Z"/>
    </svg>
  );
}

// Sidebar modes
type SidebarMode = 'expanded' | 'compact' | 'icons';
const MODE_KEY = 'sidebar-mode';

export default function SidebarNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<SidebarMode>('expanded');
  const [openSettings, setOpenSettings] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && window.localStorage.getItem(MODE_KEY)) as SidebarMode | null;
    if (saved === 'expanded' || saved === 'compact' || saved === 'icons') setMode(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(MODE_KEY, mode);
    // Update CSS var for layout aside width
    const w = mode === 'expanded' ? '16rem' : '3.5rem'; // 64 -> 14
    document.documentElement.style.setProperty('--sidebar-w', w);
  }, [mode]);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!popRef.current) return;
      if (e.target instanceof Node && !popRef.current.contains(e.target)) setOpenSettings(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const links = useMemo(() => ([
    { href: '/dashboard', label: 'Головна', icon: IconHome, isActive: (p: string) => p === '/dashboard' },
    { href: '/dashboard/items', label: 'Товари', icon: IconBox, isActive: (p: string) => p.startsWith('/dashboard/items') },
    { href: '/dashboard/dictionaries', label: 'KeyFeatures', icon: IconBook, isActive: (p: string) => p.startsWith('/dashboard/dictionaries') },
    { href: '/dashboard/integrations', label: 'Інтеграції', icon: IconPlug, isActive: (p: string) => p.startsWith('/dashboard/integrations') },
    { href: '/dashboard/prompts', label: 'AI Промти', icon: IconSparkles, isActive: (p: string) => p.startsWith('/dashboard/prompts') },
  ]), []);

  const isExpanded = mode === 'expanded';
  const isCompact = mode === 'compact';
  const isIcons = mode === 'icons';

  return (
    <div className={`flex h-full flex-col ${isExpanded ? '' : 'p-0'} `}>
      {/* Nav items */}
      <nav aria-label="Dashboard navigation" className={`flex-1 space-y-1 overflow-y-auto ${isCompact ? 'group' : ''}`}>
        {links.map(({ href, label, icon: Icon, isActive }) => {
          const active = mounted && isActive(pathname ?? '/');
          return (
            <div key={href} className="relative">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-0 rounded-lg ${isExpanded ? 'px-3 py-2' : 'px-2 py-2'} transition-colors
                  ${active ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-700/60 text-zinc-100'}
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isExpanded && <span className="ml-3 truncate">{label}</span>}
              </Link>
              {isCompact && !isExpanded && !isIcons && (
                <span className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg ring-1 ring-black/10 group-hover:opacity-100">
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Settings gear with popover */}
      <div className="mt-auto pt-2">
        <div className="relative" ref={popRef}>
          <button
            onClick={() => setOpenSettings((v) => !v)}
            aria-label="Налаштування меню"
            className={`flex w-full items-center justify-center gap-2 rounded-lg ${isExpanded ? 'px-3 py-2' : 'px-2 py-2'} text-sm text-zinc-100 hover:bg-zinc-700/60`}
          >
            <IconGear className="h-5 w-5" />
            {isExpanded && <span>Налаштування</span>}
          </button>
          {openSettings && (
            <div className="absolute bottom-10 left-0 z-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 shadow-xl">
              <button onClick={() => { setMode('expanded'); setOpenSettings(false); }} className={`block w-full rounded px-2 py-1 text-left text-xs ${isExpanded ? 'bg-zinc-700' : 'hover:bg-zinc-700/60'}`}>Текст</button>
              <button onClick={() => { setMode('compact'); setOpenSettings(false); }} className={`mt-1 block w-full rounded px-2 py-1 text-left text-xs ${isCompact ? 'bg-zinc-700' : 'hover:bg-zinc-700/60'}`}>Ховер</button>
              <button onClick={() => { setMode('icons'); setOpenSettings(false); }} className={`mt-1 block w-full rounded px-2 py-1 text-left text-xs ${isIcons ? 'bg-zinc-700' : 'hover:bg-zinc-700/60'}`}>Іконки</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
