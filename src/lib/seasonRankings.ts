/**
 * Cálculo del Ranking Regularidad según el Reglamento del Circuito Albatros 2026.
 *
 * Reglas:
 *  - 4 categorías: 1ª HCP (≤14.4), 2ª HCP (≥14.5), Damas, Scratch.
 *  - Se contabilizan las MEJORES 3 tarjetas de cada jugador.
 *  - Se suman 5 puntos adicionales por cada torneo jugado (todas las jornadas
 *    publicadas en las que el jugador participó, incluida la suya como ganador).
 *  - NO se contabiliza la tarjeta del 1º clasificado de cada categoría en cada
 *    jornada (pasa directo a la final). Esa tarjeta queda excluida del cálculo
 *    de "mejores 3", pero la jornada sí cuenta para el bonus de +5.
 *  - No se aplica multiplicador MASTER en este ranking.
 *  - Categoría Scratch: puntos = stableford SCRATCH (sin handicap) calculado
 *    desde la scorecard con el par del campo. Mismas reglas (best 3 + bonus).
 */
import type { PublicResult } from '@/lib/publicCircuitData';
import {
  buildPlayerCategoryHandicapMap,
  buildPlayerLastHandicapMap,
} from '@/lib/playerCategoryHandicap';
import { computeScratchStableford } from '@/lib/scratchStableford';

export type CategoryKey = 'hcpInf' | 'hcpSup' | 'female' | 'scratch';

export const BEST_N_ROUNDS = 3;
export const BONUS_PER_ROUND = 5;

export type RoundScoreEntry = {
  points: number;       // puntos de la tarjeta (stableford o scratch)
  weighted: number;     // mismo valor (sin multiplicador MASTER) — se mantiene por compat con la UI
  excluded: boolean;    // true si es la tarjeta del 1º clasificado de la categoría en esa jornada
  counted: boolean;     // true si finalmente entra en las "mejores 3" (no excluida y dentro del top 3)
};

export type RankedPlayer = {
  id: string;
  name: string;
  gender: string | null;
  is_senior: boolean;
  handicap: number | null;          // HCP de categoría (1ª ronda jugada)
  displayHandicap: number | null;   // HCP más reciente (sólo visualización)
  total: number;                    // puntuación final del ranking
  bestSum: number;                  // suma de las mejores 3 tarjetas
  bonus: number;                    // puntos por asistencia (5 × jornadas jugadas)
  roundsPlayed: number;
  roundScores: Map<string, RoundScoreEntry>;
};

export type SeasonRankings = Record<CategoryKey, RankedPlayer[]>;

type Bucket = {
  name: string;
  gender: string | null;
  is_senior: boolean;
  handicap: number | null;
  displayHandicap: number | null;
  // Map roundId → puntos (los más altos del jugador en esa ronda, por si hubiera duplicados)
  scoresByRound: Map<string, number>;
};

function getStableford(r: PublicResult): number | null {
  return r.stableford_points ?? null;
}

function getScratchPoints(r: PublicResult): number | null {
  const fromCard = computeScratchStableford(r.scorecard, r.rounds?.course_par);
  if (fromCard != null) return fromCard;
  // Fallback: usar scratch_score si parece estar en escala de stableford (≤ 50)
  if (r.scratch_score != null && r.scratch_score <= 50) return r.scratch_score;
  return null;
}

type CategoryDef = {
  key: CategoryKey;
  filter: (b: Pick<Bucket, 'gender' | 'is_senior' | 'handicap'>) => boolean;
  pointsOf: (r: PublicResult) => number | null;
};

