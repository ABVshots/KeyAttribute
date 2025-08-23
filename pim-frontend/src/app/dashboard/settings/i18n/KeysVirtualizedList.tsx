'use client';

import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

type KeyItem = { id: string; namespace: string; key: string };

function Row({ index, style, data }: ListChildComponentProps) {
  const it: KeyItem = data.items[index];
  return (
    <div style={style} className="border-t flex items-center">
      <div className="p-2 font-mono text-xs truncate w-full">{it.key}</div>
    </div>
  );
}

export default function KeysVirtualizedList({ items, height = 320, itemSize = 36 }: { items: KeyItem[]; height?: number; itemSize?: number }) {
  return (
    <div className="rounded border bg-white">
      <div className="bg-gray-50 text-xs uppercase text-gray-500">
        <div className="p-2">Key</div>
      </div>
      <List height={height} width={'100%'} itemSize={itemSize} itemCount={items.length} itemData={{ items }}>
        {Row}
      </List>
    </div>
  );
}
