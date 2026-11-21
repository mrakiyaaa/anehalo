import { homeFilters, type HomeFilter } from '@/store/home-filter-store';

const labels: Readonly<Record<HomeFilter, string>> = {
  all: 'All',
  notes: 'Notes',
  diagrams: 'Diagrams',
};

/** All / Notes / Diagrams, for Home and for search. */
export function FilterChips({
  value,
  onChange,
}: {
  value: HomeFilter;
  onChange: (filter: HomeFilter) => void;
}) {
  return (
    <div className="home-filter-chips" role="group" aria-label="Show">
      {homeFilters.map((option) => (
        <button
          key={option}
          type="button"
          className="home-filter-chip"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
