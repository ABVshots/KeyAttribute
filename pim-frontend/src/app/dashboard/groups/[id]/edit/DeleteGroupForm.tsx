'use client';

import { deleteGroup } from '../../actions';
import { useT } from '../../../../i18n/I18nProvider';

export default function DeleteGroupForm({ id, disabled, hint }: { id: string; disabled?: boolean; hint?: string }) {
  const t = useT();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (!confirm(t('groups.delete.confirm', undefined, { fallback: 'Видалити цей вузол? Дію не можна скасувати.' }))) {
      e.preventDefault();
    }
  }
  return (
    <form action={deleteGroup} onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={disabled}
        aria-disabled={disabled}
        title={disabled ? (hint || t('groups.delete.removeChildrenFirst', undefined, { fallback: 'Спочатку видаліть або перемістіть дочірні вузли' })) : t('groups.delete.title', undefined, { fallback: 'Видалити вузол' })}
        className={`btn ${disabled ? '' : 'btn-danger'}`}
      >
        {t('common.delete', undefined, { fallback: 'Видалити' })}
      </button>
    </form>
  );
}
