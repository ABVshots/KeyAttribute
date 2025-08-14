// File: pim-frontend/src/app/dashboard/layout.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SidebarNav from './SidebarNav';

// Забороняємо кешування цього сегмента (автентифікація не має кешуватись)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });

  // Перевіряємо саме користувача та обробляємо можливу помилку
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    redirect('/login?error=auth');
  }
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-zinc-800 p-6 text-white">
        <h1 className="mb-8 text-xl font-bold">PIM Dashboard</h1>
        <SidebarNav />
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}