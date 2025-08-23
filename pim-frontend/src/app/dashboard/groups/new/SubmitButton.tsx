// File: pim-frontend/src/app/dashboard/groups/new/SubmitButton.tsx
'use client';

import { useFormStatus } from 'react-dom';
import { useT } from '../../../i18n/I18nProvider';

export default function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t('common.saving', undefined, { fallback: 'Збереження...' }) : t('common.save', undefined, { fallback: 'Зберегти' })}
    </button>
  );
}