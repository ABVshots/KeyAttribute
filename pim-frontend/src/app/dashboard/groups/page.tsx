// File: pim-frontend/src/app/dashboard/groups/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';
import ListClient from './ListClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function tS(k: string, _p?: Record<string, any>, o?: { fallback?: string }) { return o?.fallback || k; }

export default async function GroupsPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const supabase = createServerComponentClient({ cookies });
  const sp = (await searchParams) || {};
  const typeId = sp.type || '';
  const q = sp.q || '';
  const locale = sp.locale || 'en';
  const sort = sp.sort || 'name'; // name|created
  const order = (sp.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const size = Math.min(100, Math.max(5, parseInt(sp.size || '25', 10) || 25));
  const exact = sp.exact === '1';

  const { data: type } = typeId
    ? await supabase.from('group_types').select('id, label').eq('id', typeId).maybeSingle()
    : { data: null } as any;

  // Find matching IDs via translations when searching by q
  let filterIds: string[] | null = null;
  if (q) {
    if (exact) {
      const { data: digest } = await (supabase as any).rpc('canonicalize_md5', { p: q });
      const { data: trs } = await supabase
        .from('translations')
        .select('entity_id')
        .eq('entity_type', 'group')
        .eq('key', 'name')
        .eq('locale', locale)
        .eq('md5_value', (digest as string) || '')
        .limit(10000);
      filterIds = (trs ?? []).map((t: any) => t.entity_id as string);
    } else {
      const { data: trs } = await supabase
        .from('translations')
        .select('entity_id')
        .eq('entity_type', 'group')
        .eq('key', 'name')
        .eq('locale', locale)
        .ilike('value', `%${q}%`)
        .limit(10000);
      filterIds = (trs ?? []).map((t: any) => t.entity_id as string);
    }
    if (filterIds.length === 0) filterIds = ['00000000-0000-0000-0000-000000000000'];
  }

  // Base groups query
  let groupsQ = supabase
    .from('groups')
    .select('id, name, created_at')
    .order('created_at', { ascending: order === 'asc' ? true : false });
  if (typeId) groupsQ = groupsQ.eq('type_id', typeId);
  if (filterIds) groupsQ = groupsQ.in('id', filterIds);

  // Fetch all matching IDs to paginate (simple approach)
  const { data: allGroups } = await groupsQ;
  const total = (allGroups ?? []).length;
  const start = (page - 1) * size;
  const pageItems = (allGroups ?? []).slice(start, start + size);
  const ids = pageItems.map((g: any) => g.id as string);

  // Fetch localized names for display
  const { data: names } = await supabase
    .from('translations')
    .select('entity_id, value')
    .eq('entity_type', 'group')
    .eq('key', 'name')
    .eq('locale', locale)
    .in('entity_id', ids);
  const nameMap = new Map<string, string>((names ?? []).map((n: any) => [n.entity_id as string, n.value as string]));

  // Children count via group_links
  const { data: links } = await supabase
    .from('group_links')
    .select('parent_id')
    .in('parent_id', ids);
  const childCount = new Map<string, number>();
  (links ?? []).forEach((l: any) => {
    const k = l.parent_id as string; childCount.set(k, (childCount.get(k) || 0) + 1);
  });

  // Cover presence
  const { data: covers } = await supabase
    .from('entity_media')
    .select('entity_id')
    .eq('entity_type', 'group')
    .eq('role', 'cover')
    .in('entity_id', ids);
  const hasCover = new Set<string>((covers ?? []).map((c: any) => c.entity_id as string));

  // Sort page items by localized name if requested
  const display = pageItems.map((g: any) => ({
    id: g.id as string,
    name: (nameMap.get(g.id as string) || (g.name as string) || ''),
    created_at: g.created_at as string,
    children: childCount.get(g.id as string) || 0,
    cover: hasCover.has(g.id as string),
  }));
  if (sort === 'name') display.sort((a, b) => (order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));

  // Languages for locale select (optional)
  const { data: langs } = await supabase.from('organization_languages').select('locale, is_default, languages(label)').order('is_default', { ascending: false });
  const locales = (langs ?? []).map((l: any) => ({ code: l.locale as string, label: (l.languages?.label as string) || (l.locale as string) }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{type?.label ? tS('groups.titleWithType', { type: type.label }, { fallback: `Довідник: ${type.label}` }) : tS('groups.manage', undefined, { fallback: 'Керування Групами' })}</h1>
        <Link href="/dashboard/groups/new" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">{tS('groups.add', undefined, { fallback: '+ Додати' })}</Link>
      </div>

      <form method="get" className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-6">
        <input type="hidden" name="type" value={typeId} />
        <input name="q" defaultValue={q} placeholder={tS('groups.search', undefined, { fallback: 'Пошук…' })} className="rounded border px-2 py-1 text-sm md:col-span-2" />
        <select name="locale" defaultValue={locale} className="rounded border px-2 py-1 text-sm">
          {locales.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <select name="sort" defaultValue={sort} className="rounded border px-2 py-1 text-sm">
          <option value="name">{tS('groups.sort.name', undefined, { fallback: 'Назва' })}</option>
          <option value="created">{tS('groups.sort.created', undefined, { fallback: 'Створено' })}</option>
        </select>
        <select name="order" defaultValue={order} className="rounded border px-2 py-1 text-sm">
          <option value="asc">{tS('common.asc', undefined, { fallback: 'ASC' })}</option>
          <option value="desc">{tS('common.desc', undefined, { fallback: 'DESC' })}</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs"><input type="checkbox" name="exact" value="1" defaultChecked={exact} /> {tS('groups.exact', undefined, { fallback: 'exact' })}</label>
          <select name="size" defaultValue={String(size)} className="rounded border px-2 py-1 text-sm">
            {[10,25,50,100].map(n => <option key={n} value={n}>{tS('common.perPage', { n }, { fallback: `${n}/page` })}</option>)}
          </select>
          <button type="submit" className="rounded bg-zinc-800 px-3 py-1 text-xs text:white">{tS('common.filter', undefined, { fallback: 'Фільтрувати' })}</button>
        </div>
      </form>

      <div className="rounded-lg border bg:white p-2 shadow-sm">
        <ListClient rows={display} typeId={typeId || undefined} />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
        <div>{tS('common.total', { total }, { fallback: `Всього: ${total}` })}</div>
        <div className="flex items-center gap-2">
          <PageLink page={page-1} disabled={page<=1} params={{ ...sp, page: String(page-1), size: String(size) }}>{tS('common.prev', undefined, { fallback: 'Назад' })}</PageLink>
          <span>{tS('common.pageX', { page }, { fallback: `Сторінка ${page}` })}</span>
          <PageLink page={page+1} disabled={start+size>=total} params={{ ...sp, page: String(page+1), size: String(size) }}>{tS('common.next', undefined, { fallback: 'Далі' })}</PageLink>
        </div>
      </div>
    </div>
  );
}

function PageLink({ page, disabled, params, children }: { page: number; disabled?: boolean; params: Record<string,string>; children: any }) {
  if (disabled) return <span className="rounded border px-3 py-1 text-gray-400">{children}</span>;
  const qs = new URLSearchParams(params); qs.set('page', String(page));
  return <Link href={`/dashboard/groups?${qs.toString()}`} className="rounded border px-3 py-1 hover:bg-gray-50">{children}</Link>;
}