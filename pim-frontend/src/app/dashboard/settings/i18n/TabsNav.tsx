'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from '@/app/i18n/I18nProvider';

export default function TabsNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<'light'|'dark'>(() => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark') ? 'dark' : 'light');
  const t = useT();

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
    { href: '/dashboard/settings/i18n/languages', label: t('settings.tabs.languages', undefined, { fallback: 'Мови' }) },
    { href: '/dashboard/settings/i18n/import-export', label: t('settings.tabs.importExport', undefined, { fallback: 'Import/Export' }) },
    { href: '/dashboard/settings/i18n/keys', label: t('settings.tabs.keys', undefined, { fallback: 'Keys' }) },
    { href: '/dashboard/settings/i18n/messages', label: t('settings.tabs.messages', undefined, { fallback: 'Messages' }) },
    { href: '/dashboard/settings/i18n/overrides', label: t('settings.tabs.overrides', undefined, { fallback: 'Overrides' }) },
    { href: '/dashboard/settings/i18n/missing', label: t('settings.tabs.missing', undefined, { fallback: 'Missing' }) },
    { href: '/dashboard/settings/i18n/audit', label: t('settings.tabs.audit', undefined, { fallback: 'Audit' }) },
    { href: '/dashboard/settings/i18n/help', label: t('settings.tabs.help', undefined, { fallback: 'Help' }) },
  ];

  const tabs = isAdmin ? tabsAll : tabsAll.filter(t => t.href.endsWith('/languages') || t.href.endsWith('/import-export') || t.href.endsWith('/help'));

  return (
    <div className="border-b">
      <div className="flex items-center justify-between">
        <nav className="-mb-px flex flex-wrap gap-2" aria-label="Tabs">
          {tabs.map(ti => {
            const active = pathname?.startsWith(ti.href);
            return (
              <Link key={ti.href} href={ti.href}
                className={'px-3 py-2 text-sm ' + (active ? 'border-b-2 border-black font-medium' : 'text-gray-600 hover:text-black')}
              >{ti.label}</Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">{t('settings.tabs.theme', undefined, { fallback: 'Theme' })}</span>
          <button onClick={()=>setTheme(theme==='light'?'dark':'light')} className="rounded border px-2 py-1">
            {theme==='light' ? t('settings.tabs.light', undefined, { fallback: 'Light' }) : t('settings.tabs.dark', undefined, { fallback: 'Dark' })}
          </button>
        </div>
      </div>
    </div>
  );
}
