import React, { useState } from 'react';
import Modal from './Modal.jsx';
import TimeSelect from './TimeSelect.jsx';
import CategoryTabs from './CategoryTabs.jsx';

export default function TemplateItemFormModal({ initial, categories, onClose, onSubmit }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? null);
  const [timeFrom, setTimeFrom] = useState(initial?.time_from?.slice(0, 5) || '');
  const [timeTo, setTimeTo] = useState(initial?.time_to?.slice(0, 5) || '');
  const [note, setNote] = useState(initial?.note || '');
  const [remind, setRemind] = useState(Boolean(initial?.remind));
  const [remindBefore, setRemindBefore] = useState(initial?.remind_minutes_before ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        title: title.trim(),
        category_id: categoryId,
        time_from: timeFrom || null,
        time_to: timeFrom && timeTo ? timeTo : null,
        note: note.trim() || null,
        remind: Boolean(timeFrom) && remind,
        remind_minutes_before: Number(remindBefore) || 0,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось сохранить пункт шаблона');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? 'Редактировать пункт шаблона' : 'Новый пункт шаблона'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1">Название</label>
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Категория</label>
          <CategoryTabs
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            allLabel="Нет"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Время <span className="text-muted/70">(необязательно)</span></label>
          <div className="flex items-center gap-4">
            <TimeSelect value={timeFrom} onChange={setTimeFrom} />
            <span className="text-muted select-none">–</span>
            <TimeSelect value={timeTo} onChange={setTimeTo} />
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Примечание</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className={`flex items-center gap-2 text-sm ${timeFrom ? 'text-ink' : 'text-muted'}`}>
            <input
              type="checkbox"
              className="checkbox"
              disabled={!timeFrom}
              checked={Boolean(timeFrom) && remind}
              onChange={(e) => setRemind(e.target.checked)}
            />
            Напомнить в Telegram
          </label>
          {timeFrom ? (
            remind && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-muted">за</span>
                <select
                  value={remindBefore}
                  onChange={(e) => setRemindBefore(Number(e.target.value))}
                  className="border border-line rounded-lg px-2 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value={0}>в момент начала</option>
                  <option value={5}>5 минут</option>
                  <option value={10}>10 минут</option>
                  <option value={15}>15 минут</option>
                  <option value={30}>30 минут</option>
                  <option value={60}>1 час</option>
                </select>
                <span className="text-muted">до начала</span>
              </div>
            )
          ) : (
            <p className="mt-1 text-xs text-muted">Укажите время начала, чтобы включить напоминание.</p>
          )}
        </div>

        {error && <p className="text-pending text-sm">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-accent text-white rounded-lg py-2.5 font-medium hover:bg-accent-dark transition disabled:opacity-60"
        >
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </form>
    </Modal>
  );
}
