export type UiBundle = { locale: string; dict: Record<string, any>; version?: number };

function deepGet(obj: any, dotKey: string) {
  if (!obj) return undefined;
  // Try exact key at root
  if (Object.prototype.hasOwnProperty.call(obj, dotKey)) return obj[dotKey];
  const parts = dotKey.split('.');
  // Try namespaced flat key inside first segment, e.g., dict['settings']['tabs.languages']
  if (parts.length > 1 && Object.prototype.hasOwnProperty.call(obj, parts[0])) {
    const first = obj[parts[0]];
    const rest = parts.slice(1).join('.');
    if (first && typeof first === 'object' && Object.prototype.hasOwnProperty.call(first, rest)) {
      return first[rest];
    }
  }
  // Standard nested traversal
  return parts.reduce((o, k) => (o && k in o ? o[k] : undefined), obj);
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
  function format(text: string, params?: Record<string, any>, locale?: string): string {
    try {
      const { default: IntlMessageFormat } = require('intl-messageformat');
      const mf = new IntlMessageFormat(text, locale || 'en');
      return String(mf.format(params || {}));
    } catch {
      if (params) return text.replace(/\{(\w+)\}/g, (_, k) => (k in (params || {}) ? String((params as any)[k]) : `{${k}}`));
      return text;
    }
  }

  return function t(key: string, params?: Record<string, any>, opts?: { locale?: string; fallback?: string; path?: string }): string {
    const locales = buildFallbackChain(opts?.locale || 'en');
    let msg: any;
    for (const _ of locales) {
      const scoped = deepGet(dict, key);
      if (scoped !== undefined) { msg = scoped; break; }
    }
    if (msg === undefined) {
      if (process.env.NODE_ENV !== 'production') console.warn('[i18n missing]', key);
      try { fetch(`${location.origin}/api/i18n/missing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namespace: key.split('.').slice(0,-1).join('.'), key: key.split('.').slice(-1)[0], locale: opts?.locale || 'en', path: opts?.path || '' }) }); } catch {}
      const fb = opts?.fallback ?? key;
      return format(fb, params, opts?.locale);
    }
    return format(String(msg), params, opts?.locale);
  };
}
