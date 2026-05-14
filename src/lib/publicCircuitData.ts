import { supabase } from '@/integrations/supabase/client';

export const publicCircuitDataQueryKey = ['public-circuit-data'] as const;

export type PublicPlayer = {
  id: string;
  name: string;
  license: string | null;
  club: string | null;
  current_handicap: number | null;
  initial_handicap: number | null;
  gender: string | null;
  is_senior: boolean;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicResult = {
  id: string;
  round_id: string;
  player_id: string;
  handicap_at_round: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  category: string | null;
  is_female_prize: boolean;
  is_senior_prize: boolean;
  scorecard: unknown;
  play_date: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
  players_public: PublicPlayer | null;
  rounds: {
    status: string;
    is_master: boolean;
    master_coefficient: number;
    name: string;
    round_number: number;
    date: string | null;
    club: string | null;
    course: string | null;
    course_par: unknown;
    course_handicap: unknown;
    course_handicap_women: unknown;
  } | null;
};

export type PublicCircuitData = {
  players: PublicPlayer[];
  results: PublicResult[];
};

export async function fetchPublicCircuitData(): Promise<PublicCircuitData> {
  const { data, error } = await supabase.functions.invoke('public-rankings-data', {
    body: {},
  });

  if (error) throw error;

  return {
    players: ((data as PublicCircuitData | null)?.players || []) as PublicPlayer[],
    results: ((data as PublicCircuitData | null)?.results || []) as PublicResult[],
  };
}