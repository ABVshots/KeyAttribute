// File: pim-frontend/src/app/dashboard/settings/i18n/actions.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type ActionState = { ok?: string; error?: string };
export type ImportDetails = { created: number; updated: number; items: Array<{ op: 'create'|'update'; namespace: string; key: string; locale: string }> };
export type ImportState = ActionState & { details?: ImportDetails };

async function bumpVersionGlobal(supabase: any) {
  const { data } = await supabase
    .from('i18n_catalog_versions')
    .select('id, version')
    .eq('scope', 'global')
    .is('org_id', null)
    .maybeSingle();
  if (data?.id) {
    await supabase.from('i18n_catalog_versions').update({ version: (data.version as number) + 1, updated_at: new Date().toISOString() }).eq('id', data.id as number);
  } else {
    await supabase.from('i18n_catalog_versions').insert({ scope: 'global', org_id: null, version: 1 });
  }
}

async function getOrgId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.organization_id as string) ?? null;
}

export async function createUiTranslation(prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const namespace = String(formData.get('namespace') ?? '').trim();
  const key = String(formData.get('key') ?? '').trim();
  const locale = String(formData.get('locale') ?? '').trim();
  const value = String(formData.get('value') ?? '').trim();
  if (!namespace || !key || !locale || !value) return { error: 'missing' };

  // ensure namespace (ignore duplicates)
  await supabase.from('ui_namespaces').upsert({ name: namespace }, { onConflict: 'name' });
  // ensure key
  let keyId: string | null = null;
  const { data: keyRow } = await supabase.from('ui_keys').select('id').eq('namespace', namespace).eq('key', key).maybeSingle();
  if (keyRow?.id) keyId = keyRow.id as string;
  else {
    const { data: ins } = await supabase.from('ui_keys').insert({ namespace, key }).select('id').maybeSingle();
    keyId = ins?.id as string;
  }
  if (!keyId) return { error: 'key' };

  // upsert global message
  const { error } = await supabase.from('ui_messages_global').upsert({ key_id: keyId, locale, value }, { onConflict: 'key_id,locale' });
  if (error) return { error: error.message };
  await bumpVersionGlobal(supabase);
  revalidatePath('/dashboard/settings/i18n');
  return { ok: 'created' };
}

export async function updateUiTranslation(prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const id = String(formData.get('id') ?? '');
  const value = String(formData.get('value') ?? '').trim();
  const keyId = String(formData.get('key_id') ?? '').trim();
  const locale = String(formData.get('locale') ?? '').trim();
  if (!keyId || !locale || !value) return { error: 'missing' };
  const { error } = await supabase.from('ui_messages_global').upsert({ key_id: keyId, locale, value }, { onConflict: 'key_id,locale' });
  if (error) return { error: error.message };
  await bumpVersionGlobal(supabase);
  revalidatePath('/dashboard/settings/i18n');
  return { ok: 'updated' };
}

export async function deleteUiTranslation(prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const keyId = String(formData.get('key_id') ?? '').trim();
  const locale = String(formData.get('locale') ?? '').trim();
  if (!keyId || !locale) return { error: 'missing' };
  const { error } = await supabase.from('ui_messages_global').delete().eq('key_id', keyId).eq('locale', locale);
  if (error) return { error: error.message };
  await bumpVersionGlobal(supabase);
  revalidatePath('/dashboard/settings/i18n');
  redirect('/dashboard/settings/i18n');
}

