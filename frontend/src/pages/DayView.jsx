import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, CornerDownRight, RefreshCw } from 'lucide-react';
import api from '../api.js';
import DateNav, { formatDateHuman, todayStr, toLocalDateStr } from '../components/DateNav.jsx';
import CategoryFilter from '../components/CategoryFilter.jsx';
import TaskItem from '../components/TaskItem.jsx';
import TaskFormModal from '../components/TaskFormModal.jsx';
import MoveTaskModal from '../components/MoveTaskModal.jsx';
import TimedViewToggle from '../components/TimedViewToggle.jsx';
import TimedCalendar from '../components/TimedCalendar.jsx';
import { useTimedView } from '../useTimedView.js';

// Дата месяц назад (по локальному времени) — старее этого кнопку синхронизации не показываем.
function oneMonthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return toLocalDateStr(d);
}

export default function DayView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') || todayStr();

  const [timedView, setTimedView] = useTimedView();
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [movedAway, setMovedAway] = useState([]);
  const [templateChanged, setTemplateChanged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formTask, setFormTask] = useState(undefined); // undefined = closed, null = new, object = editing
  const [moveTask, setMoveTask] = useState(null);

  const setDate = (d) => setSearchParams({ date: d });

  const loadDay = useCallback(async () => {
    setLoading(true);
    const res = await api.get(`/days/${date}`);
    setTasks(res.data.tasks);
    setMovedAway(res.data.moved_away);
    setTemplateChanged(res.data.template_changed);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories));
  }, []);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  async function handleSetStatus(task, status) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    await api.patch(`/tasks/${task.id}/status`, { status });
  }

  async function handleCreate(payload) {
    await api.post('/tasks', { ...payload, date });
    await loadDay();
  }

  async function handleUpdate(taskId, payload) {
    await api.put(`/tasks/${taskId}`, payload);
    await loadDay();
  }

  async function handleDelete(task) {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    await api.delete(`/tasks/${task.id}`);
    await loadDay();
  }

  async function handleMove(payload) {
    await api.post(`/tasks/${moveTask.id}/move`, payload);
    await loadDay();
  }

  async function handleSyncTemplate() {
    await api.post(`/days/${date}/sync-template`);
    await loadDay();
  }

  // Кнопка обновления показывается, если шаблон менялся после генерации/синхронизации дня
  // и день не старше месяца (в совсем старых днях функция не нужна).
  const showSyncTemplate = templateChanged && date >= oneMonthAgoStr();

  const visibleTasks = categoryFilter ? tasks.filter((t) => t.category_id === categoryFilter) : tasks;
  const visibleMoved = categoryFilter ? movedAway.filter((t) => t.category_id === categoryFilter) : movedAway;
  const doneCount = visibleTasks.filter((t) => t.status === 'done').length;
  const failedCount = visibleTasks.filter((t) => t.status === 'failed').length;
  const timedTasks = visibleTasks.filter((t) => t.time_from);
  const untimedTasks = visibleTasks.filter((t) => !t.time_from);

  const renderCard = (list) => (
    <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
      {list.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onSetStatus={handleSetStatus}
          onEdit={(t) => setFormTask(t)}
          onMove={(t) => setMoveTask(t)}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );

  return (
    <div>
      <DateNav date={date} onChange={setDate} />
      <h2 className="font-display text-2xl capitalize mb-1">{formatDateHuman(date)}</h2>
      <p className="text-sm text-muted mb-5">
        {visibleTasks.length > 0
          ? `${doneCount} из ${visibleTasks.length} выполнено${failedCount > 0 ? `, ${failedCount} провалено` : ''}`
          : 'Задач пока нет'}
      </p>

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <CategoryFilter categories={categories} selected={categoryFilter} onSelect={setCategoryFilter} />
        </div>
        {showSyncTemplate && (
          <button
            type="button"
            onClick={handleSyncTemplate}
            title="Обновить из шаблона — добавить в этот день новые пункты"
            aria-label="Обновить из шаблона"
            className="shrink-0 inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface p-2 text-muted hover:text-ink hover:bg-paper transition"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
          <p className="py-6 px-4 text-muted text-sm">Загрузка…</p>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line-strong overflow-hidden">
          <p className="py-6 px-4 text-muted text-sm">На этот день пока ничего не запланировано.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {timedTasks.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted">Со временем</h3>
                <TimedViewToggle value={timedView} onChange={setTimedView} />
              </div>
              {timedView === 'calendar' ? (
                <div className="bg-surface rounded-2xl border border-line-strong p-3">
                  <TimedCalendar
                    tasks={timedTasks}
                    onSetStatus={handleSetStatus}
                    onEdit={(t) => setFormTask(t)}
                    onMove={(t) => setMoveTask(t)}
                    onDelete={handleDelete}
                  />
                </div>
              ) : (
                renderCard(timedTasks)
              )}
            </section>
          )}
          {untimedTasks.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted mb-2">Без времени</h3>
              {renderCard(untimedTasks)}
            </section>
          )}
        </div>
      )}

      <button
        onClick={() => setFormTask(null)}
        className="mt-4 flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark"
      >
        <Plus size={16} /> Добавить задачу
      </button>

      {visibleMoved.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted mb-2">Перенесено с этого дня</h3>
          <div className="space-y-1.5">
            {visibleMoved.map((m) => (
              <div key={m.task_id} className="flex items-center gap-2 text-sm text-muted">
                <CornerDownRight size={14} />
                <span className="line-through">{m.title}</span>
                <span>→ {formatDateHuman(m.now_date)}</span>
                {m.total_moves > 1 && (
                  <span className="text-xs text-muted/70">(перенесена {m.total_moves} раза)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {formTask !== undefined && (
        <TaskFormModal
          initial={formTask}
          categories={categories}
          onClose={() => setFormTask(undefined)}
          onSubmit={(payload) => (formTask ? handleUpdate(formTask.id, payload) : handleCreate(payload))}
        />
      )}

      {moveTask && (
        <MoveTaskModal task={moveTask} currentDate={date} onClose={() => setMoveTask(null)} onSubmit={handleMove} />
      )}
    </div>
  );
}
