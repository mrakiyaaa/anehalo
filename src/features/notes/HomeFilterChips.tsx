import { useHomeFilterStore } from '@/store/home-filter-store';
import { FilterChips } from './FilterChips';

/** All / Notes / Diagrams above the Home grid; the choice is remembered in settings.json. */
export function HomeFilterChips() {
  const filter = useHomeFilterStore((state) => state.filter);
  const setFilter = useHomeFilterStore((state) => state.setFilter);
  return <FilterChips value={filter} onChange={setFilter} />;
}
