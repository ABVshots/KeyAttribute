#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

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

function collectFromFile(file, acc) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  traverse(ast, {
    CallExpression(pathNode) {
      const callee = pathNode.node.callee;
      if (callee.type !== 'Identifier') return;
      const name = callee.name;
      if (name !== 't' && name !== 'tS' && name !== 'tServer') return;
      const args = pathNode.node.arguments;
      if (!args.length) return;
      const a0 = args[0];
      if (a0.type !== 'StringLiteral') return;
      const full = a0.value; // 'ns.key'
      const [ns, ...rest] = full.split('.');
      const key = rest.join('.') || '';
      if (!ns || !key) return;
      // default text detection: in later args as string literal or object default/fallback
      let def = '';
      for (const a of args.slice(1)) {
        if (a.type === 'StringLiteral' && !def) def = a.value;
        if (a.type === 'ObjectExpression') {
          for (const prop of a.properties) {
            if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
              if ((prop.key.name === 'default' || prop.key.name === 'fallback') && prop.value.type === 'StringLiteral' && !def) {
                def = prop.value.value;
              }
            }
          }
        }
      }
      acc.push({ ns, key, def });
    },
    JSXOpeningElement(pathNode) {
      const el = pathNode.node;
      if (el.name.type === 'JSXIdentifier' && el.name.name === 'ExtractorOnly') {
        let k = '', fallback = '';
        for (const attr of el.attributes) {
          if (attr.type !== 'JSXAttribute' || !attr.name) continue;
          const name = attr.name.name;
          if (name === 'k' && attr.value && attr.value.type === 'StringLiteral') k = attr.value.value;
          if (name === 'fallback' && attr.value && attr.value.type === 'StringLiteral') fallback = attr.value.value;
        }
        if (k && k.includes('.')) {
          const [ns, ...rest] = k.split('.');
          const key = rest.join('.') || '';
          acc.push({ ns, key, def: fallback || '' });
        }
      }
    }
  });
}

(async () => {
  const files = await fg(['src/**/*.{ts,tsx,js,jsx}'], { cwd: root, absolute: true, dot: false, ignore: ['**/node_modules/**', '**/.next/**', '**/tests/**'] });
  const found = [];
  for (const f of files) {
    try { collectFromFile(f, found); } catch { /* ignore parse errors */ }
  }
  const current = readJsonSafe(EN_FILE);
  for (const { ns, key, def } of found) {
    setNested(current, ns, key, def || '');
  }
  writeJsonPretty(EN_FILE, current);
  console.log(`i18n:extract → ${EN_FILE} updated with ${found.length} entries (merged).`);
})();
