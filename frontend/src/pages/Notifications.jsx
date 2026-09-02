import React, { useEffect, useState, useCallback } from 'react';
import { Send, Link2, Unlink, RefreshCw } from 'lucide-react';
import api from '../api.js';

export default function Notifications() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const res = await api.get('/telegram/status');
    setStatus(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setMsg('');
    try {
      const res = await api.post('/telegram/link');
      // Переход в текущей вкладке, а не window.open: на iOS в режиме
      // standalone-PWA (добавлено на домашний экран) window.open() — no-op,
      // а после await он в любом случае перестаёт считаться прямым откликом
      // на клик, и Safari его молча блокирует. location.href работает везде
      // и корректно передаёт управление приложению Telegram через Universal Link.
      window.location.href = res.data.url;
    } catch (e) {
      setMsg(e.response?.data?.error || 'Не удалось создать ссылку');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMsg('');
    try {
      await api.post('/telegram/unlink');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg('');
    try {
      await api.post('/telegram/test');
      setMsg('Тестовое сообщение отправлено в Telegram.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Не удалось отправить сообщение');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl mb-1">Уведомления</h2>
      <p className="text-sm text-muted mb-6">
        Напоминания о задачах приходят в Telegram. Включить напоминание можно в самой задаче (нужно указать время начала).
      </p>

      <div className="bg-surface rounded-2xl border border-line-strong p-5 max-w-lg">
        {!status ? (
          <p className="text-muted text-sm">Загрузка…</p>
        ) : !status.enabled ? (
          <div className="text-sm">
            <p className="font-medium text-ink mb-1">Бот не настроен на сервере</p>
            <p className="text-muted">
              Администратору нужно создать бота через <span className="font-mono">@BotFather</span> и задать
              переменную окружения <span className="font-mono">TELEGRAM_BOT_TOKEN</span>.
            </p>
          </div>
        ) : status.connected ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-done" />
              <span className="text-sm font-medium text-ink">Telegram подключён</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={test}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-3 py-1.5 text-sm font-medium hover:bg-accent-dark transition disabled:opacity-60"
              >
                <Send size={15} /> Отправить тест
              </button>
              <button
                onClick={disconnect}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm text-clay hover:bg-clay-light transition disabled:opacity-60"
              >
                <Unlink size={15} /> Отключить
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-line-strong" />
              <span className="text-sm font-medium text-muted">Не подключено</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={connect}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-3 py-1.5 text-sm font-medium hover:bg-accent-dark transition disabled:opacity-60"
              >
                <Link2 size={15} /> Подключить Telegram
              </button>
              <button
                onClick={load}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm text-muted hover:text-ink hover:bg-paper transition disabled:opacity-60"
              >
                <RefreshCw size={15} /> Обновить статус
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Откроется бот в Telegram — нажмите «Start». После этого вернитесь и нажмите «Обновить статус».
            </p>
          </div>
        )}

        {msg && <p className="mt-4 text-sm text-muted">{msg}</p>}
      </div>
    </div>
  );
}
