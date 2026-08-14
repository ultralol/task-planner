import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl mb-1">Планировщик</h1>
        <p className="text-muted mb-8">Войдите, чтобы открыть свой день</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded-lg px-3 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {error && <p className="text-pending text-sm">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-white rounded-lg py-2.5 font-medium hover:bg-accent-dark transition disabled:opacity-60"
          >
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="text-sm text-muted mt-6">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-accent font-medium">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