export async function importUiTranslations(prev: ImportState, formData: FormData): Promise<ImportState> {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const raw = String(formData.get('payload') ?? '').trim();
  const dryRun = String(formData.get('dry_run') ?? '').trim() === '1';
  if (!raw) return { error: 'empty' };

  type Item = { namespace: string; key: string; locale: string; value: string };
  let items: Item[] = [];
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      items = data.filter(Boolean).map((x: any) => ({ namespace: String(x.namespace||'').trim(), key: String(x.key||'').trim(), locale: String(x.locale||'').trim(), value: String(x.value||'').trim() }))
        .filter(i => i.namespace && i.key && i.locale && i.value);
    } else if (data && typeof data === 'object') {
      for (const [ns, keys] of Object.entries<any>(data)) {
        if (!keys || typeof keys !== 'object') continue;
        for (const [k, locs] of Object.entries<any>(keys)) {
          if (!locs || typeof locs !== 'object') continue;
          for (const [loc, val] of Object.entries<any>(locs)) {
            const v = String(val ?? '').trim();
            if (!v) continue;
            items.push({ namespace: ns, key: k, locale: loc, value: v });
          }
        }
      }
    }
  } catch {
    // Try CSV: header can be (namespace,key,locale,value) or (namespace,key,<loc1>,<loc2>,...)
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length>0);
    if (lines.length > 1) {
      const header = lines[0].split(',').map(h => h.trim());
      const idxNs = header.findIndex(h => h.toLowerCase()==='namespace');
      const idxKey = header.findIndex(h => h.toLowerCase()==='key');
      const idxLocale = header.findIndex(h => h.toLowerCase()==='locale');
      const idxValue = header.findIndex(h => h.toLowerCase()==='value');
      if (idxNs>=0 && idxKey>=0 && idxLocale>=0 && idxValue>=0) {
        // long format
        for (const row of lines.slice(1)) {
          const cols = row.split(',');
          const ns = String(cols[idxNs]||'').trim();
          const k = String(cols[idxKey]||'').trim();
          const loc = String(cols[idxLocale]||'').trim();
          const val = String(cols[idxValue]||'').trim();
          if (ns && k && loc && val) items.push({ namespace: ns, key: k, locale: loc, value: val });
        }
      } else if (idxNs>=0 && idxKey>=0) {
        // wide format: per-locale columns
        const localeCols = header.map((h,i)=>({h,i})).filter(x => x.i!==idxNs && x.i!==idxKey);
        for (const row of lines.slice(1)) {
          const cols = row.split(',');
          const ns = String(cols[idxNs]||'').trim();
          const k = String(cols[idxKey]||'').trim();
          if (!ns || !k) continue;
          for (const {h,i} of localeCols) {
            const val = String(cols[i]||'').trim();
            if (!val) continue;
            items.push({ namespace: ns, key: k, locale: h.trim(), value: val });
          }
        }
      }
    }
  }

  if (items.length === 0) return { error: 'no_items' };

  let created = 0, updated = 0;
  const detailItems: ImportDetails['items'] = [];

  for (const it of items) {
    await supabase.from('ui_namespaces').upsert({ name: it.namespace }, { onConflict: 'name' });
    let keyId: string | null = null;
    const { data: keyRow } = await supabase.from('ui_keys').select('id').eq('namespace', it.namespace).eq('key', it.key).maybeSingle();
    if (keyRow?.id) keyId = keyRow.id as string; else {
      const { data: ins } = await supabase.from('ui_keys').insert({ namespace: it.namespace, key: it.key }).select('id').maybeSingle();
      keyId = ins?.id as string;
    }
    if (!keyId) continue;
    const { data: existing } = await supabase.from('ui_messages_global').select('key_id').eq('key_id', keyId).eq('locale', it.locale).maybeSingle();
    if (existing?.key_id) {
      if (!dryRun) { const { error } = await supabase.from('ui_messages_global').update({ value: it.value }).eq('key_id', keyId).eq('locale', it.locale); if (!error) updated++; }
      else updated++;
      detailItems.push({ op: 'update', namespace: it.namespace, key: it.key, locale: it.locale });
    } else {
      if (!dryRun) { const { error } = await supabase.from('ui_messages_global').insert({ key_id: keyId, locale: it.locale, value: it.value }); if (!error) created++; }
      else created++;
      detailItems.push({ op: 'create', namespace: it.namespace, key: it.key, locale: it.locale });
    }
  }

  if (!dryRun) await bumpVersionGlobal(supabase);
  revalidatePath('/dashboard/settings/i18n');
  const details = { created, updated, items: detailItems };
  return { ok: `${dryRun ? 'dry_run:' : ''}imported:${created+updated} (created:${created}, updated:${updated})`, details };
}

export async function setUserUiLocale(prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const locale = String(formData.get('locale') ?? '').trim();
  if (!locale) return { error: 'missing' };
  await supabase.from('user_ui_prefs').upsert({ user_id: user.id, ui_locale: locale });
  (await cookies()).set('ui_locale', locale, { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60*60*24*365 });
  revalidatePath('/dashboard');
  return { ok: 'saved' };
}
