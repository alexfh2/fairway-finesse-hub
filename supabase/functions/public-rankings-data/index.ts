import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RankingResultRow = {
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
  players_public: {
    id: string;
    name: string;
    license: string | null;
    club: string | null;
    gender: string | null;
    is_senior: boolean;
    initial_handicap: number | null;
    current_handicap: number | null;
    photo_url: string | null;
    created_at: string;
    updated_at: string;
  } | null;
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

type PublicPlayerRow = {
  id: string;
  license: string | null;
  name: string;
  club: string | null;
  current_handicap: number | null;
  initial_handicap: number | null;
  gender: string | null;
  is_senior: boolean;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: resultsData, error: resultsError }, { data: playersData, error: playersError }] = await Promise.all([
      adminClient
      .from("results")
      .select(`
        id,
        round_id,
        player_id,
        handicap_at_round,
        stableford_points,
        scratch_score,
        category,
        is_female_prize,
        is_senior_prize,
        scorecard,
        play_date,
        source_url,
        created_at,
        updated_at,
        rounds!inner(status, is_master, master_coefficient, name, round_number, date, club, course, course_par, course_handicap, course_handicap_women),
        players!inner(id, name, license, club, gender, is_senior, initial_handicap, current_handicap, photo_url, created_at, updated_at)
      `)
      .eq("rounds.status", "published")
      .not("stableford_points", "is", null),
      adminClient
        .from("players")
        .select("id, license, name, club, current_handicap, initial_handicap, gender, is_senior, photo_url, created_at, updated_at")
        .order("name"),
    ]);

    if (resultsError) throw resultsError;
    if (playersError) throw playersError;

    const results: RankingResultRow[] = (resultsData || []).map((row: any) => ({
      id: row.id,
      round_id: row.round_id,
      player_id: row.player_id,
      handicap_at_round: row.handicap_at_round,
      stableford_points: row.stableford_points,
      scratch_score: row.scratch_score,
      category: row.category,
      is_female_prize: row.is_female_prize,
      is_senior_prize: row.is_senior_prize,
      scorecard: row.scorecard,
      play_date: row.play_date,
      source_url: row.source_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
      rounds: row.rounds
        ? {
            status: row.rounds.status,
            is_master: row.rounds.is_master,
            master_coefficient: Number(row.rounds.master_coefficient ?? 1),
            name: row.rounds.name,
            round_number: row.rounds.round_number,
            date: row.rounds.date,
            club: row.rounds.club,
            course: row.rounds.course,
            course_par: row.rounds.course_par,
            course_handicap: row.rounds.course_handicap,
            course_handicap_women: row.rounds.course_handicap_women,
          }
        : null,
      players_public: row.players
        ? {
            id: row.players.id,
            name: row.players.name,
            license: row.players.license,
            club: row.players.club,
            gender: row.players.gender,
            is_senior: row.players.is_senior,
            initial_handicap: row.players.initial_handicap,
            current_handicap: row.players.current_handicap,
            photo_url: row.players.photo_url,
            created_at: row.players.created_at,
            updated_at: row.players.updated_at,
          }
        : null,
    }));

    const players: PublicPlayerRow[] = (playersData || []).map((player: any) => ({
      id: player.id,
      license: player.license,
      name: player.name,
      club: player.club,
      current_handicap: player.current_handicap,
      initial_handicap: player.initial_handicap,
      gender: player.gender,
      is_senior: player.is_senior,
      photo_url: player.photo_url,
      created_at: player.created_at,
      updated_at: player.updated_at,
    }));

    return new Response(JSON.stringify({ players, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});