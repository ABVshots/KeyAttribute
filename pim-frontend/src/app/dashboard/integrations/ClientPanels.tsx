// File: pim-frontend/src/app/dashboard/integrations/ClientPanels.tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from './actions';
import {
  saveCartumIntegrationAction,
  testCartumConnectionAction,
  queuePullProductsAction,
  queueSyncCategoriesAction,
} from './actions';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
      {pending ? 'Зачекайте…' : label}
    </button>
  );
}

function Notice({ state }: { state: ActionState }) {
  if (state.error) return <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">Помилка: {state.error}</p>;
  if (state.ok) return <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">Успіх: {state.ok}{state.jobId ? ` (job: ${state.jobId})` : ''}</p>;
  return null;
}

export function SettingsForm({ defaults }: { defaults: { domain: string; secretName: string } }) {
  const [state, action] = useActionState<ActionState, FormData>(saveCartumIntegrationAction, {} as ActionState);
  return (
    <form action={action} className="mt-8 max-w-xl rounded-lg border bg-white p-8 shadow-sm">
      <div className="space-y-6">
        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700">Домен Cartum</label>
          <input id="domain" name="domain" type="text" required defaultValue={defaults.domain} placeholder="shop123.cartum.io" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500" />
          <p className="mt-1 text-xs text-gray-500">Приклад: shop101194.cartum.io</p>
        </div>
        <div>
          <label htmlFor="secretName" className="block text-sm font-medium text-gray-700">Назва секрету</label>
          <input id="secretName" name="secretName" type="text" required defaultValue={defaults.secretName} placeholder="cartum_credentials_prod" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500" />
          <p className="mt-1 text-xs text-gray-500">Створіть секрет у Supabase Edge Functions → Secrets з JSON: {'{'}&quot;login&quot;:&quot;…&quot;,&quot;password&quot;:&quot;…&quot;{'}'}</p>
        </div>
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <Submit label="Зберегти налаштування" />
      </div>
      <Notice state={state} />
    </form>
  );
}

export function QuickActions({ integrationId, organizationId }: { integrationId: string; organizationId: string }) {
  const [stateTest, actionTest] = useActionState<ActionState, FormData>(testCartumConnectionAction, {} as ActionState);
  const [stateCat, actionCat] = useActionState<ActionState, FormData>(queueSyncCategoriesAction, {} as ActionState);
  const [statePull, actionPull] = useActionState<ActionState, FormData>(queuePullProductsAction, {} as ActionState);

  return (
    <div className="mt-8 max-w-xl rounded-lg border bg-white p-8 shadow-sm">
      <h2 className="text-lg font-semibold">Швидкі дії</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form action={actionTest}>
          <input type="hidden" name="integration_id" value={integrationId} />
          <Submit label="Перевірити підключення" />
          <Notice state={stateTest} />
        </form>
        <form action={actionCat}>
          <input type="hidden" name="integration_id" value={integrationId} />
          <input type="hidden" name="organization_id" value={organizationId} />
          <Submit label="Синхронізувати категорії" />
          <Notice state={stateCat} />
        </form>
        <form action={actionPull}>
          <input type="hidden" name="integration_id" value={integrationId} />
          <input type="hidden" name="organization_id" value={organizationId} />
          <Submit label="Завантажити товари" />
          <Notice state={statePull} />
        </form>
      </div>
      <p className="mt-3 text-xs text-gray-500">Для push-оновлень буде використано Outbox Pattern.</p>
    </div>
  );
}
