import { homeFilters, useHomeFilterStore, type HomeFilter } from '@/store/home-filter-store';

const labels: Readonly<Record<HomeFilter, string>> = {
  all: 'All',
  notes: 'Notes',
  diagrams: 'Diagrams',
};

/** All / Notes / Diagrams above the Home grid; the choice is remembered in settings.json. */
export function HomeFilterChips() {
  const filter = useHomeFilterStore((state) => state.filter);
  const setFilter = useHomeFilterStore((state) => state.setFilter);
  return (
    <div className="home-filter-chips" role="group" aria-label="Show">
      {homeFilters.map((option) => (
        <button
          key={option}
          type="button"
          className="home-filter-chip"
          aria-pressed={filter === option}
          onClick={() => setFilter(option)}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
