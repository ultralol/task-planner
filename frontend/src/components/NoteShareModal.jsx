import React, { useEffect, useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from './Modal.jsx';
import api from '../api.js';

// Три права всегда согласованы между собой: редактирование/удаление без чтения смысла не имеют,
// поэтому включение любого из них подтягивает чтение, а выключение чтения гасит оба остальных.
function normalizePerms(perms) {
  const canRead = perms.can_read || perms.can_edit || perms.can_delete;
  return { can_read: canRead, can_edit: canRead && perms.can_edit, can_delete: canRead && perms.can_delete };
}

function PermsCheckboxes({ perms, onChange, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
      {[
        ['can_read', 'Чтение'],
        ['can_edit', 'Редактирование'],
        ['can_delete', 'Удаление'],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-1.5 whitespace-nowrap">
          <input
            type="checkbox"
            className="checkbox"
            disabled={disabled}
            checked={perms[key]}
            onChange={(e) => onChange(normalizePerms({ ...perms, [key]: e.target.checked }))}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export default function NoteShareModal({ note, onClose }) {
  const [users, setUsers] = useState([]);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newPerms, setNewPerms] = useState({ can_read: true, can_edit: false, can_delete: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, sharesRes] = await Promise.all([
        api.get('/users'),
        api.get(`/notes/${note.id}/shares`),
      ]);
      setUsers(usersRes.data.users);
      setShares(sharesRes.data.shares);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить список доступа');
    } finally {
      setLoading(false);
    }
  }, [note.id]);

  useEffect(() => {
    load();
  }, [load]);

  const availableUsers = users.filter((u) => !shares.some((s) => s.user_id === u.id));

  async function saveShare(userId, perms) {
    setError('');
    try {
      const res = await api.put(`/notes/${note.id}/shares/${userId}`, perms);
      if (res.data.share) {
        setShares((prev) => {
          const rest = prev.filter((s) => s.user_id !== userId);
          return [...rest, res.data.share].sort((a, b) => a.name.localeCompare(b.name));
        });
      } else {
        setShares((prev) => prev.filter((s) => s.user_id !== userId));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось изменить доступ');
    }
  }

  async function revokeShare(userId) {
    setError('');
    try {
      await api.delete(`/notes/${note.id}/shares/${userId}`);
      setShares((prev) => prev.filter((s) => s.user_id !== userId));
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось убрать доступ');
    }
  }

  async function handleAdd() {
    if (!selectedUserId) return;
    setBusy(true);
    await saveShare(Number(selectedUserId), newPerms);
    setBusy(false);
    setSelectedUserId('');
    setNewPerms({ can_read: true, can_edit: false, can_delete: false });
  }

  return (
    <Modal title={`Доступ к заметке «${note.title || 'без заголовка'}»`} onClose={onClose}>
      {loading ? (
        <p className="text-sm text-muted py-2">Загрузка…</p>
      ) : (
        <div className="space-y-4">
          {shares.length === 0 ? (
            <p className="text-sm text-muted">Пока ни с кем не поделились.</p>
          ) : (
            <div className="space-y-3">
              {shares.map((s) => (
                <div key={s.user_id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                      <p className="text-xs text-muted truncate">{s.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revokeShare(s.user_id)}
                      title="Убрать доступ"
                      className="shrink-0 -mr-1 p-1.5 rounded text-clay hover:bg-clay-light transition"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-2">
                    <PermsCheckboxes perms={s} onChange={(perms) => saveShare(s.user_id, perms)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-line space-y-3">
            <label className="block text-sm text-muted mb-1">Открыть доступ пользователю</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border border-line rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Выберите пользователя…</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            {availableUsers.length === 0 && !loading && (
              <p className="text-xs text-muted">Больше пользователей нет, либо доступ уже открыт всем.</p>
            )}
            <PermsCheckboxes perms={newPerms} onChange={setNewPerms} />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedUserId || busy}
              className="w-full bg-accent text-white rounded-lg py-2.5 font-medium hover:bg-accent-dark transition disabled:opacity-60"
            >
              Добавить
            </button>
          </div>

          {error && <p className="text-pending text-sm">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
