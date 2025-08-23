// File: pim-frontend/src/app/dashboard/integrations/SubmitButton.tsx
'use client';
import { useFormStatus } from 'react-dom';
import { useT } from '@/app/i18n/I18nProvider';

export default function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
      {pending ? t('integrations.saving', undefined, { fallback: 'Збереження...' }) : t('integrations.saveSettings', undefined, { fallback: 'Зберегти налаштування' })}
    </button>
  );
}