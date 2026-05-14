/**
 * Devuelve el "handicap de categoría" de cada jugador: el handicap_at_round
 * de la PRIMERA ronda jugada cronológicamente. Esta categoría queda fijada
 * para toda la temporada aunque el HCP suba o baje del umbral (15).
 *
 * Orden cronológico: play_date → rounds.date → round_number → created_at.
 */
export type CategoryResultLike = {
  player_id: string;
  handicap_at_round: number | null;
  play_date?: string | null;
  created_at?: string | null;
  rounds?: {
    date?: string | null;
    round_number?: number | null;
  } | null;
  players_public?: {
    current_handicap?: number | null;
    initial_handicap?: number | null;
  } | null;
};

const sortKey = (r: CategoryResultLike): string => {
  const d = r.play_date || r.rounds?.date || '';
  const n = String(r.rounds?.round_number ?? 9999).padStart(4, '0');
  const c = r.created_at || '';
  return `${d || '9999-99-99'}|${n}|${c}`;
};

export function buildPlayerCategoryHandicapMap(
  results: CategoryResultLike[] | null | undefined,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  if (!results?.length) return map;

  // Para cada jugador, encuentra el resultado más antiguo con HCP no nulo.
  const firstByPlayer = new Map<string, CategoryResultLike>();
  for (const r of results) {
    if (r.handicap_at_round == null) continue;
    const prev = firstByPlayer.get(r.player_id);
    if (!prev || sortKey(r) < sortKey(prev)) {
      firstByPlayer.set(r.player_id, r);
    }
  }

  for (const [pid, r] of firstByPlayer.entries()) {
    map.set(pid, r.handicap_at_round);
  }

  // Fallback: jugadores sin handicap_at_round → initial_handicap → current_handicap
  for (const r of results) {
    if (map.has(r.player_id)) continue;
    const fallback =
      r.players_public?.initial_handicap ?? r.players_public?.current_handicap ?? null;
    map.set(r.player_id, fallback);
  }

  return map;
}

export function categorizeByHandicap(hcp: number | null | undefined): 'hcp_low' | 'hcp_high' | null {
  if (hcp == null) return null;
  return Number(hcp) <= 15 ? 'hcp_low' : 'hcp_high';
}

/**
 * Devuelve el ÚLTIMO handicap con el que jugó cada jugador (más reciente
 * cronológicamente). Se usa SOLO para visualización al lado del nombre.
 * La categorización sigue usando buildPlayerCategoryHandicapMap (primera ronda).
 */
export function buildPlayerLastHandicapMap(
  results: CategoryResultLike[] | null | undefined,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  if (!results?.length) return map;

  const lastByPlayer = new Map<string, CategoryResultLike>();
  for (const r of results) {
    if (r.handicap_at_round == null) continue;
    const prev = lastByPlayer.get(r.player_id);
    if (!prev || sortKey(r) > sortKey(prev)) {
      lastByPlayer.set(r.player_id, r);
    }
  }

  for (const [pid, r] of lastByPlayer.entries()) {
    map.set(pid, r.handicap_at_round);
  }

  for (const r of results) {
    if (map.has(r.player_id)) continue;
    const fallback =
      r.players_public?.current_handicap ?? r.players_public?.initial_handicap ?? null;
    map.set(r.player_id, fallback);
  }

  return map;
}
