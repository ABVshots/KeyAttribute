#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const EN_FILE = path.join(root, 'public', 'i18n', 'en.json');
const UK_FILE = path.join(root, 'public', 'i18n', 'uk.json');
const OUT_FILE = path.join(root, 'public', 'i18n', 'import-all.json');
const OUT_FILE_ARRAY = path.join(root, 'public', 'i18n', 'import-all-array.json');

// Map short locales to org-accepted locales
const LOCALE_MAP = { en: 'en-US', uk: 'uk-UA' };

function readJsonSafe(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = String(v ?? '');
    }
  }
  return out;
}

function flattenNamespaces(fileJson) {
  const map = {};
  for (const [ns, val] of Object.entries(fileJson || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    map[ns] = flatten(val);
  }
  return map;
}

const en = readJsonSafe(EN_FILE);
const uk = readJsonSafe(UK_FILE);

const enNs = flattenNamespaces(en);
const ukNs = flattenNamespaces(uk);

const out = {};
const arr = [];
for (const [ns, flatEn] of Object.entries(enNs)) {
  for (const [key, enVal] of Object.entries(flatEn)) {
    if (!enVal) continue; // export only keys with non-empty EN
    out[ns] ||= {};
    const entry = {};
    const enMapped = LOCALE_MAP.en || 'en';
    entry[enMapped] = enVal;
    arr.push({ namespace: ns, key, locale: enMapped, value: enVal });
    const ukVal = ukNs?.[ns]?.[key];
    if (ukVal) {
      const ukMapped = LOCALE_MAP.uk || 'uk';
      entry[ukMapped] = ukVal;
      arr.push({ namespace: ns, key, locale: ukMapped, value: ukVal });
    }
    out[ns][key] = entry;
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
fs.writeFileSync(OUT_FILE_ARRAY, JSON.stringify(arr, null, 2) + '\n', 'utf8');
console.log(`i18n-build-import → wrote ${OUT_FILE}`);
console.log(`i18n-build-import → wrote ${OUT_FILE_ARRAY}`);
