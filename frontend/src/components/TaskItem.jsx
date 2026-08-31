import React, { useState } from 'react';
import { Pencil, ArrowRightCircle, Trash2, Bell, History, Check, X } from 'lucide-react';
import { categoryTint } from '../categoryColor.js';
import { formatDateTiny } from './DateNav.jsx';

function formatTime(t) {
  if (!t) return null;
  return t.slice(0, 5);
}

// «17 авг → 18 авг → 19 авг» — вся цепочка переносов задачи, для подсказки при наведении
function formatMoveChain(moves) {
  const dates = [moves[0].from_date, ...moves.map((m) => m.to_date)];
  return dates.map(formatDateTiny).join(' → ');
}

// Две кнопки вместо чек-бокса: задача либо не отмечена (pending, по умолчанию),
// либо явно отмечена выполненной, либо явно отмечена проваленной. Повторный клик
// по уже активной кнопке снимает отметку — возвращает в pending.
export function StatusButtons({ status, onSetStatus, compact = false }) {
  const isDone = status === 'done';
  const isFailed = status === 'failed';
  const box = compact ? 'w-4 h-4' : 'w-5 h-5';
  const icon = compact ? 10 : 12;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSetStatus(isDone ? 'pending' : 'done');
        }}
        title={isDone ? 'Снять отметку о выполнении' : 'Отметить выполненной'}
        className={`${box} rounded-[5px] border-[1.5px] flex items-center justify-center transition ${
          isDone
            ? 'bg-done border-done text-white'
            : 'border-line-strong text-line-strong hover:border-done hover:text-done'
        }`}
      >
        <Check size={icon} strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSetStatus(isFailed ? 'pending' : 'failed');
        }}
        title={isFailed ? 'Снять отметку о провале' : 'Отметить проваленной'}
        className={`${box} rounded-[5px] border-[1.5px] flex items-center justify-center transition ${
          isFailed
            ? 'bg-clay border-clay text-white'
            : 'border-line-strong text-line-strong hover:border-clay hover:text-clay'
        }`}
      >
        <X size={icon} strokeWidth={3} />
      </button>
    </div>
  );
}

export default function TaskItem({ task, onSetStatus, onEdit, onMove, onDelete, checkbox = true }) {
  const [hover, setHover] = useState(false);
  const done = task.status === 'done';
  const failed = task.status === 'failed';
  const time = task.time_from ? `${formatTime(task.time_from)}${task.time_to ? '–' + formatTime(task.time_to) : ''}` : null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={task.category_color ? { backgroundColor: categoryTint(task.category_color) } : undefined}
      className={`group flex items-start gap-3 py-2.5 px-4 border-b border-line-strong last:border-b-0 transition ${
        done ? 'opacity-55' : ''
      }`}
    >
      {checkbox && <StatusButtons status={task.status} onSetStatus={(status) => onSetStatus(task, status)} />}

      {time && (
        <div className="w-20 shrink-0 h-5 flex items-center">
          <span className={`font-mono text-xs ${done ? 'text-muted' : failed ? 'text-clay' : 'text-ink'}`}>{time}</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug ${
            done ? 'line-through text-muted' : failed ? 'line-through text-clay' : 'text-ink'
          }`}
        >
          {task.title}
          {task.remind && (
            <Bell size={12} className="inline-block ml-1.5 -mt-0.5 text-muted" aria-label="Напоминание" />
          )}
          {task.moves?.length > 0 && (
            <History
              size={12}
              className="inline-block ml-1.5 -mt-0.5 text-muted"
              aria-label="Перенесена"
              title={`Перенесена: ${formatMoveChain(task.moves)}`}
            />
          )}
        </p>
        {task.note && (
          <p className="text-xs text-muted mt-0.5 whitespace-pre-line">{task.note}</p>
        )}
      </div>

      <div
        className={`flex items-center gap-1 shrink-0 -my-1 transition ${
          hover ? 'opacity-100' : 'opacity-100 can-hover:opacity-0'
        }`}
      >
        <button onClick={() => onEdit(task)} className="p-1.5 rounded hover:bg-accent-light" title="Редактировать">
          <Pencil size={15} />
        </button>
        {onMove && (
          <button onClick={() => onMove(task)} className="p-1.5 rounded hover:bg-accent-light" title="Перенести">
            <ArrowRightCircle size={15} />
          </button>
        )}
        <button onClick={() => onDelete(task)} className="p-1.5 rounded hover:bg-clay-light text-clay" title="Удалить">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
