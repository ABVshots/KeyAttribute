import { describe, it, expect } from 'vitest';
import { extractPlaceholders, parseCsv } from '../../src/lib/icu';

describe('extractPlaceholders', () => {
  it('extracts simple names', () => {
    expect(extractPlaceholders('Hello {name}')).toEqual(['name']);
  });
  it('ignores missing braces', () => {
    expect(extractPlaceholders('Hello name')).toEqual([]);
  });
  it('handles ICU with types', () => {
    expect(extractPlaceholders('{count, number} files for {user}')).toEqual(['count','user']);
  });
});

describe('parseCsv', () => {
  it('parses simple CSV', () => {
    const rows = parseCsv('a,b\n1,2');
    expect(rows).toEqual([['a','b'],['1','2']]);
  });
  it('handles quoted commas', () => {
    const rows = parseCsv('a,b\n"v,1",2');
    expect(rows[1]).toEqual(['v,1','2']);
  });
  it('handles quotes escaping', () => {
    const rows = parseCsv('a\n"he said ""ok"""');
    expect(rows[1][0]).toBe('he said "ok"');
  });
});
