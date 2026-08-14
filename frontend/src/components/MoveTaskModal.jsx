import React, { useState } from 'react';
import Modal from './Modal.jsx';
import TimeSelect from './TimeSelect.jsx';
import { DateStepper, shiftDate, formatDateShort } from './DateNav.jsx';

export default function MoveTaskModal({ task, currentDate, onClose, onSubmit }) {
  const [date, setDate] = useState(shiftDate(currentDate, 1));
  const [timeFrom, setTimeFrom] = useState(task.time_from?.slice(0, 5) || '');
  const [timeTo, setTimeTo] = useState(task.time_to?.slice(0, 5) || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        to_date: date,
        time_from: timeFrom || null,
        time_to: timeFrom && timeTo ? timeTo : null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось перенести задачу');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Перенести «${task.title}»`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1">Новая дата</label>
          <DateStepper value={date} onChange={setDate} min={currentDate} />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Время <span className="text-muted/70">(необязательно)</span></label>
          <div className="flex items-center gap-4">
            <TimeSelect value={timeFrom} onChange={setTimeFrom} />
            <span className="text-muted select-none">–</span>
            <TimeSelect value={timeTo} onChange={setTimeTo} />
          </div>
        </div>

        <p className="text-xs text-muted">
          На {formatDateShort(currentDate)} останется отметка о переносе — эта информация сохранится и будет видна в истории.
        </p>
        {error && <p className="text-pending text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-accent text-white rounded-lg py-2.5 font-medium hover:bg-accent-dark transition disabled:opacity-60"
        >
          {busy ? 'Переносим…' : 'Перенести'}
        </button>
      </form>
    </Modal>
  );
}
