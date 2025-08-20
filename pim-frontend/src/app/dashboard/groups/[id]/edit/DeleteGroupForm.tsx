'use client';

import { deleteGroup } from '../../actions';

export default function DeleteGroupForm({ id, disabled, hint }: { id: string; disabled?: boolean; hint?: string }) {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (!confirm('Видалити цей вузол? Дію не можна скасувати.')) {
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
        title={disabled ? (hint || 'Спочатку видаліть або перемістіть дочірні вузли') : 'Видалити вузол'}
        className={`btn ${disabled ? '' : 'btn-danger'}`}
      >
        Видалити
      </button>
    </form>
  );
}
