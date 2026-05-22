import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client';
import { PlayTemplate, SchemeUnit } from '../api/types';

// The play catalog is static for a given app session — the backend serves it
// from the Play table. We cache it forever and expose ergonomic lookups.
export function usePlayCatalog() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['plays'],
    queryFn: () => api.plays(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const all: PlayTemplate[] = data?.plays ?? [];
  const byId = new Map(all.map((play) => [play.id, play]));

  return {
    isLoading,
    error,
    all,
    templatesForUnit: (unit: SchemeUnit): PlayTemplate[] =>
      all.filter((play) => play.unit === unit),
    playById: (id: string): PlayTemplate | undefined => byId.get(id),
  };
}
