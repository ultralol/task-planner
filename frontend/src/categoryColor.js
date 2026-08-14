// Приглушённый фон по цвету категории — подмешиваем цвет к поверхности текущей темы.
// Используется и в переключателе категорий (CategoryTabs), и как фон задач (TaskItem).
// Так тинт корректно читается и на светлой, и на тёмной теме.
export function categoryTint(hex) {
  return `color-mix(in srgb, ${hex} var(--tint-strength), var(--surface))`;
}
