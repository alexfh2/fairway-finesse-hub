import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';
import {
  computeSeasonRankings,
  buildPlayerRankPositions as _buildPlayerRankPositions,
  type CategoryKey,
  type RankedPlayer,
  type SeasonRankings,
} from '@/lib/seasonRankings';

export type { CategoryKey, RankedPlayer, SeasonRankings };
export type CategoryRankings = SeasonRankings;

export function useCategoryRankings() {
  const { data: results } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
    select: (data) => data.results,
  });

  const { data: publishedRoundIds } = useQuery({
    queryKey: ['published-round-ids'],
    queryFn: async () => {
      const { data } = await supabase.from('rounds').select('id').eq('status', 'published');
      return new Set((data || []).map((r) => r.id));
    },
  });

  return useMemo<CategoryRankings>(
    () => computeSeasonRankings(results || [], publishedRoundIds),
    [results, publishedRoundIds],
  );
}

export const buildPlayerRankPositions = _buildPlayerRankPositions;
