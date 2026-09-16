import { stationMatchesFilter } from '@/utils/mapping-coverage';
import type { StationSummary } from '@/types/station';

it('ne propose jamais la collection 2022 dans les deux filtres de la campagne 1970', () => {
  const photo = { kind: 'station-2022', year: 2022 } as StationSummary;
  expect(stationMatchesFilter(photo, 'to-reprise')).toBe(false);
  expect(stationMatchesFilter(photo, 'published-reprise')).toBe(false);
  expect(stationMatchesFilter({ ...photo, kind: 'archive-1970', remainingCount: 48 }, 'to-reprise')).toBe(true);
  expect(stationMatchesFilter({ ...photo, kind: 'recapture-1970' }, 'published-reprise')).toBe(true);
});
