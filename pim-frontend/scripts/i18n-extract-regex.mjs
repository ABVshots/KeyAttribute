#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

const root = process.cwd();
const SRC = path.join(root, 'src');
const OUT_DIR = path.join(root, 'public', 'i18n');
const EN_FILE = path.join(OUT_DIR, 'en.json');

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function writeJsonPretty(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function setNested(obj, ns, key, val) {
  obj[ns] ||= {}; if (obj[ns][key] == null || obj[ns][key] === '') obj[ns][key] = val;
}

(async () => {
  const files = await fg(['src/**/*.{ts,tsx,js,jsx}'], { cwd: root, absolute: true, dot: false, ignore: ['**/node_modules/**','**/.next/**','**/tests/**'] });
  const re = /\bt\(\s*['\"]([a-zA-Z0-9_\-]+)\.([^'\"\)]+)['\"]/g;
  const current = readJsonSafe(EN_FILE);
  let count = 0;
  for (const f of files) {
    const code = fs.readFileSync(f, 'utf8');
    let m; re.lastIndex = 0;
    while ((m = re.exec(code)) !== null) {
      const ns = m[1];
      const key = m[2].trim();
      if (!ns || !key) continue;
      setNested(current, ns, key, current?.[ns]?.[key] ?? '');
      count++;
    }
  }
  writeJsonPretty(EN_FILE, current);
  console.log(`i18n:extract-regex → ${EN_FILE} updated, matched ${count} t() calls.`);
})();
