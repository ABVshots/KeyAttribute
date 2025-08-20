// File: pim-frontend/src/app/dashboard/dictionaries/groups/layout.tsx
import Link from 'next/link';
import ViewSwitcher from './ViewSwitcher';

export default function DictionariesGroupsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">KeyFeatures</h1>
        <ViewSwitcher />
      </div>
      {children}
    </div>
  );
}
