'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TabsNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<'light'|'dark'>(() => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') ? 'dark' : 'light');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/i18n/admins', { cache: 'no-store' });
        if (!mounted) return;
        if (res.ok) {
          const j = await res.json();
          setIsAdmin(!!j.isAdmin);
        } else {
          setIsAdmin(false);
        }
      } catch { setIsAdmin(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      document.cookie = `theme=${encodeURIComponent(theme)}; path=/; max-age=31536000`;
    } catch {}
  }, [theme]);

  const tabsAll = [
    { href: '/dashboard/settings/i18n/languages', label: 'Мови' },
    { href: '/dashboard/settings/i18n/import-export', label: 'Import/Export' },
    { href: '/dashboard/settings/i18n/keys', label: 'Keys' },
    { href: '/dashboard/settings/i18n/messages', label: 'Messages' },
    { href: '/dashboard/settings/i18n/overrides', label: 'Overrides' },
    { href: '/dashboard/settings/i18n/missing', label: 'Missing' },
    { href: '/dashboard/settings/i18n/audit', label: 'Audit' },
    { href: '/dashboard/settings/i18n/help', label: 'Help' },
  ];

  const tabs = isAdmin ? tabsAll : tabsAll.filter(t => t.href.endsWith('/languages') || t.href.endsWith('/import-export') || t.href.endsWith('/help'));

  return (
    <div className="border-b">
      <div className="flex items-center justify-between">
        <nav className="-mb-px flex flex-wrap gap-2" aria-label="Tabs">
          {tabs.map(t => {
            const active = pathname?.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href}
                className={'px-3 py-2 text-sm ' + (active ? 'border-b-2 border-black font-medium' : 'text-gray-600 hover:text-black')}
              >{t.label}</Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Theme</span>
          <button onClick={()=>setTheme(theme==='light'?'dark':'light')} className="rounded border px-2 py-1">
            {theme==='light' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>
    </div>
  );
}
