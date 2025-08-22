export type UiBundle = { locale: string; dict: Record<string, any>; version?: number };

function deepGet(obj: any, dotKey: string) {
  return dotKey.split('.').reduce((o, k) => (o && k in o ? o[k] : undefined), obj);
}

export function deepMerge(a: any, b: any) {
  if (typeof a !== 'object' || a === null) return b;
  const out: any = Array.isArray(a) ? [...a] : { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

function buildFallbackChain(locale: string): string[] {
  const parts = locale.split('-');
  if (parts.length > 1) return [locale, parts[0], 'en'];
  return [locale, 'en'];
}

export function makeT(dict: Record<string, any>) {
  return function t(key: string, params?: Record<string, any>, opts?: { locale?: string; fallback?: string; path?: string }): string {
    const locales = buildFallbackChain(opts?.locale || 'en');
    let msg: any;
    for (const loc of locales) {
      const scoped = deepGet(dict, key);
      if (scoped !== undefined) { msg = scoped; break; }
    }
    if (msg === undefined) {
      if (process.env.NODE_ENV !== 'production') console.warn('[i18n missing]', key);
      try { fetch(`${location.origin}/api/i18n/missing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namespace: key.split('.').slice(0,-1).join('.'), key: key.split('.').slice(-1)[0], locale: opts?.locale || 'en', path: opts?.path || '' }) }); } catch {}
      return opts?.fallback ?? key;
    }
    const text = String(msg);
    try {
      // ICU formatting
      const { default: IntlMessageFormat } = require('intl-messageformat');
      const mf = new IntlMessageFormat(text, opts?.locale || 'en');
      return String(mf.format(params || {}));
    } catch {
      // Fallback to simple template replacement
      if (params) {
        return text.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
      }
      return text;
    }
  };
}
