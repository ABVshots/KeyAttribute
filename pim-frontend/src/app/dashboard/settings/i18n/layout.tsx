import Link from 'next/link';
import TabsNav from './TabsNav';
import AdminToggle from './AdminToggle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function I18nLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">UI Translations</h1>
        <div className="flex items-center gap-2">
          <AdminToggle />
          <Link href="/dashboard" className="rounded border px-3 py-1 text-sm">Назад</Link>
        </div>
      </div>
      <TabsNav />
      <div className="mt-4">{children}</div>
    </div>
  );
}
