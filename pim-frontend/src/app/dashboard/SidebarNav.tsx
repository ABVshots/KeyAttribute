"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SidebarNav() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Головна', isActive: (p: string) => p === '/dashboard' },
    { href: '/dashboard/items', label: 'Товари', isActive: (p: string) => p.startsWith('/dashboard/items') },
    { href: '/dashboard/groups', label: 'Групи', isActive: (p: string) => p.startsWith('/dashboard/groups') },
    { href: '/dashboard/features', label: 'Довідники', isActive: (p: string) => p.startsWith('/dashboard/features') },
    { href: '/dashboard/prompts', label: 'AI Промти', isActive: (p: string) => p.startsWith('/dashboard/prompts') },
  ];

  return (
    <nav aria-label="Dashboard navigation" className="space-y-1">
      {links.map(({ href, label, isActive }) => {
        const active = isActive(pathname ?? '/');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              `block rounded-lg px-4 py-2 hover:bg-zinc-700 ` +
              (active ? 'bg-zinc-700' : '')
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
