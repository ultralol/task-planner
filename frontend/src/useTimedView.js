import { useState } from 'react';

// Вид раздела «Со временем»: 'list' | 'calendar'. Сохраняется локально и общий
// для страницы дня и шаблона.
export function useTimedView() {
  const [view, setViewState] = useState(() => {
    try {
      return localStorage.getItem('timedView') === 'calendar' ? 'calendar' : 'list';
    } catch {
      return 'list';
    }
  });
  const setView = (v) => {
    setViewState(v);
    try {
      localStorage.setItem('timedView', v);
    } catch {
      /* игнорируем */
    }
  };
  return [view, setView];
}
