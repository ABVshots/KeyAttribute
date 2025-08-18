// File: pim-frontend/src/app/dashboard/items/[id]/edit/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import EditItemForm from './EditItemForm';
import AIAnalyzeComponent from './AIAnalyzeComponent';
import AIGenerateComponent from './AIGenerateComponent';
import EmbeddingComponent from './EmbeddingComponent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditItemPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies });

  // 1. Завантажуємо сам товар та його поточні атрибути
  const { data: item, error } = await supabase
    .from('items')
    .select(`
      *,
      item_features ( feature_attribute_id, feature_id )
    `)
    .eq('id', params.id)
    .single();

  if (error || !item) {
    notFound();
  }

  // 2. Завантажуємо всі доступні атрибути для цієї організації (стабільне сортування)
  const { data: attributes } = await supabase
    .from('feature_attributes')
    .select('*')
    .order('label', { ascending: true })
    .order('code', { ascending: true });

  // 3. Завантажуємо всі можливі значення з довідників (стабільне сортування)
  const { data: features } = await supabase
    .from('features')
    .select('id, name, feature_type')
    .order('name', { ascending: true });

  // 4. (Опціонально) Опис з контенту для попереднього заповнення
  const { data: content } = await supabase
    .from('content_entries')
    .select('lang, description, updated_at')
    .eq('item_id', item.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 5. Формуємо початковий текст для AI: Назва + SKU + Опис + Атрибути
  const attrLabelMap = new Map((attributes ?? []).map((a: any) => [a.id, a.label]));
  const featureNameMap = new Map((features ?? []).map((f: any) => [f.id, f.name]));
  const pairs = (item.item_features ?? []).map((f: any) => {
    const label = attrLabelMap.get(f.feature_attribute_id) ?? f.feature_attribute_id;
    const value = featureNameMap.get(f.feature_id) ?? f.feature_id;
    return `${label}: ${value}`;
  });

  const prefillText = [
    `${item.title} (SKU: ${item.sku})`,
    content?.description ? `Опис: ${content.description}` : null,
    pairs.length ? `Атрибути:\n- ${pairs.join('\n- ')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  // 6. Завантажуємо доступні зображення (тільки display-варіанти)
  const { data: assets } = await supabase
    .from('media_assets')
    .select('id, storage_path')
    .eq('item_id', item.id)
    .eq('asset_type', 'display');

  return (
    <div>
      <h1 className="text-3xl font-bold">Редагувати товар</h1>
      <p className="mt-1 text-gray-500">SKU: {item.sku}</p>

      <EditItemForm
        item={item}
        attributes={attributes ?? []}
        features={features ?? []}
      />

      <AIAnalyzeComponent initialText={prefillText} />

      <AIGenerateComponent itemId={item.id} assets={assets ?? []} />

      <EmbeddingComponent itemId={item.id} />
    </div>
  );
}