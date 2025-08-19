// File: pim-frontend/src/app/dashboard/integrations/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { SettingsForm } from './ClientPanels';
import SyncComponent from './SyncComponent';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const supabase = createServerComponentClient({ cookies });

  const { data: integration } = await supabase
    .from('integrations')
    .select('id, organization_id, settings, status, credentials_vault_ref')
    .eq('platform', 'cartum')
    .maybeSingle();

  return (
    <div>
      <h1 className="text-3xl font-bold">Інтеграція з Cartum</h1>
      <p className="mt-2 text-gray-500">Підключіть ваш магазин на платформі Cartum для синхронізації.</p>

      <SettingsForm
        defaults={{
          domain: (integration?.settings as any)?.domain || '',
          secretName: integration?.credentials_vault_ref || '',
        }}
      />

      {integration && (
        <SyncComponent integrationId={integration.id} />
      )}

      {integration?.status === 'active' && (
        <p className="mt-4 text-sm text-green-600">Статус: активна</p>
      )}
    </div>
  );
}