import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { GitCompare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';

interface PlayerCompareProps {
  currentPlayerId: string;
  currentPlayerName: string;
}

type PlayerStats = {
  name: string;
  handicap: number | null;
  avgStableford: number | null;
  bestStableford: number | null;
  roundsPlayed: number;
  stdDev: number | null;
  trend: 'up' | 'down' | 'stable' | null;
  birdiesPerRound: number | null;
  avgScratch: number | null;
};

const calcStdDev = (values: number[]): number | null => {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.round(Math.sqrt(variance) * 10) / 10;
};

const calcTrend = (values: number[]): 'up' | 'down' | 'stable' | null => {
  if (values.length < 3) return null;
  const recent = values.slice(-2);
  const earlier = values.slice(0, -2);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const diff = recentAvg - earlierAvg;
  if (diff > 1) return 'up';
  if (diff < -1) return 'down';
  return 'stable';
};

const getHoleScores = (raw: unknown): number[] => {
  if (Array.isArray(raw)) return raw.map(Number).filter(n => !isNaN(n));
  if (raw && typeof raw === 'object' && 'scores' in (raw as any)) return getHoleScores((raw as any).scores);
  return [];
};

const PlayerCompareDialog: React.FC<PlayerCompareProps> = ({ currentPlayerId, currentPlayerName }) => {
  const [open, setOpen] = useState(false);
  const [comparePlayerId, setComparePlayerId] = useState<string | null>(null);

  const { data: allPlayers } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
    select: (data) => data.players.map((player) => ({
        id: player.id,
        name: player.name,
        current_handicap: player.current_handicap,
      })),
    enabled: open,
  });

  const { data: allResults } = useQuery({
    queryKey: ['compare-results-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('results')
        .select('player_id, stableford_points, handicap_at_round, scorecard, scratch_score, rounds!inner(status, round_number, course_par)')
        .eq('rounds.status', 'published')
        .order('rounds(round_number)');
      return data || [];
    },
    enabled: open,
  });

  const buildStats = (playerId: string): PlayerStats | null => {
    if (!allResults || !allPlayers) return null;
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return null;

    const playerResults = allResults.filter(r => r.player_id === playerId);
    if (playerResults.length === 0) return null;

    const stbScores = playerResults.filter(r => r.stableford_points != null).map(r => r.stableford_points!);
    const avgStb = stbScores.length > 0 ? Math.round((stbScores.reduce((a, b) => a + b, 0) / stbScores.length) * 10) / 10 : null;
    const bestStb = stbScores.length > 0 ? Math.max(...stbScores) : null;

    let totalBirdies = 0;
    let roundsWithScorecard = 0;
    for (const r of playerResults) {
      const pars = getHoleScores((r.rounds as any)?.course_par);
      const scores = getHoleScores(r.scorecard);
      if (scores.length > 0 && pars.length > 0) {
        roundsWithScorecard++;
        for (let h = 0; h < Math.min(scores.length, pars.length); h++) {
          if (pars[h] > 0 && scores[h] > 0 && scores[h] <= pars[h] - 1) totalBirdies++;
        }
      }
    }

    const scratchScores = playerResults.filter(r => r.scratch_score != null).map(r => r.scratch_score!);
    const avgScratch = scratchScores.length > 0 ? Math.round((scratchScores.reduce((a, b) => a + b, 0) / scratchScores.length) * 10) / 10 : null;

    const lastHcp = playerResults.filter(r => r.handicap_at_round != null).at(-1)?.handicap_at_round;

    return {
      name: player.name,
      handicap: lastHcp != null ? Number(lastHcp) : player.current_handicap,
      avgStableford: avgStb,
      bestStableford: bestStb,
      roundsPlayed: stbScores.length,
      stdDev: calcStdDev(stbScores),
      trend: calcTrend(stbScores),
      birdiesPerRound: roundsWithScorecard > 0 ? Math.round((totalBirdies / roundsWithScorecard) * 10) / 10 : null,
      avgScratch: avgScratch,
    };
  };

  const statsA = useMemo(() => buildStats(currentPlayerId), [currentPlayerId, allResults, allPlayers]);
  const statsB = useMemo(() => comparePlayerId ? buildStats(comparePlayerId) : null, [comparePlayerId, allResults, allPlayers]);

  const otherPlayers = allPlayers?.filter(p => p.id !== currentPlayerId) || [];

  const rows: { label: string; a: string; b: string; betterIs: 'lower' | 'higher'; aVal: number | null; bVal: number | null }[] = [];
  if (statsA && statsB) {
    rows.push(
      { label: 'Últim Handicap', a: statsA.handicap != null ? `Hdcp ${statsA.handicap}` : '—', b: statsB.handicap != null ? `Hdcp ${statsB.handicap}` : '—', betterIs: 'lower', aVal: statsA.handicap, bVal: statsB.handicap },
      { label: 'Mitjana Stableford', a: statsA.avgStableford != null ? `${statsA.avgStableford} pts` : '—', b: statsB.avgStableford != null ? `${statsB.avgStableford} pts` : '—', betterIs: 'higher', aVal: statsA.avgStableford, bVal: statsB.avgStableford },
      { label: 'Millor resultat', a: statsA.bestStableford != null ? `${statsA.bestStableford} pts` : '—', b: statsB.bestStableford != null ? `${statsB.bestStableford} pts` : '—', betterIs: 'higher', aVal: statsA.bestStableford, bVal: statsB.bestStableford },
      { label: 'Regularitat (σ)', a: statsA.stdDev != null ? `${statsA.stdDev}` : '—', b: statsB.stdDev != null ? `${statsB.stdDev}` : '—', betterIs: 'lower', aVal: statsA.stdDev, bVal: statsB.stdDev },
      { label: 'Birdies/ronda', a: statsA.birdiesPerRound != null ? `${statsA.birdiesPerRound}` : '—', b: statsB.birdiesPerRound != null ? `${statsB.birdiesPerRound}` : '—', betterIs: 'higher', aVal: statsA.birdiesPerRound, bVal: statsB.birdiesPerRound },
      { label: 'Jornades', a: `${statsA.roundsPlayed}`, b: `${statsB.roundsPlayed}`, betterIs: 'higher', aVal: statsA.roundsPlayed, bVal: statsB.roundsPlayed },
    );
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | null) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-primary inline" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-destructive inline" />;
    if (trend === 'stable') return <Minus className="h-4 w-4 text-muted-foreground inline" />;
    return <span className="text-muted-foreground">—</span>;
  };

  // Determine stronger player
  const getStrongerPlayer = (): string | null => {
    if (!statsA || !statsB) return null;
    let scoreA = 0, scoreB = 0;
    for (const row of rows) {
      if (row.aVal == null || row.bVal == null) continue;
      if (row.betterIs === 'higher') {
        if (row.aVal > row.bVal) scoreA++;
        else if (row.bVal > row.aVal) scoreB++;
      } else {
        if (row.aVal < row.bVal) scoreA++;
        else if (row.bVal < row.aVal) scoreB++;
      }
    }
    if (scoreA > scoreB) return statsA.name;
    if (scoreB > scoreA) return statsB.name;
    return null;
  };

  const stronger = getStrongerPlayer();
  const shortName = (name: string) => {
    const parts = name.split(',');
    if (parts.length >= 2) return parts[0].trim();
    return name.split(' ')[0];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <GitCompare className="h-4 w-4" />
          Comparar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-semibold tracking-tight flex items-center gap-2 font-display text-xl text-primary-foreground bg-primary p-4 -m-6 mb-4 rounded-t-lg">
            <GitCompare className="h-5 w-5 text-primary-foreground" />
            Comparador de Jugadors
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Jugador A</p>
            <div className="bg-muted/50 rounded-md px-3 py-2 text-sm font-medium truncate">{currentPlayerName}</div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Jugador B</p>
            <Select value={comparePlayerId || ''} onValueChange={setComparePlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona jugador..." />
              </SelectTrigger>
              <SelectContent>
                {otherPlayers.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {statsA && statsB && (
          <div className="mt-4">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_1fr] text-center text-sm font-semibold border-b border-border/60 pb-2 mb-1">
              <span></span>
              <span className="text-foreground truncate">{shortName(statsA.name)}</span>
              <span className="text-foreground truncate">{shortName(statsB.name)}</span>
            </div>

            {/* Rows */}
            {rows.map((row, i) => {
              const aBetter = row.aVal != null && row.bVal != null && (
                (row.betterIs === 'higher' && row.aVal > row.bVal) ||
                (row.betterIs === 'lower' && row.aVal < row.bVal)
              );
              const bBetter = row.aVal != null && row.bVal != null && (
                (row.betterIs === 'higher' && row.bVal > row.aVal) ||
                (row.betterIs === 'lower' && row.bVal < row.aVal)
              );

              return (
                <div key={row.label} className={cn('grid grid-cols-[1fr_1fr_1fr] items-center text-center py-2.5 border-b border-border/20', i % 2 === 0 && 'bg-muted/20')}>
                  <span className="text-xs text-muted-foreground text-left pl-2">{row.label}</span>
                  <span className={cn('text-sm font-mono tabular-nums', aBetter && 'text-primary font-bold')}>{row.a}</span>
                  <span className={cn('text-sm font-mono tabular-nums', bBetter && 'text-primary font-bold')}>{row.b}</span>
                </div>
              );
            })}

            {/* Trend row */}
            <div className="grid grid-cols-[1fr_1fr_1fr] items-center text-center py-2.5 border-b border-border/20">
              <span className="text-xs text-muted-foreground text-left pl-2">Tendència</span>
              <span>{getTrendIcon(statsA.trend)}</span>
              <span>{getTrendIcon(statsB.trend)}</span>
            </div>

            {/* Stronger player */}
            {stronger && (
              <div className="mt-4 bg-primary/10 rounded-lg px-4 py-3 text-center border border-primary/15">
                <span className="text-sm text-foreground">
                  Jugador més fort actualment: <strong className="text-primary">{stronger}</strong>
                </span>
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 border border-border/40 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Llegenda de la comparativa</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
                <span><strong>Handicap</strong> — Nivell federat (+ = millor)</span>
                <span><strong>Mitjana Stb.</strong> — Mitjana de punts per prova</span>
                <span><strong>Regularitat (σ)</strong> — Desviació estàndard (menor = més regular)</span>
                <span><strong>Millor resultat</strong> — Puntuació més alta aconseguida</span>
                <span><strong>Tendència</strong> — <TrendingUp className="h-3 w-3 inline" /> Millora / <TrendingDown className="h-3 w-3 inline" /> Empitjora / <Minus className="h-3 w-3 inline" /> Estable</span>
                <span><strong className="text-primary">Verd</strong> — Indica el valor superior en cada paràmetre</span>
              </div>
            </div>
          </div>
        )}

        {!statsB && (
          <p className="text-sm text-muted-foreground text-center py-8">Selecciona un jugador per comparar</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlayerCompareDialog;
