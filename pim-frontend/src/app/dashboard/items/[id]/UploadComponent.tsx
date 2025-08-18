'use client';

import { useState, type ChangeEvent } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function UploadComponent({ itemId, orgId }: { itemId: string; orgId: string }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const supabase = createClientComponentClient();

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Клієнтська валідація типу/розміру
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
    if (!allowed.has(file.type)) {
      setMessage(`Непідтримуваний формат: ${file.type}`);
      return;
    }
    const maxBytes = 25 * 1024 * 1024; // 25MB
    if (file.size <= 0 || file.size > maxBytes) {
      setMessage('Неприпустимий розмір файлу (макс. 25MB)');
      return;
    }

    setUploading(true);
    setMessage('Завантаження...');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL не налаштовано');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('itemId', itemId);
      formData.append('orgId', orgId);

      const response = await fetch(`${baseUrl}/functions/v1/upload-media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'Помилка завантаження');

      setMessage('Файл успішно завантажено!');
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setMessage(`Помилка: ${errMsg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Завантажити зображення</h2>
      <p className="mt-1 text-sm text-gray-500">Оберіть файл для завантаження. Він буде оброблений у фоновому режимі.</p>
      <div className="mt-4">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleUpload}
          disabled={uploading}
        />
      </div>
      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  );
}
