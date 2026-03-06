/**
 * CategoryFilterBar Component
 *
 * Horizontal filter bar for actor categories.
 * Renders "All" + per-category buttons with active state accent.
 */

import type { ActorCategory } from '../../lib/types/strategic.js';

interface CategoryFilterBarProps {
  categories: ActorCategory[];
  activeFilter: string | null;
  onFilterChange: (categoryId: string | null) => void;
  onAddCategory: () => void;
}

export function CategoryFilterBar({
  categories,
  activeFilter,
  onFilterChange,
  onAddCategory,
}: CategoryFilterBarProps) {
  return (
    <div className="category-filter-bar">
      {/* All button */}
      <button
        className={`filter-btn ${activeFilter === null ? 'active' : ''}`}
        onClick={() => onFilterChange(null)}
        style={
          activeFilter === null
            ? { borderBottomColor: 'var(--accent-blue, #4a90d9)' }
            : undefined
        }
      >
        <span
          className="filter-dot"
          style={{ background: 'var(--accent-blue, #4a90d9)' }}
        />
        All
      </button>

      {/* Category buttons */}
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`filter-btn ${activeFilter === cat.id ? 'active' : ''}`}
          onClick={() => onFilterChange(cat.id)}
          style={
            activeFilter === cat.id
              ? { borderBottomColor: cat.color }
              : undefined
          }
        >
          <span className="filter-dot" style={{ background: cat.color }} />
          {cat.name}
        </button>
      ))}

      {/* Add category button */}
      <button
        className="filter-btn filter-add-btn"
        onClick={onAddCategory}
        title="Add custom category"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="14"
          height="14"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
