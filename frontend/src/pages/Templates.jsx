import React, { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import api from '../api.js';
import TaskItem from '../components/TaskItem.jsx';
import TemplateItemFormModal from '../components/TemplateItemFormModal.jsx';
import TimedViewToggle from '../components/TimedViewToggle.jsx';
import TimedCalendar from '../components/TimedCalendar.jsx';
import { useTimedView } from '../useTimedView.js';

const TABS = [
  { key: 'weekday', label: 'Будни' },
  { key: 'weekend', label: 'Выходные' },
];

export default function Templates() {
  const [timedView, setTimedView] = useTimedView();
  const [tab, setTab] = useState('weekday');
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formItem, setFormItem] = useState(undefined);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const res = await api.get(`/templates/${tab}`);
    setItems(res.data.items);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories));
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleCreate(payload) {
    await api.post(`/templates/${tab}/items`, payload);
    await loadItems();
  }

  async function handleUpdate(id, payload) {
    await api.put(`/templates/items/${id}`, payload);
    await loadItems();
  }

  async function handleDelete(item) {
    if (!window.confirm(`Удалить «${item.title}» из шаблона?`)) return;
    await api.delete(`/templates/items/${item.id}`);
    await loadItems();
  }

  // Пункты шаблона не приходят с цветом/именем категории — подставляем из списка категорий,
  // чтобы строки выглядели в точности как в списке задач дня.
  const enriched = items.map((item) => {
    const cat = categories.find((c) => c.id === item.category_id);
    return { ...item, category_color: cat?.color || null, category_name: cat?.name || null };
  });
  const timed = enriched.filter((i) => i.time_from);
  const untimed = enriched.filter((i) => !i.time_from);

  const renderCard = (list) => (
    <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
      {list.map((item) => (
        <TaskItem
          key={item.id}
          task={item}
          checkbox={false}
          onEdit={(t) => setFormItem(t)}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );

  return (
    <div>
      <h2 className="font-display text-2xl mb-1">Типовое расписание</h2>
      <p className="text-sm text-muted mb-6">
        Эти задачи будут автоматически появляться в соответствующих днях — будних или выходных.
      </p>

      <div className="flex gap-1 mb-5 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.key ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
          <p className="py-6 px-4 text-muted text-sm">Загрузка…</p>
        </div>
      ) : enriched.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
          <p className="py-6 px-4 text-muted text-sm">В этом шаблоне пока нет задач.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {timed.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted">Со временем</h3>
                <TimedViewToggle value={timedView} onChange={setTimedView} />
              </div>
              {timedView === 'calendar' ? (
                <div className="bg-surface rounded-2xl border border-line-strong p-3">
                  <TimedCalendar
                    tasks={timed}
                    checkbox={false}
                    onEdit={(t) => setFormItem(t)}
                    onDelete={handleDelete}
                  />
                </div>
              ) : (
                renderCard(timed)
              )}
            </section>
          )}
          {untimed.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted mb-2">Без времени</h3>
              {renderCard(untimed)}
            </section>
          )}
        </div>
      )}

      <button
        onClick={() => setFormItem(null)}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark"
      >
        <Plus size={16} /> Добавить пункт в шаблон
      </button>

      {formItem !== undefined && (
        <TemplateItemFormModal
          initial={formItem}
          categories={categories}
          onClose={() => setFormItem(undefined)}
          onSubmit={(payload) => (formItem ? handleUpdate(formItem.id, payload) : handleCreate(payload))}
        />
      )}
    </div>
  );
}
