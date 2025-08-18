'use client';

import Link from 'next/link';
import { updateItem } from '../../actions';
import SubmitButton from './SubmitButton';

// Типи пропсів
type Item = {
  id: string;
  sku: string;
  title: string;
  price: number | null;
  quantity: number | null;
  item_features: Array<{ feature_attribute_id: string; feature_id: string }>; // очікуємо масив
};

type Attribute = {
  id: string;
  label: string;
  root_feature_id: string | null;
};

type Feature = {
  id: string;
  name: string;
  feature_type: string; // 'value_set' | 'value_option' | ...
};

type EditItemFormProps = {
  item: Item;
  attributes: Attribute[];
  features: Feature[];
};

export default function EditItemForm({ item, attributes, features }: EditItemFormProps) {
  // Прив'язуємо дію до item.id
  const updateItemWithId = updateItem.bind(null, item.id);

  // Map поточних значень атрибутів
  const currentFeatures = new Map<string, string>(
    (item.item_features ?? []).map((f) => [f.feature_attribute_id, f.feature_id])
  );

  // Показуємо лише value_option як варіанти значень (MVP: без зв'язку з конкретним root_feature_id)
  const valueOptions = features.filter((f) => f.feature_type === 'value_option');

  return (
    <form action={updateItemWithId} className="mt-8 max-w-2xl rounded-lg border bg-white p-8 shadow-sm">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Базові поля */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Назва товару</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={item.title}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">SKU (незмінний)</label>
          <input
            type="text"
            disabled
            value={item.sku}
            className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
          />
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700">Ціна</label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item.price ?? ''}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Кількість</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="1"
            min="0"
            defaultValue={item.quantity ?? ''}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
          />
        </div>
      </div>

      <hr className="my-8" />

      {/* Динамічні атрибути */}
      <h2 className="text-xl font-semibold">Атрибути</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {attributes.map((attr) => {
          // Показуємо лише атрибути, що мають довідник значень
          if (!attr.root_feature_id) return null;

          // MVP: показуємо всі опції типу value_option
          const options = valueOptions;

          return (
            <div key={attr.id}>
              <label htmlFor={`feature_${attr.id}`} className="block text-sm font-medium text-gray-700">
                {attr.label}
              </label>
              <select
                id={`feature_${attr.id}`}
                name={`feature_${attr.id}`}
                defaultValue={currentFeatures.get(attr.id) || ''}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-zinc-500 focus:ring-zinc-500"
              >
                <option value="">Не вибрано</option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end space-x-4">
        <Link href="/dashboard/items" className="rounded-lg border bg-white px-5 py-2 text-sm hover:bg-gray-50">Скасувати</Link>
        <SubmitButton />
      </div>
    </form>
  );
}
