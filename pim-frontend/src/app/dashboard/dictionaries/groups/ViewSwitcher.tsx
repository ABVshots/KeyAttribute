// File: pim-frontend/src/app/dashboard/dictionaries/groups/ViewSwitcher.tsx
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ViewSwitcher({ typeId }: { typeId?: string }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const type = typeId || sp.get('type') || '';

  const base = '/dashboard/dictionaries/groups';
  const listHref = `${base}/list${type ? `?type=${encodeURIComponent(type)}` : ''}`;
  const treeHref = `${base}/tree${type ? `?type=${encodeURIComponent(type)}` : ''}`;

  const isActive = (segment: 'list'|'tree') => pathname?.startsWith(`${base}/${segment}`);
  const btn = (active: boolean) => `rounded border px-3 py-1 ${active ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-200' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/40'}`;

  return (
    <div className="mb-4 flex items-center justify-end gap-2 text-sm">
      <Link href={listHref} className={btn(!!isActive('list'))} aria-current={isActive('list') ? 'page' : undefined}>List</Link>
      <Link href={treeHref} className={btn(!!isActive('tree'))} aria-current={isActive('tree') ? 'page' : undefined}>Tree</Link>
    </div>
  );
}
