'use client';

import { useActionState, useEffect, useState } from 'react';
import { setUserUiLocale, type ActionState } from './actions';
import { useT } from '@/app/i18n/I18nProvider';

export default function UserLocaleSelector() {
  const [current, setCurrent] = useState<string>('en');
  const [list, setList] = useState<string[]>([]);
  const [state, action, pending] = useActionState<ActionState, FormData>(setUserUiLocale, {} as ActionState);
  const t = useT();

  useEffect(() => { void load(); }, []);

  async function load() {
    const resL = await fetch('/api/i18n/ui-languages', { cache: 'no-store' });
    if (resL.ok) { const d = await resL.json(); setList(d.locales || []); }
    const resC = await fetch('/api/ui-locale', { cache: 'no-store' });
    if (resC.ok) { const d = await resC.json(); setCurrent(d.locale || 'en'); }
  }

  useEffect(() => {
    if (state?.ok) {
      // Force reload to apply new bundle
      window.location.reload();
    }
  }, [state?.ok]);

  return (
    <form action={action} className="flex items-center gap-2 text-sm">
      <input type="hidden" name="locale" value={current} />
      <select value={current} onChange={(e)=>setCurrent(e.target.value)} className="rounded border px-2 py-1">
        {(list.length?list:['en','uk']).map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <button disabled={pending} className="rounded border px-3 py-1">{t('settings.languages.save', undefined, { fallback: 'Зберегти' })}</button>
      {state?.ok && <span className="text-xs text-green-600">{state.ok}</span>}
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
