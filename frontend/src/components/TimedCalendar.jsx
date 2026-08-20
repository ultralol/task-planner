import React, { useState } from 'react';
import { Pencil, ArrowRightCircle, Trash2 } from 'lucide-react';
import { categoryTint } from '../categoryColor.js';

const PPM = 0.8; // пикселей на минуту (1 час = 48px)
const GUTTER = 44; // место под подписи часов
const MIN_H = 18; // небольшой пол высоты, чтобы совсем короткие задачи оставались видимы
const OPEN_DUR = 30; // условная длительность задачи без времени окончания

const toMin = (t) => {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const fmt = (t) => t.slice(0, 5);

// Раскладка пересекающихся задач по колонкам (как в календаре)
function pack(items) {
  const arr = [...items].sort((a, b) => a.s - b.s || a.e - b.e);
  let cluster = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = [];
    cluster.forEach((it) => {
      let c = cols.findIndex((end) => end <= it.s);
      if (c === -1) {
        c = cols.length;
        cols.push(it.e);
      } else cols[c] = it.e;
      it.col = c;
    });
    cluster.forEach((it) => (it.cols = cols.length));
    cluster = [];
  };
  arr.forEach((it) => {
    if (cluster.length && it.s >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  });
  flush();
  return arr;
}

function CalBlock({ it, rangeStart, onToggle, onEdit, onMove, onDelete, checkbox }) {
  const [hover, setHover] = useState(false);
  const t = it.task;
  const done = t.status === 'done';
  const open = !t.time_to;
  const color = t.category_color;
  const avail = `(100% - ${GUTTER + 4}px)`;
  // Высота пропорциональна длительности; содержимое подстраивается под неё
  const h = Math.max((it.e - it.s) * PPM, MIN_H);
  const hasCheckbox = checkbox && h >= 24; // чек-бокс только если блок достаточно высокий
  const showActions = h >= 24; // hover-кнопки — тоже
  const singleLine = h < 40; // время и заголовок в одну строку (иначе в две)

  const style = {
    top: (it.s - rangeStart) * PPM + 'px',
    height: h + 'px',
    left: `calc(${GUTTER}px + ${it.col} * ${avail} / ${it.cols})`,
    width: `calc(${avail} / ${it.cols} - 4px)`,
    backgroundColor: color ? categoryTint(color) : undefined,
    borderLeftColor: color || undefined,
  };
  const time = open ? `с ${fmt(t.time_from)}` : `${fmt(t.time_from)}–${fmt(t.time_to)}`;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onEdit(t)}
      style={style}
      className={`group absolute rounded-md border-l-[3px] overflow-hidden cursor-pointer transition ${
        color ? '' : 'border-line-strong bg-ink/5'
      } ${open ? 'border-dashed' : 'border-solid'} ${done ? 'opacity-55' : ''}`}
    >
      <div className={`flex gap-1.5 px-2 py-0.5 h-full ${singleLine ? 'items-center' : 'items-start'}`}>
        {hasCheckbox && (
          <input
            type="checkbox"
            checked={done}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggle(t)}
            className={`checkbox ${singleLine ? '' : 'mt-0.5'}`}
          />
        )}
        {singleLine ? (
          <div className="min-w-0 flex-1 overflow-hidden flex items-baseline gap-1.5 leading-tight">
            <span className={`font-mono text-xs shrink-0 ${done ? 'text-muted' : 'text-ink'}`}>{time}</span>
            <span className={`text-xs truncate ${done ? 'line-through text-muted' : 'text-ink'}`}>{t.title}</span>
          </div>
        ) : (
          <div className="min-w-0 flex-1 overflow-hidden leading-tight">
            <span className={`font-mono text-xs ${done ? 'text-muted' : 'text-ink'}`}>{time}</span>
            <p className={`text-xs truncate ${done ? 'line-through text-muted' : 'text-ink'}`}>{t.title}</p>
          </div>
        )}
      </div>

      {showActions && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-1 right-1 flex items-center gap-0.5 rounded bg-surface/85 transition ${
            hover ? 'opacity-100' : 'opacity-100 can-hover:opacity-0'
          }`}
        >
          <button onClick={() => onEdit(t)} className="p-1 rounded hover:bg-accent-light" title="Редактировать">
            <Pencil size={13} />
          </button>
          {onMove && (
            <button onClick={() => onMove(t)} className="p-1 rounded hover:bg-accent-light" title="Перенести">
              <ArrowRightCircle size={13} />
            </button>
          )}
          <button onClick={() => onDelete(t)} className="p-1 rounded hover:bg-clay-light text-clay" title="Удалить">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function TimedCalendar({ tasks, onToggle, onEdit, onMove, onDelete, checkbox = true }) {
  if (!tasks.length) return null;

  const items = tasks.map((t) => {
    const s = toMin(t.time_from);
    const e = t.time_to ? toMin(t.time_to) : s + OPEN_DUR;
    return { task: t, s, e };
  });
  const rangeStart = Math.floor(Math.min(...items.map((i) => i.s)) / 60) * 60;
  const rangeEnd = Math.ceil(Math.max(...items.map((i) => i.e)) / 60) * 60;
  const packed = pack(items);

  const hours = [];
  for (let h = rangeStart / 60; h <= rangeEnd / 60; h++) hours.push(h);

  return (
    <div className="relative" style={{ height: (rangeEnd - rangeStart) * PPM + 'px' }}>
      {hours.map((h) => {
        const y = (h * 60 - rangeStart) * PPM;
        return (
          <React.Fragment key={h}>
            <div className="absolute left-0 right-0 border-t border-line" style={{ top: y + 'px' }} />
            <span
              className="absolute left-0 font-mono text-[10px] text-muted"
              style={{ top: y - 6 + 'px', width: GUTTER - 6 + 'px', textAlign: 'right' }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          </React.Fragment>
        );
      })}
      {packed.map((it) => (
        <CalBlock
          key={it.task.id}
          it={it}
          rangeStart={rangeStart}
          onToggle={onToggle}
          onEdit={onEdit}
          onMove={onMove}
          onDelete={onDelete}
          checkbox={checkbox}
        />
      ))}
    </div>
  );
}
