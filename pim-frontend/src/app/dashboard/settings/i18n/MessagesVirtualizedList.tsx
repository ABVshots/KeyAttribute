'use client';

import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

export type MessageItem = { keyId: string; key: string; value: string; baseValue?: string };

function Row({ index, style, data }: ListChildComponentProps) {
  const it: MessageItem = data.items[index];
  return (
    <div style={style} className="border-t grid grid-cols-3 gap-2 items-start">
      <div className="p-2 font-mono text-xs truncate">{it.key}</div>
      <div className="p-2 text-xs truncate" title={it.value}>{it.value || <span className="text-gray-400">—</span>}</div>
      <div className="p-2 text-[10px] text-gray-500 truncate" title={it.baseValue}>Base: {it.baseValue || '—'}</div>
    </div>
  );
}

export default function MessagesVirtualizedList({ items, height = 480, itemSize = 48 }: { items: MessageItem[]; height?: number; itemSize?: number }) {
  return (
    <div className="rounded border bg-white">
      <div className="bg-gray-50 text-xs uppercase text-gray-500 grid grid-cols-3">
        <div className="p-2">Key</div>
        <div className="p-2">Value</div>
        <div className="p-2">ICU Base</div>
      </div>
      <List height={height} width={'100%'} itemSize={itemSize} itemCount={items.length} itemData={{ items }}>
        {Row}
      </List>
    </div>
  );
}
