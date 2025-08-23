'use client';

import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

export type OverrideItem = { keyId: string; key: string; value: string };

function Row({ index, style, data }: ListChildComponentProps) {
  const it: OverrideItem = data.items[index];
  return (
    <div style={style} className="border-t grid grid-cols-[1fr_2fr_80px] gap-2 items-start">
      <div className="p-2 font-mono text-xs truncate">{it.key}</div>
      <div className="p-2 text-xs truncate" title={it.value}>{it.value || <span className="text-gray-400">—</span>}</div>
      <div className="p-2 text-right text-xs text-gray-500">override</div>
    </div>
  );
}

export default function OverridesVirtualizedList({ items, height = 480, itemSize = 48 }: { items: OverrideItem[]; height?: number; itemSize?: number }) {
  return (
    <div className="rounded border bg-white">
      <div className="bg-gray-50 text-xs uppercase text-gray-500 grid grid-cols-[1fr_2fr_80px]">
        <div className="p-2">Key</div>
        <div className="p-2">Override</div>
        <div className="p-2"></div>
      </div>
      <List height={height} width={'100%'} itemSize={itemSize} itemCount={items.length} itemData={{ items }}>
        {Row}
      </List>
    </div>
  );
}
