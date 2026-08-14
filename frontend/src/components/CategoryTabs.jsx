import React from 'react';
import { categoryTint } from '../categoryColor.js';

// Выбор категории в виде единого сегментированного переключателя.
// value/onChange работают с id категории (число) или null.
// allLabel — подпись «нулевого» сегмента: «Все задачи» (фильтр) или «Без категории» (форма).
export default function CategoryTabs({ categories, value, onChange, allLabel = 'Все задачи' }) {
  const items = [{ id: null, name: allLabel, none: true }, ...categories];

  const base =
    'whitespace-nowrap px-3.5 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent';

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex rounded-lg border border-line-strong overflow-hidden text-sm">
        {items.map((item, i) => {
          const active = value === item.id;
          const divider = i > 0 ? 'border-l border-line-strong' : '';

          // «Нулевой» сегмент — через токены темы (ink/paper), а не жёсткий цвет
          if (item.none) {
            return (
              <button
                key="all"
                type="button"
                onClick={() => onChange(null)}
                className={`${base} ${divider} ${
                  active ? 'bg-ink text-paper font-medium' : 'bg-ink/5 text-ink hover:bg-ink/10'
                }`}
              >
                {item.name}
              </button>
            );
          }

          const style = active
            ? { backgroundColor: item.color, color: '#fff' }
            : { backgroundColor: categoryTint(item.color) };

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              style={style}
              className={`${base} ${divider} hover:brightness-95 ${active ? 'font-medium' : 'text-ink'}`}
            >
              {item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
