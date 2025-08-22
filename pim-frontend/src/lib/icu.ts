// Shared helpers for ICU placeholders and simple CSV parsing
export function extractPlaceholders(msg: string): string[] {
  const re = /\{\s*([\w.]+)\s*(?:,[^}]*)?}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg)) !== null) { if (m[1]) out.add(m[1]); }
  return Array.from(out);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* ignore */ }
      else { cur += ch; }
    }
  }
  row.push(cur);
  rows.push(row);
  return rows.filter(r => r.some(c => String(c).trim().length > 0));
}
