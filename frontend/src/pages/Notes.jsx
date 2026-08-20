import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import api from '../api.js';
import NoteEditorModal from '../components/NoteEditorModal.jsx';
import NoteShareModal from '../components/NoteShareModal.jsx';

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

// Дата и время в локальном времени: «14 авг 2026, 21:00»
function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(undefined); // undefined = закрыто, null = новая, объект = редактирование
  const [sharingNote, setSharingNote] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/notes');
    setNotes(res.data.notes);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(payload) {
    await api.post('/notes', payload);
    await load();
  }

  async function handleUpdate(id, payload) {
    await api.put(`/notes/${id}`, payload);
    await load();
  }

  async function deleteNote(note) {
    await api.delete(`/notes/${note.id}`);
    await load();
  }

  async function handleDelete(note) {
    if (!window.confirm(`Удалить заметку «${note.title || 'без заголовка'}»?`)) return;
    await deleteNote(note);
  }

  return (
    <div>
      <h2 className="font-display text-2xl mb-1">Заметки</h2>
      <p className="text-sm text-muted mb-6">Быстрые текстовые записи.</p>

      {loading ? (
        <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
          <p className="py-6 px-4 text-muted text-sm">Загрузка…</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
          <p className="py-6 px-4 text-muted text-sm">Заметок пока нет.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => setEditing(note)}
              className="group flex items-center gap-3 px-4 py-2.5 border-b border-line-strong last:border-b-0 hover:bg-accent-light/60 transition cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${note.title ? 'text-ink' : 'text-muted italic'}`}>
                  {note.title || 'Без заголовка'}
                  {!note.is_owner && <span className="ml-2 text-xs font-normal text-muted">от {note.owner_name}</span>}
                </p>
                <p className="text-xs text-muted truncate mt-0.5">
                  Обновлено {formatDateTime(note.updated_at)} · Создано {formatDateTime(note.created_at)}
                </p>
              </div>
              {note.is_owner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSharingNote(note);
                  }}
                  className="shrink-0 p-1.5 rounded text-muted hover:text-ink hover:bg-accent-light can-hover:opacity-0 can-hover:group-hover:opacity-100 transition"
                  title="Настроить доступ"
                >
                  <Users size={15} />
                </button>
              )}
              {note.can_delete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(note);
                  }}
                  className="shrink-0 p-1.5 rounded text-clay hover:bg-clay-light can-hover:opacity-0 can-hover:group-hover:opacity-100 transition"
                  title="Удалить"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setEditing(null)}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark"
      >
        <Plus size={16} /> Добавить заметку
      </button>

      {editing !== undefined && (
        <NoteEditorModal
          initial={editing}
          readOnly={Boolean(editing) && !editing.can_edit}
          canDelete={!editing || editing.can_delete}
          onClose={() => setEditing(undefined)}
          onSubmit={(payload) => (editing ? handleUpdate(editing.id, payload) : handleCreate(payload))}
          onDelete={deleteNote}
        />
      )}

      {sharingNote && <NoteShareModal note={sharingNote} onClose={() => setSharingNote(null)} />}
    </div>
  );
}
