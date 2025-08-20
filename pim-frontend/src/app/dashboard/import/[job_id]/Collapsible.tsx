'use client';

import { useState, type PropsWithChildren } from 'react';

export default function Collapsible({ title, children }: PropsWithChildren<{ title: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="text-xl leading-none">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="border-t p-2">{children}</div>
      )}
    </div>
  );
}
