import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const navItems = [
  { to: '/', label: 'День', end: true },
  { to: '/templates', label: 'Шаблоны' },
  { to: '/analytics', label: 'Статистика' },
  { to: '/notes', label: 'Заметки' },
  { to: '/notifications', label: 'Уведомления' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Закрываем дровер при смене страницы
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Закрытие по Escape
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Мобильная верхняя панель с бургером */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Открыть меню"
          className="-ml-1.5 p-1.5 rounded-lg text-ink hover:bg-accent-light transition"
        >
          <Menu size={22} />
        </button>
        <h1 className="font-display text-xl">Планировщик</h1>
      </header>

      {/* Затемнение под дровером — только на мобильном */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Сайдбар: статичный на десктопе, выезжающий дровер на мобильном (вид одинаковый) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 md:w-56 md:min-h-screen border-r border-line bg-surface md:bg-surface/50 px-5 py-6 flex flex-col justify-between transition-transform duration-200 ease-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div>
          <div className="flex items-center justify-between gap-3 mb-8">
            <h1 className="font-display text-2xl">Планировщик</h1>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Закрыть меню"
              className="md:hidden p-1 rounded text-muted hover:text-ink transition"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive ? 'bg-accent text-white' : 'text-ink hover:bg-accent-light'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-col items-start gap-2">
          <button
            onClick={toggle}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition"
            title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
          </button>
          <div className="mt-2">
            <p className="text-sm text-muted mb-2 truncate">{user?.name}</p>
            <button onClick={logout} className="text-sm text-clay hover:underline">
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 py-6 md:px-10 md:py-10 max-w-4xl">
        <Outlet />
      </main>
    </div>
  );
}
