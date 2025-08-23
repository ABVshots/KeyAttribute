"use client";

import { useEffect, useState } from 'react';
import JobStatus from './JobStatus';
import { useT } from '@/app/i18n/I18nProvider';

const templateJson = `[
  { "namespace": "emails", "key": "welcome", "locale": "en", "value": "Welcome {name}" },
  { "namespace": "emails", "key": "welcome", "locale": "uk", "value": "Вітаємо {name}" }
]`;

const templateCsvLong = `namespace,key,locale,value\nemails,welcome,en,Welcome {name}\nemails,welcome,uk,Вітаємо {name}`;

type Org = { id: string; name: string };

export default function ImportJobBox() {
  const [format, setFormat] = useState<'json'|'csv'>('json');
  const [scope, setScope] = useState<'global'|'org'>('org');
  const [text, setText] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<any | null>(null);
  const [checking, setChecking] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const t = useT();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/i18n/admins', { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          setIsAdmin(!!j.isAdmin);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    async function loadOrgs() {
      try {
        const res = await fetch('/api/orgs/mine', { cache: 'no-store' });
        const j = await res.json();
        const items: Org[] = j?.items || [];
        setOrgs(items);
        if (items.length && !orgId) setOrgId(items[0].id);
      } catch {/* noop */}
    }
    if (scope === 'org') loadOrgs();
  }, [scope]);

  useEffect(() => {
    // Enforce org-only for non-admins
    if (!isAdmin && scope !== 'org') setScope('org');
  }, [isAdmin, scope]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
    if (f.name.toLowerCase().endsWith('.csv')) setFormat('csv');
    else setFormat('json');
  }

  async function runPreflight() {
    setChecking(true);
    setError(null);
    setPreflight(null);
    try {
      const res = await fetch('/api/i18n/import/preflight', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, payload: text })
      });
      const j = await res.json();
      if (!res.ok) { setError(mapError(res.status, j)); setToast(t('settings.import.preflight.fail', undefined, { fallback: 'Перевірка не пройдена' })); setTimeout(()=>setToast(null), 2500); return; }
      setPreflight(j);
      if (j.total === 0) { setToast(t('settings.import.nothing', undefined, { fallback: 'Немає елементів для імпорту' })); setTimeout(()=>setToast(null), 2500); }
    } catch (e:any) {
      setError(e.message || 'preflight_failed');
    } finally {
      setChecking(false);
    }
  }

  function mapError(status: number, body: any): string {
    const code = body?.error || '';
    if (status === 403) return scope === 'global' ? t('settings.import.err.adminGlobal', undefined, { fallback: 'Потрібні права platform_admin для Global' }) : t('settings.import.err.noRights', undefined, { fallback: 'Немає прав' });
    if (code === 'no_org' || code === 'no_org_membership') return t('settings.import.err.noOrg', undefined, { fallback: 'Ви не в організації або orgId недійсний' });
    if (code === 'too_many_jobs') return t('settings.import.err.tooMany', undefined, { fallback: 'Занадто багато активних задач. Спробуйте пізніше' });
    if (code === 'rate_limited') return t('settings.import.err.rateLimited', { mins: body?.windowMinutes||10 }, { fallback: 'Перевищено ліміт. Зачекайте {mins} хв' });
    if (code === 'payload_too_large') return t('settings.import.err.payloadLarge', undefined, { fallback: 'Payload завеликий. Обмеження 1MB' });
    if (code === 'too_many_items') return t('settings.import.err.tooManyItems', { max: body?.max||'' }, { fallback: 'Занадто багато рядків. Максимум {max}' });
    if (code === 'invalid_locale') return t('settings.import.err.invalidLocale', undefined, { fallback: 'Невалідна або вимкнена локаль' });
    if (code === 'bad_request') return t('settings.import.err.badRequest', undefined, { fallback: 'Некоректний формат або вхідні дані' });
    return body?.error || `Помилка (${status})`;
  }

  async function startJob() {
    setError(null);
    setJobId(null);
    try {
      if (!isAdmin && scope === 'global') {
        setError(t('settings.import.err.adminGlobal', undefined, { fallback: 'Потрібні права platform_admin для Global' }));
        return;
      }
      if (scope === 'org' && (!orgId || orgs.length === 0)) {
        setError(t('settings.import.err.noOrg', undefined, { fallback: 'Ви не в організації або не обрано org' }));
        return;
      }
      const res = await fetch('/api/i18n/import/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, format, payload: text, orgId: scope==='org' ? orgId : undefined })
      });
      const j = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(mapError(res.status, j));
      setJobId(j.id);
    } catch (e: any) {
      setError(e.message || 'error');
    }
  }

  function download(name: string, content: string, mime = 'text/plain') {
    const a = document.createElement('a');
    a.href = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
    a.download = name;
    a.click();
  }

  const canStart = !!text && (!preflight || (preflight && preflight.total > 0 && !error));

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".json,.csv" onChange={onFile} className="text-xs" />
        <select value={format} onChange={(e)=>setFormat(e.target.value as any)} className="rounded border px-2 py-1 text-xs">
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input type="radio" name="scope" value="org" checked={scope==='org'} onChange={()=>setScope('org')} /> Org
        </label>
        <label className={`flex items-center gap-1 text-xs ${!isAdmin ? 'opacity-50' : ''}`}>
          <input type="radio" name="scope" value="global" checked={scope==='global'} onChange={()=>setScope('global')} disabled={!isAdmin} /> Global
        </label>
        {scope==='org' && (
          <select value={orgId} onChange={(e)=>setOrgId(e.target.value)} className="rounded border px-2 py-1 text-xs">
            {orgs.length===0 ? (
              <option value="">{t('settings.import.noOrg', undefined, { fallback: 'нема org' })}</option>
            ) : orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{t('settings.import.scope', { scope: isAdmin ? scope : 'org' }, { fallback: 'Scope: {scope}' })}</span>
        <button onClick={runPreflight} disabled={!text || checking} className="rounded border px-3 py-1">{checking ? t('settings.import.checking', undefined, { fallback: 'Перевірка…' }) : t('settings.import.check', undefined, { fallback: 'Перевірити' })}</button>
        <button onClick={startJob} disabled={!canStart} className="rounded bg-zinc-800 px-3 py-1 text-white disabled:opacity-50">{t('settings.import.start', undefined, { fallback: 'Start Job' })}</button>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <button onClick={()=>download('i18n-template.json', templateJson, 'application/json')} className="underline">{t('settings.import.downloadJson', undefined, { fallback: 'Завантажити шаблон JSON' })}</button>
        <span>·</span>
        <button onClick={()=>download('i18n-template-long.csv', templateCsvLong, 'text/csv')} className="underline">{t('settings.import.downloadCsv', undefined, { fallback: 'Завантажити шаблон CSV' })}</button>
      </div>
      <textarea value={text} onChange={(e)=>setText(e.target.value)} className="h-36 w-full rounded border p-2 font-mono" placeholder={t('settings.import.placeholder', undefined, { fallback: '[{"namespace":"sidebar","key":"home","locale":"uk","value":"Головна"}] або {"sidebar": {"home": {"uk":"Головна"}}} або CSV' })} />
      {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
      {preflight && (
        <div className="rounded border p-2 text-xs">
          <div>{t('settings.import.summary', { total: preflight.total, namespaces: preflight.namespaces, keys: preflight.keys, warns: preflight.placeholder_warnings }, { fallback: 'Елементів: {total}, Namespaces: {namespaces}, Keys: {keys}, ICU warnings: {warns}' })}</div>
          {typeof preflight.invalid_locales === 'number' && (
            <div className="mt-1">{t('settings.import.invalidLocales', { n: preflight.invalid_locales }, { fallback: 'Невалідних локалей: {n}' })}{preflight.invalid_locale_samples?.length>0 && (
              <>
                <div className="mt-1">{t('settings.import.samples', undefined, { fallback: 'Приклади (до 50):' })}</div>
                <ul className="mt-1 list-disc pl-4">
                  {preflight.invalid_locale_samples.slice(0,10).map((x:any,i:number)=> (<li key={i}>{x.namespace}.{x.key} [{x.locale}]</li>))}
                </ul>
              </>
            )}</div>
          )}
          {preflight.warnings?.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {preflight.warnings.map((w:any, i:number)=> (
                <li key={i}>{w.namespace}.{w.key}: {w.baseLocale} → {w.locale} · {t('settings.import.missing', { items: w.missing.join(', ') }, { fallback: 'missing: [{items}]' })}, {t('settings.import.extra', { items: w.extra.join(', ') }, { fallback: 'extra: [{items}]' })}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {jobId && <JobStatus id={jobId} />}
      {toast && <div className="rounded border bg-yellow-50 p-2 text-xs text-yellow-800">{toast}</div>}
    </div>
  );
}
