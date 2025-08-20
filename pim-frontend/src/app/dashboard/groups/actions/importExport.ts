// File: pim-frontend/src/app/dashboard/groups/actions/importExport.ts
'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { UUID_RE } from '@/lib/validation';
import { ensureMembership, getDefaultLocale } from '@/lib/org';
import crypto from 'crypto';

export type ImportActionState = {
  ok?: string;
  error?: string;
  details?: {
    create: Array<{ defaultName: string; md5: string }>;
    linkById: Array<{ id: string; defaultName: string }>;
    linkByMd5: Array<{ matchedId: string; md5: string; defaultName: string }>;
    updateTranslations: Array<{ id: string; defaultName: string }>;
  };
};

type NamesByLocale = Record<string, string>;

type ImportEntry = { id?: string; names: NamesByLocale };

function canonicalizeJs(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function md5Of(s: string) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

export async function importChildrenAction(prev: ImportActionState, formData: FormData): Promise<ImportActionState> {
  try {
    const parent_id = String(formData.get('parent_id') ?? '').trim();
    const payload = String(formData.get('items') ?? '').trim();
    const dryRun = String(formData.get('dry_run') ?? '').trim() === '1';
    if (!UUID_RE.test(parent_id) || !payload) return { error: 'bad_payload' };

    const supabase = createServerActionClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'unauthorized' };

    const { data: parent } = await supabase
      .from('groups')
      .select('id, organization_id, type_id')
      .eq('id', parent_id)
      .maybeSingle();
    if (!parent) return { error: 'not_found' };

    const allowed = await ensureMembership(supabase as any, parent.organization_id as string, user.id);
    if (!allowed) return { error: 'forbidden' };

    // Parse items: JSON [{ id?, name|names }], or { items: [...] }, or CSV (name/name_<locale>), or lines
    let entries: ImportEntry[] = [];
    let rawNames: string[] = [];
    try {
      const asJson = JSON.parse(payload);
      if (Array.isArray(asJson)) {
        entries = asJson.map((x: any) => {
          const names: NamesByLocale = {};
          if (x && typeof x === 'object') {
            if (typeof x.name === 'string' && x.name.trim()) names['__default__'] = x.name.trim();
            if (x.names && typeof x.names === 'object') {
              for (const [loc, val] of Object.entries(x.names)) {
                if (typeof val === 'string' && val.trim()) names[loc] = val.trim();
              }
            }
          }
          const id = typeof x?.id === 'string' ? x.id : undefined;
          return { id, names };
        }).filter(e => Object.keys(e.names).length > 0);
      } else if (asJson && typeof asJson === 'object' && Array.isArray((asJson as any).items)) {
        const list = (asJson as any).items as Array<any>;
        entries = list.map((x: any) => {
          const names: NamesByLocale = {};
          if (x && typeof x === 'object' && x.names && typeof x.names === 'object') {
            for (const [loc, val] of Object.entries(x.names)) {
              if (typeof val === 'string' && val.trim()) names[loc] = val.trim();
            }
          }
          const id = typeof x?.id === 'string' ? x.id : undefined;
          return { id, names };
        }).filter(e => Object.keys(e.names).length > 0);
      }
    } catch {
      const lines = payload.split(/\r?\n/).map(l => l.trim());
      const nonEmpty = lines.filter(Boolean);
      if (nonEmpty.length > 0) {
        const hasDelim = /,|;|\t|\|/.test(nonEmpty[0]);
        if (hasDelim) {
          const delim = /,|;|\t|\|/;
          const header = nonEmpty[0].split(delim).map(h => h.trim());
          const nameCols = header
            .map((h, idx) => ({ h, idx }))
            .filter(({ h }) => h.toLowerCase() === 'name' || /^name[_-][a-z]{2,}/i.test(h));
          const dataRows = nonEmpty.slice(1);
          for (const row of dataRows) {
            const cols = row.split(delim);
            const names: NamesByLocale = {};
            for (const { h, idx } of nameCols) {
              const val = (cols[idx] ?? '').toString().trim();
              if (!val) continue;
              if (h.toLowerCase() === 'name') names['__default__'] = val;
              else {
                const loc = h.split(/[_-]/)[1]?.toLowerCase();
                if (loc) names[loc] = val;
              }
            }
            if (Object.keys(names).length > 0) entries.push({ names });
          }
        } else {
          rawNames = nonEmpty;
        }
      }
    }

    if (entries.length === 0 && rawNames.length > 0) {
      entries = rawNames.map(n => ({ names: { '__default__': n } }));
    }
    if (entries.length === 0) return { error: 'empty' };

    const defLoc = await getDefaultLocale(supabase as any, parent.organization_id as string);

    const resolvedIds: string[] = [];
    const matchKinds: Array<'id' | 'md5' | 'new'> = [];
    const chosenNames: string[] = [];
    const md5Digests: string[] = [];
    for (const entry of entries) {
      let gid: string | null = null;
      let kind: 'id' | 'md5' | 'new' = 'new';
      // Prefer explicit id if valid and belongs to same org/type
      if (entry.id && UUID_RE.test(entry.id)) {
        const { data: exists } = await supabase
          .from('groups')
          .select('id, organization_id, type_id')
          .eq('id', entry.id)
          .maybeSingle();
        if (exists && exists.organization_id === parent.organization_id && exists.type_id === parent.type_id) {
          gid = exists.id as string;
          kind = 'id';
        }
      }
      // Fallback to md5_name dedupe using default-locale (or provided) name
      if (!gid) {
        const chosen = (entry.names[defLoc] ?? entry.names['__default__'] ?? Object.values(entry.names)[0] ?? '').toString();
        // use DB hashing for consistency
        const { data: digest } = await (supabase as any).rpc('canonicalize_md5', { p: chosen });
        const { data: found } = await supabase
          .from('groups')
          .select('id')
          .eq('organization_id', parent.organization_id as string)
          .eq('type_id', parent.type_id as string)
          .eq('md5_name', digest as string)
          .maybeSingle();
        if (found?.id) { gid = found.id as string; kind = 'md5'; }
        else {
          if (dryRun) { gid = 'NEW'; kind = 'new'; }
          else {
            // Insert new
            const { data: ins, error: insErr } = await supabase
              .from('groups')
              .insert({ organization_id: parent.organization_id, name: chosen, type_id: parent.type_id as string })
              .select('id')
              .maybeSingle();
            if (insErr || !ins?.id) return { error: 'insert_failed' };
            gid = ins.id as string; kind = 'new';
          }
        }
        chosenNames.push(chosen);
        md5Digests.push((digest as string) ?? md5Of(canonicalizeJs(chosen)));
      } else {
        const chosen = (entry.names[defLoc] ?? entry.names['__default__'] ?? Object.values(entry.names)[0] ?? '').toString();
        const { data: digest } = await (supabase as any).rpc('canonicalize_md5', { p: chosen });
        chosenNames.push(chosen);
        md5Digests.push((digest as string) ?? md5Of(canonicalizeJs(chosen)));
      }
      // Link via N:N table
      if (!dryRun && gid && gid !== 'NEW') {
        await supabase.from('group_links').upsert({
          organization_id: parent.organization_id as string,
          type_id: parent.type_id as string,
          parent_id: parent.id as string,
          child_id: gid,
        });
      }
      resolvedIds.push(gid as string);
      matchKinds.push(kind);
    }

    // Upsert translations for provided locales (only for new/id matches)
    if (!dryRun) {
      const trRows: any[] = [];
      entries.forEach((entry, i) => {
        const gid = resolvedIds[i];
        const kind = matchKinds[i];
        if (kind === 'md5' || gid === 'NEW') return;
        for (const [k, v] of Object.entries(entry.names)) {
          if (!v) continue;
          const locale = k === '__default__' ? defLoc : k;
          trRows.push({ organization_id: parent.organization_id as string, entity_type: 'group', entity_id: gid, locale, key: 'name', value: v });
        }
      });
      if (trRows.length > 0) {
        await supabase.from('translations').upsert(trRows, { onConflict: 'organization_id,entity_type,entity_id,locale,key' });
      }
    }

    revalidatePath(`/dashboard/groups/${parent_id}/edit`);
    const created = matchKinds.filter(k => k === 'new').length;
    const linked = matchKinds.filter(k => k !== 'new').length;
    const details = {
      create: matchKinds.map((k, i) => k === 'new' ? { defaultName: chosenNames[i], md5: md5Digests[i] } : null).filter(Boolean) as Array<{ defaultName: string; md5: string }>,
      linkById: matchKinds.map((k, i) => k === 'id' ? { id: resolvedIds[i], defaultName: chosenNames[i] } : null).filter(Boolean) as Array<{ id: string; defaultName: string }>,
      linkByMd5: matchKinds.map((k, i) => k === 'md5' ? { matchedId: resolvedIds[i], md5: md5Digests[i], defaultName: chosenNames[i] } : null).filter(Boolean) as Array<{ matchedId: string; md5: string; defaultName: string }>,
      updateTranslations: matchKinds.map((k, i) => k === 'id' ? { id: resolvedIds[i], defaultName: chosenNames[i] } : null).filter(Boolean) as Array<{ id: string; defaultName: string }>,
    };
    return { ok: `${dryRun ? 'dry_run:' : ''}created:${created},linked:${linked}`, details };
  } catch {
    return { error: 'import_failed' };
  }
}
