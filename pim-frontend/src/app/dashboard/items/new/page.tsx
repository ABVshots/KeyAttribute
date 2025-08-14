// File: pim-frontend/src/app/dashboard/items/new/page.tsx
import { createItem } from '../actions';
import Link from 'next/link';
import SubmitButton from './SubmitButton';

export default function NewItemPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Новий товар</h1>
      <form
        action={createItem}
        className="mt-8 max-w-lg rounded-lg border bg-white p-8 shadow-sm"
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Назва товару
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
              SKU (Артикул)
            </label>
            <input
              id="sku"
              name="sku"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              pattern="[A-Za-z0-9._-]{1,64}"
              title="Дозволені символи: латинські букви, цифри, крапка, дефіс, підкреслення (до 64)"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
              placeholder="ABC-001"
            />
          </div>
        </div>
        <div className="mt-8 flex justify-end space-x-4">
          <Link
            href="/dashboard/items"
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Скасувати
          </Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}