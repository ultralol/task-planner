import React from 'react';
import CategoryTabs from './CategoryTabs.jsx';

export default function CategoryFilter({ categories, selected, onSelect }) {
  return <CategoryTabs categories={categories} value={selected} onChange={onSelect} allLabel="Все" />;
}
