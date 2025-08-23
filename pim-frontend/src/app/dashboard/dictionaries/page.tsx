// File: pim-frontend/src/app/dashboard/dictionaries/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { createDictionary, createRootForType } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function tS(k: string, _p?: Record<string, any>, o?: { fallback?: string }) { return o?.fallback || k; }

export default async function DictionariesHub() {
  const supabase = createServerComponentClient({ cookies });

  const { data: types } = await supabase
    .from('group_types')
    .select('id, code, label, organization_id')
    .order('label');

  const list = (types ?? []).map((t) => ({ id: t.id as string, code: t.code as string, label: (t.label as string) || (t.code as string), org: t.organization_id as string }));
  const typeIds = list.map(t => t.id);
  const orgIds = Array.from(new Set(list.map((t) => t.org).filter(Boolean)));

  // Fetch all groups for these types (for counts, roots, covers)
  const { data: groups } = typeIds.length > 0
    ? await supabase.from('groups').select('id, type_id, parent_id').in('type_id', typeIds)
    : { data: [] as any[] } as any;
  const groupIds = (groups ?? []).map((g: any) => g.id as string);

  // Links for these types (for roots and link count)
  const { data: links } = typeIds.length > 0
    ? await supabase.from('group_links').select('child_id, type_id').in('type_id', typeIds)
    : { data: [] as any[] } as any;

  // Covers for these groups
  const { data: covers } = groupIds.length > 0
    ? await supabase.from('entity_media').select('entity_id').eq('entity_type', 'group').eq('role', 'cover').in('entity_id', groupIds)
    : { data: [] as any[] } as any;

  // Fetch languages allowed by RLS (usually current org); do not over-filter to avoid empty results
  const { data: orgLangs } = await supabase
    .from('organization_languages')
    .select('organization_id, locale, is_default');

  // Build maps
  const idToType = new Map<string, string>();
  const totalByType = new Map<string, number>();
  (groups ?? []).forEach((g: any) => {
    const t = g.type_id as string; const id = g.id as string;
    idToType.set(id, t);
    totalByType.set(t, (totalByType.get(t) || 0) + 1);
  });

  const linksByType = new Map<string, number>();
  const childSetByType = new Map<string, Set<string>>();
  (links ?? []).forEach((l: any) => {
    const t = l.type_id as string; const c = l.child_id as string;
    linksByType.set(t, (linksByType.get(t) || 0) + 1);
    if (!childSetByType.has(t)) childSetByType.set(t, new Set());
    childSetByType.get(t)!.add(c);
  });

  // Add legacy parent_id edges to the link counts
  (groups ?? []).forEach((g: any) => {
    if (g.parent_id) {
      const t = g.type_id as string;
      linksByType.set(t, (linksByType.get(t) || 0) + 1);
    }
  });

  const rootsCountByType = new Map<string, number>();
  (groups ?? []).forEach((g: any) => {
    const t = g.type_id as string; const id = g.id as string;
    const childSet = childSetByType.get(t) || new Set<string>();
    const isRootByLinks = !childSet.has(id);
    const isRootLegacy = (g.parent_id as any) === null;
    if (isRootByLinks || isRootLegacy) rootsCountByType.set(t, (rootsCountByType.get(t) || 0) + 1);
  });

  const hasCoverSet = new Set<string>((covers ?? []).map((c: any) => c.entity_id as string));
  const coversByType = new Map<string, number>();
  (groups ?? []).forEach((g: any) => {
    const id = g.id as string; const t = g.type_id as string;
    if (hasCoverSet.has(id)) coversByType.set(t, (coversByType.get(t) || 0) + 1);
  });

  const langsByOrg = new Map<string, { count: number; def?: string }>();
  (orgLangs ?? []).forEach((l: any) => {
    const org = l.organization_id as string;
    const prev = langsByOrg.get(org) || { count: 0, def: undefined };
    const next = { count: prev.count + 1, def: prev.def || (l.is_default ? (l.locale as string) : undefined) };
    langsByOrg.set(org, next);
  });

  // Determine which types already have at least one root (for button visibility)
  const hasRoot = new Map<string, boolean>();
  (list ?? []).forEach((t) => {
    const rc = rootsCountByType.get(t.id) || 0; if (rc > 0) hasRoot.set(t.id, true);
  });

  return (
    <div>
      <h1 className="text-3xl font-bold">{tS('dictionaries.title', undefined, { fallback: 'KeyFeatures' })}</h1>
      <p className="mt-2 text-gray-500">{tS('dictionaries.subtitle', undefined, { fallback: 'Довідники та BOM-структури вашої організації' })}</p>

      {/* Create new dictionary */}
      <div className="mt-6 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{tS('dictionaries.create.title', undefined, { fallback: 'Створити новий довідник' })}</h2>
        <form action={createDictionary} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-sm text-gray-600">{tS('dictionaries.create.name', undefined, { fallback: 'Назва' })}</label>
            <input name="label" required className="mt-1 w-full rounded border px-3 py-2" placeholder={tS('dictionaries.create.name.ph', undefined, { fallback: 'Напр.: Характеристики' })} />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm text-gray-600">{tS('dictionaries.create.code', undefined, { fallback: 'Код (необов\'язково)' })}</label>
            <input name="code" className="mt-1 w-full rounded border px-3 py-2" placeholder={tS('dictionaries.create.code.ph', undefined, { fallback: 'auto з назви' })} />
          </div>
          <div className="sm:col-span-1 flex items-end justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="create_root" defaultChecked className="h-4 w-4" />
              {tS('dictionaries.create.root', undefined, { fallback: 'Створити кореневий вузол' })}
            </label>
            <button className="rounded bg-zinc-800 px-4 py-2 text-sm text-white">{tS('dictionaries.create.submit', undefined, { fallback: 'Створити' })}</button>
          </div>
        </form>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {list.length === 0 && (
          <div className="rounded border bg:white p-4 text-gray-500">{tS('dictionaries.empty', undefined, { fallback: 'Немає типів довідників' })}</div>
        )}
        {list.map((t) => {
          const total = totalByType.get(t.id) || 0;
          const roots = rootsCountByType.get(t.id) || 0;
          const linksCount = linksByType.get(t.id) || 0;
          const coverCount = coversByType.get(t.id) || 0;
          const langs = langsByOrg.get(t.org) || { count: 0, def: undefined };
          return (
            <div key={t.id} className="rounded-lg border bg-white p-4 shadow">
              <div className="text-sm text-gray-500">{tS('dictionaries.card.code', undefined, { fallback: 'Код:' })} {t.code}</div>
              <div className="text-lg font-semibold">{t.label}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="rounded border p-2"><div className="text-[11px] uppercase text-gray-400">{tS('dictionaries.card.items', undefined, { fallback: 'Елементів' })}</div><div className="text-base font-semibold">{total}</div></div>
                <div className="rounded border p-2"><div className="text-[11px] uppercase text-gray-400">{tS('dictionaries.card.roots', undefined, { fallback: 'Корені' })}</div><div className="text-base font-semibold">{roots}</div></div>
                <div className="rounded border p-2"><div className="text-[11px] uppercase text-gray-400">{tS('dictionaries.card.links', undefined, { fallback: 'Зв\'язків' })}</div><div className="text-base font-semibold">{linksCount}</div></div>
                <div className="rounded border p-2"><div className="text-[11px] uppercase text-gray-400">{tS('dictionaries.card.cover', undefined, { fallback: 'Cover' })}</div><div className="text-base font-semibold">{coverCount}</div></div>
                <div className="rounded border p-2 col-span-2"><div className="text-[11px] uppercase text-gray-400">{tS('dictionaries.card.langs', undefined, { fallback: 'Мови' })}</div><div className="text-sm">{langs.count} {langs.def ? tS('dictionaries.card.langs.default', { def: langs.def }, { fallback: `(дефолт: ${langs.def})` }) : ''}</div></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/dashboard/dictionaries/groups/list?type=${encodeURIComponent(t.id)}`} className="rounded border px-3 py-1 text-xs">{tS('dictionaries.actions.open', undefined, { fallback: 'Відкрити' })}</Link>
                <Link href={`/dashboard/dictionaries/groups/tree?type=${encodeURIComponent(t.id)}`} className="rounded border px-3 py-1 text-xs">{tS('dictionaries.actions.tree', undefined, { fallback: 'Дерево' })}</Link>
                {!hasRoot.get(t.id) && (
                  <form action={createRootForType}>
                    <input type="hidden" name="type_id" value={t.id} />
                    <input type="hidden" name="label" value={t.label} />
                    <button className="rounded border px-3 py-1 text-xs">{tS('dictionaries.actions.createRoot', undefined, { fallback: 'Створити корінь' })}</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
