// File: pim-frontend/src/app/dashboard/items/[id]/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import UploadComponent from './UploadComponent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerComponentClient({ cookies });
  const { data: item, error } = await supabase
    .from('items')
    .select('id, sku, title, organization_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !item) {
    notFound();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{item.title}</h1>
        <Link
          href={`/dashboard/items/${item.id}/edit`}
          className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Редагувати
        </Link>
      </div>
      <p className="text-gray-500">SKU: {item.sku}</p>

      <div className="mt-8">
        <UploadComponent itemId={item.id} orgId={item.organization_id} />
      </div>
    </div>
  );
}