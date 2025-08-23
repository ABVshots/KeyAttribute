// File: pim-frontend/src/app/dashboard/settings/i18n/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function I18nIndexRedirect() {
  redirect('/dashboard/settings/i18n/languages');
}
