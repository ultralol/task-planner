import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';

// Распознавание ссылок: http(s):// или www.
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"«»])/gi;

function linkify(text) {
  const parts = [];
  let last = 0;
  URL_RE.lastIndex = 0;
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    const raw = m[0];
    parts.push({ text: raw, url: raw.startsWith('www.') ? `https://${raw}` : raw });
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// Текстовое поле заметки с распознаванием ссылок.
// Обычный textarea (видимый текст + каретка) — сверху; над найденными ссылками
// кладём прозрачные кликабельные «хит-зоны». Их позиции измеряем по скрытому
// зеркалу с той же вёрсткой. Так каретка всегда видна, а ссылки подчёркиваются
// при наведении, меняют курсор и открываются в новом окне по клику.
function NoteBody({ value, onChange, placeholder, readOnly }) {
  const wrapRef = useRef(null);
  const taRef = useRef(null);
  const mirrorRef = useRef(null);
  const [rects, setRects] = useState([]);
  const [tick, setTick] = useState(0);

  // авто-высота textarea под содержимое
  useEffect(() => {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [value]);

  // измерение прямоугольников ссылок по зеркалу
  useEffect(() => {
    const mirror = mirrorRef.current;
    const wrap = wrapRef.current;
    if (!mirror || !wrap) return;
    mirror.textContent = '';
    const nodes = [];
    linkify(value).forEach((p) => {
      if (p.url) {
        const s = document.createElement('span');
        s.textContent = p.text;
        s.dataset.url = p.url;
        mirror.appendChild(s);
        nodes.push(s);
      } else {
        mirror.appendChild(document.createTextNode(p.text));
      }
    });
    const wb = wrap.getBoundingClientRect();
    const rs = [];
    nodes.forEach((n) => {
      const url = n.dataset.url;
      for (const r of n.getClientRects()) {
        rs.push({ url, left: r.left - wb.left, top: r.top - wb.top, width: r.width, height: r.height });
      }
    });
    setRects(rs);
  }, [value, tick]);

  // пере-измерить при изменении размера окна
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const shared = 'w-full p-0 border-0 font-sans text-[15px] leading-relaxed whitespace-pre-wrap break-words';

  return (
    <div ref={wrapRef} className="relative">
      <textarea
        ref={taRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        readOnly={readOnly}
        className={`${shared} block min-h-[50vh] resize-none overflow-hidden bg-transparent text-ink placeholder:text-muted focus:outline-none`}
      />
      <div ref={mirrorRef} aria-hidden="true" className={`${shared} absolute inset-0 invisible`} />
      {rects.map((r, i) => (
        <a
          key={i}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          title={r.url}
          className="note-link-hit"
          style={{ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }}
        />
      ))}
    </div>
  );
}

// Полноэкранный редактор заметки (по сути модальный оверлей на весь экран).
// readOnly — заметка чужая и без права редактирования (можно только прочитать);
// canDelete — есть право удаления (у владельца — всегда).
export default function NoteEditorModal({ initial, readOnly = false, canDelete = true, onClose, onSubmit, onDelete }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dirty = !readOnly && (title !== (initial?.title || '') || body !== (initial?.body || ''));

  function requestClose() {
    if (dirty && !window.confirm('Закрыть без сохранения? Изменения будут потеряны.')) return;
    onClose();
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  async function handleSave() {
    setBusy(true);
    setError('');
    try {
      await onSubmit({ title: title.trim(), body });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось сохранить заметку');
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    if (!window.confirm(`Удалить заметку «${initial.title || 'без заголовка'}»?`)) return;
    setBusy(true);
    try {
      await onDelete(initial);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-surface flex flex-col">
      <header className="flex items-center gap-2 sm:gap-3 border-b border-line px-3 sm:px-5 py-2.5">
        <button
          onClick={requestClose}
          aria-label="Закрыть"
          className="shrink-0 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-accent-light transition"
        >
          <X size={20} />
        </button>
        <input
          autoFocus={!initial}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Заголовок (необязательно)"
          readOnly={readOnly}
          className="flex-1 min-w-0 text-lg font-medium bg-transparent text-ink placeholder:text-muted focus:outline-none"
        />
        {readOnly && !initial?.is_owner && (
          <span className="shrink-0 text-xs text-muted">от {initial?.owner_name}, только просмотр</span>
        )}
        {initial && canDelete && (
          <button
            onClick={handleDelete}
            aria-label="Удалить"
            title="Удалить"
            className="shrink-0 p-1.5 rounded-lg text-clay hover:bg-clay-light transition"
          >
            <Trash2 size={18} />
          </button>
        )}
        {!readOnly && (
          <button
            onClick={handleSave}
            disabled={busy}
            className="shrink-0 bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-accent-dark transition disabled:opacity-60"
          >
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        )}
      </header>

      {error && <div className="px-5 py-2 text-sm text-pending border-b border-line">{error}</div>}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-5">
          <NoteBody value={body} onChange={setBody} placeholder="Текст заметки…" readOnly={readOnly} />
        </div>
      </div>
    </div>
  );
}