export function computeSeasonRankings(
  results: PublicResult[] | null | undefined,
  publishedRoundIds?: Set<string>,
): SeasonRankings {
  const empty: SeasonRankings = { hcpInf: [], hcpSup: [], female: [], scratch: [] };
  if (!results?.length) return empty;

  // Filtra a jornadas publicadas si se proporciona el set; si no, usa lo recibido.
  const valid = publishedRoundIds
    ? results.filter((r) => publishedRoundIds.has(r.round_id))
    : results;

  const categoryHcpMap = buildPlayerCategoryHandicapMap(valid as any);
  const lastHcpMap = buildPlayerLastHandicapMap(valid as any);

  const categories: CategoryDef[] = [
    {
      key: 'hcpInf',
      filter: (b) => b.handicap != null && b.handicap <= 14.4,
      pointsOf: getStableford,
    },
    {
      key: 'hcpSup',
      filter: (b) => b.handicap != null && b.handicap > 14.4,
      pointsOf: getStableford,
    },
    {
      key: 'female',
      filter: (b) => b.gender === 'F',
      pointsOf: getStableford,
    },
    {
      key: 'scratch',
      filter: () => true, // todos los jugadores con tarjeta válida
      pointsOf: getScratchPoints,
    },
  ];

  const out: SeasonRankings = { hcpInf: [], hcpSup: [], female: [], scratch: [] };

  for (const cat of categories) {
    // 1) Agrupar resultados por jugador (filtrados por categoría)
    const buckets = new Map<string, Bucket>();
    const playerPointsByRound = new Map<string, Map<string, number>>(); // pid → roundId → pts

    for (const r of valid) {
      if (!r.players_public) continue;
      const pid = r.player_id;
      const handicap = categoryHcpMap.get(pid) ?? r.players_public.current_handicap ?? r.handicap_at_round;
      const candidate = {
        gender: r.players_public.gender,
        is_senior: r.players_public.is_senior,
        handicap: handicap ?? null,
      };
      if (!cat.filter(candidate)) continue;

      const pts = cat.pointsOf(r);
      if (pts == null) continue;

      if (!buckets.has(pid)) {
        buckets.set(pid, {
          name: r.players_public.name,
          gender: r.players_public.gender,
          is_senior: r.players_public.is_senior,
          handicap: handicap ?? null,
          displayHandicap: lastHcpMap.get(pid) ?? r.players_public.current_handicap ?? r.handicap_at_round,
          scoresByRound: new Map(),
        });
      }
      const b = buckets.get(pid)!;
      const prev = b.scoresByRound.get(r.round_id);
      if (prev == null || pts > prev) b.scoresByRound.set(r.round_id, pts);

      if (!playerPointsByRound.has(pid)) playerPointsByRound.set(pid, new Map());
      const m = playerPointsByRound.get(pid)!;
      const prevM = m.get(r.round_id);
      if (prevM == null || pts > prevM) m.set(r.round_id, pts);
    }

    // 2) Para cada jornada, identificar al ganador de la categoría (máx puntos)
    const winnersByRound = new Map<string, string>(); // roundId → playerId
    const roundIds = new Set<string>();
    for (const [, b] of buckets) for (const rid of b.scoresByRound.keys()) roundIds.add(rid);

    for (const rid of roundIds) {
      let bestPid: string | null = null;
      let bestPts = -Infinity;
      for (const [pid, b] of buckets) {
        const pts = b.scoresByRound.get(rid);
        if (pts == null) continue;
        if (pts > bestPts) { bestPts = pts; bestPid = pid; }
      }
      if (bestPid) winnersByRound.set(rid, bestPid);
    }

    // 3) Construir ranking
    const ranked: RankedPlayer[] = [];
    for (const [pid, b] of buckets) {
      const entries: { roundId: string; points: number; excluded: boolean }[] = [];
      for (const [rid, pts] of b.scoresByRound) {
        const excluded = winnersByRound.get(rid) === pid;
        entries.push({ roundId: rid, points: pts, excluded });
      }

      // Mejores 3 entre las NO excluidas
      const eligible = entries.filter((e) => !e.excluded).sort((a, b) => b.points - a.points);
      const counted = new Set(eligible.slice(0, BEST_N_ROUNDS).map((e) => e.roundId));
      const bestSum = eligible.slice(0, BEST_N_ROUNDS).reduce((s, e) => s + e.points, 0);

      const roundsPlayed = entries.length;
      const bonus = roundsPlayed * BONUS_PER_ROUND;
      const total = bestSum + bonus;

      const roundScores = new Map<string, RoundScoreEntry>();
      for (const e of entries) {
        roundScores.set(e.roundId, {
          points: e.points,
          weighted: e.points,
          excluded: e.excluded,
          counted: counted.has(e.roundId),
        });
      }

      ranked.push({
        id: pid,
        name: b.name,
        gender: b.gender,
        is_senior: b.is_senior,
        handicap: b.handicap,
        displayHandicap: b.displayHandicap,
        total,
        bestSum,
        bonus,
        roundsPlayed,
        roundScores,
      });
    }

    ranked.sort((a, b) => b.total - a.total);
    out[cat.key] = ranked;
  }

  return out;
}

export function buildPlayerRankPositions(rankings: SeasonRankings) {
  const map = new Map<string, Partial<Record<CategoryKey, number>>>();
  (Object.keys(rankings) as CategoryKey[]).forEach((cat) => {
    rankings[cat].forEach((p, i) => {
      if (!map.has(p.id)) map.set(p.id, {});
      map.get(p.id)![cat] = i + 1;
    });
  });
  return map;
}