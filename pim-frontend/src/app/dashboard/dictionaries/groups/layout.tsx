// File: pim-frontend/src/app/dashboard/dictionaries/groups/layout.tsx
import Link from 'next/link';
import ViewSwitcher from './ViewSwitcher';

function tS(k: string, _p?: Record<string, any>, o?: { fallback?: string }) { return o?.fallback || k; }

export default function DictionariesGroupsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tS('dictionaries.title', undefined, { fallback: 'KeyFeatures' })}</h1>
        <ViewSwitcher />
      </div>
      {children}
    </div>
  );
}
