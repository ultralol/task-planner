import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import api from '../api.js';
import CategoryFilter from '../components/CategoryFilter.jsx';
import { todayStr, toLocalDateStr, DateStepper } from '../components/DateNav.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

// Цвета графика/сводки под тему (совпадают с токенами done/pending/muted/line)
const CHART = {
  light: { grid: '#E6E8EE', tick: '#6B7280', done: '#1FA168', pending: '#D6574A', moved: '#C6CAD3', surface: '#FFFFFF', ink: '#15181D' },
  dark: { grid: '#263039', tick: '#8894A1', done: '#4FB98A', pending: '#E8734A', moved: '#41505C', surface: '#182029', ink: '#E6EBF0' },
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateStr(d);
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-surface rounded-2xl border border-line px-5 py-4 flex-1 min-w-[120px]">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="font-display text-2xl" style={color ? { color } : {}}>
        {value}
      </p>
    </div>
  );
}

export default function Analytics() {
  const { theme } = useTheme();
  const c = CHART[theme] || CHART.light;
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [from, setFrom] = useState(daysAgo(13));
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/analytics', {
      params: { from, to, category_id: categoryFilter || undefined },
    });
    setData(res.data);
    setLoading(false);
  }, [from, to, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData =
    data?.by_day.map((d) => ({
      date: d.date.slice(5).split('-').reverse().join('.'),
      Выполнено: d.done,
      Невыполнено: d.pending,
      Перенесено: d.moved_away,
    })) || [];

  return (
    <div>
      <h2 className="font-display text-2xl mb-1">Аналитика</h2>
      <p className="text-sm text-muted mb-6">Как выполняются задачи за выбранный период.</p>

      <div className="flex flex-wrap items-end gap-4 mb-5">
        <div>
          <label className="block text-xs text-muted mb-1">С</label>
          <DateStepper value={from} onChange={setFrom} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">По</label>
          <DateStepper value={to} onChange={setTo} />
        </div>
      </div>

      <div className="mb-6">
        <CategoryFilter categories={categories} selected={categoryFilter} onSelect={setCategoryFilter} />
      </div>

      {loading || !data ? (
        <p className="text-muted text-sm">Загрузка…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-8">
            <StatCard label="Всего задач" value={data.summary.total} />
            <StatCard label="Выполнено" value={data.summary.done} color={c.done} />
            <StatCard label="Невыполнено" value={data.summary.pending} color={c.pending} />
            <StatCard label="Перенесено" value={data.summary.moved_away} color={c.tick} />
            <StatCard label="% выполнения" value={`${data.summary.completion_rate}%`} />
          </div>

          <div className="bg-surface rounded-2xl border border-line p-5 mb-8" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: c.tick }} stroke={c.grid} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: c.tick }} stroke={c.grid} />
                <Tooltip
                  cursor={{ fill: c.grid, fillOpacity: 0.4 }}
                  contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.ink }}
                  labelStyle={{ color: c.tick }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: c.tick }} />
                <Bar dataKey="Выполнено" stackId="a" fill={c.done} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Невыполнено" stackId="a" fill={c.pending} />
                <Bar dataKey="Перенесено" stackId="a" fill={c.moved} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="text-sm font-medium text-muted mb-2">По категориям</h3>
          <div className="bg-surface rounded-2xl border border-line divide-y divide-line">
            {data.by_category.map((c) => (
              <div key={c.category_id || 'none'} className="flex items-center gap-3 px-4 py-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.category_color }} />
                <span className="flex-1 text-sm">{c.category_name}</span>
                <span className="text-xs text-muted w-24 text-right">{c.total} всего</span>
                <span className="text-xs text-done w-28 text-right">{c.done} выполнено</span>
                <span className="text-xs text-pending w-28 text-right">{c.pending} невыполнено</span>
                <span className="text-xs text-muted w-24 text-right">{c.moved_away} перенесено</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
