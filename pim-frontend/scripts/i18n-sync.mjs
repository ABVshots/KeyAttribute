#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const EN_FILE = path.join(root, 'public', 'i18n', 'en.json');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

async function upsertNamespaces(nsList) {
  for (const name of nsList) {
    await supabase.from('ui_namespaces').upsert({ name }, { onConflict: 'name' });
  }
}

async function syncEn(dict) {
  const namespaces = Object.keys(dict || {});
  await upsertNamespaces(namespaces);
  for (const ns of namespaces) {
    const entries = Object.entries(dict[ns] || {});
    if (!entries.length) continue;
    // upsert keys
    await supabase.from('ui_keys').upsert(entries.map(([key]) => ({ namespace: ns, key })), { onConflict: 'namespace,key' });
    // upsert messages (en)
    await supabase.from('ui_messages_global').upsert(entries.map(([key, value]) => ({ key_id: null, locale: 'en', value, namespace: ns, key })), { ignoreDuplicates: true });
    // resolve key_ids and ensure message rows
    const { data: rows } = await supabase.from('ui_keys').select('id, key').eq('namespace', ns);
    const idByKey = new Map((rows||[]).map(r => [r.key, r.id]));
    const payload = entries.map(([key, value]) => ({ key_id: idByKey.get(key), locale: 'en', value }));
    await supabase.from('ui_messages_global').upsert(payload, { onConflict: 'key_id,locale' });
  }
  // bump global version
  const { data: ver } = await supabase.from('i18n_catalog_versions').select('id, version').eq('scope', 'global').is('org_id', null).maybeSingle();
  if (ver?.id) await supabase.from('i18n_catalog_versions').update({ version: (ver.version||0)+1, updated_at: new Date().toISOString() }).eq('id', ver.id);
  else await supabase.from('i18n_catalog_versions').insert({ scope: 'global', org_id: null, version: 1 });
}

(async () => {
  const en = readJsonSafe(EN_FILE);
  if (!Object.keys(en).length) {
    console.error('en.json empty or missing');
    process.exit(1);
  }
  await syncEn(en);
  console.log('i18n:sync → DB updated from en.json');
})();
