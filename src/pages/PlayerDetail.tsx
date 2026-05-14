import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, Trophy, Bird, Target, Square, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ca, es } from 'date-fns/locale';
import ScorecardVisual from '@/components/ScorecardVisual';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import SectionHeader from '@/components/SectionHeader';
import PlayerCompareDialog from '@/components/PlayerCompareDialog';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';

const PlayerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ca' ? ca : es;
  const [openCards, setOpenCards] = useState<string[]>([]);

  const scrollToAndOpen = useCallback((resultId: string) => {
    setOpenCards(prev => prev.includes(resultId) ? prev : [...prev, resultId]);
    setTimeout(() => {
      document.getElementById(`scorecard-${resultId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  const { data: player } = useQuery({
    queryKey: [...publicCircuitDataQueryKey, 'player', id],
    queryFn: fetchPublicCircuitData,
    select: (data) => data.players.find((player) => player.id === id) ?? null,
    enabled: !!id,
  });

  const { data: results } = useQuery({
    queryKey: ['player-results', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('results')
        .select('*, rounds!inner(name, date, club, round_number, status, is_master, course_par, course_handicap, course_handicap_women)')
        .eq('player_id', id!)
        .eq('rounds.status', 'published')
        .order('rounds(round_number)');
      return data || [];
    },
    enabled: !!id,
  });

  if (!player) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="container py-8 lg:py-12 animate-fade-in">
      <Link to="/jugadors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        {t('players.title')}
      </Link>

      <div className="mb-8 bg-primary rounded-xl px-6 py-5 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-primary-foreground">
              {player.name}
              {player.gender === 'F' && <Badge variant="outline" className="ml-2 text-xs border-primary-foreground/40 text-primary-foreground">F</Badge>}
              {player.is_senior && <Badge variant="outline" className="ml-2 text-xs border-primary-foreground/40 text-primary-foreground">SR</Badge>}
            </h1>
            <div className="flex gap-4 mt-2 text-sm text-primary-foreground/80">
              {player.club && <span>{player.club}</span>}
              {player.license && <span>Llicència: {player.license}</span>}
              {player.current_handicap != null && <span>Últim HCP participació: {player.current_handicap}</span>}
            </div>
          </div>
          <PlayerCompareDialog currentPlayerId={id!} currentPlayerName={player.name} />
        </div>
      </div>

      {/* Summary table */}
      <Card className="border-border/60 mb-6">
        <CardHeader className="pb-2 px-0 pt-0">
          <SectionHeader className="rounded-b-none mb-0">Resum de jornades</SectionHeader>
        </CardHeader>
        <CardContent>
          {results && results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="text-left py-2.5">Jornada</th>
                    <th className="text-left py-2.5 px-2">Camp</th>
                    <th className="text-left py-2.5 px-2">Data</th>
                    <th className="text-right py-2.5 px-2">HCP</th>
                    <th className="text-right py-2.5">Stableford</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => {
                    const round = r.rounds as any;
                    return (
                      <tr key={r.id} className="border-b border-border/20 last:border-0 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => scrollToAndOpen(r.id)}>
                        <td className="py-2 font-medium font-mono">
                          J{round?.round_number}
                          {round?.is_master && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 bg-accent/20 text-accent border-0">M</Badge>}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{round?.club || round?.name || '—'}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {round?.date ? format(new Date(round.date), 'dd MMM yy', { locale }) : '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">{r.handicap_at_round ?? '—'}</td>
                        <td className="py-2 text-right font-mono font-bold text-primary">{r.stableford_points ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          )}
        </CardContent>
      </Card>

      {/* Player Statistics */}
      {results && results.length > 0 && (() => {
        const roundsWithScorecard = results.filter(r => {
          const raw = r.scorecard as any;
          const scores: number[] | null = Array.isArray(raw) ? raw : raw?.scores ?? null;
          const round = r.rounds as any;
          const par: number[] | undefined = Array.isArray(round?.course_par) ? round.course_par : undefined;
          return scores && par && scores.length === par.length;
        });

        const n = roundsWithScorecard.length;
        if (n === 0) return null;

        let birdies = 0, pars = 0, bogeys = 0, doublePlus = 0, totalHoles = 0;
        for (const r of roundsWithScorecard) {
          const raw = r.scorecard as any;
          const scores: number[] = Array.isArray(raw) ? raw : raw?.scores;
          const round = r.rounds as any;
          const par: number[] = round.course_par;
          for (let i = 0; i < scores.length; i++) {
            if (scores[i] === 0 || scores[i] == null) continue;
            totalHoles++;
            const diff = scores[i] - par[i];
            if (diff <= -1) birdies++;
            else if (diff === 0) pars++;
            else if (diff === 1) bogeys++;
            else doublePlus++;
          }
        }

        const stablefordScores = results.filter(r => r.stableford_points != null).map(r => r.stableford_points!);
        const avgStableford = stablefordScores.length > 0 ? (stablefordScores.reduce((a, b) => a + b, 0) / stablefordScores.length).toFixed(1) : '—';
        const bestStableford = stablefordScores.length > 0 ? Math.max(...stablefordScores) : '—';

        const stats = [
          { label: 'Mitjana Stb.', value: avgStableford, icon: TrendingUp },
          { label: 'Millor Stb.', value: bestStableford, icon: Trophy },
          { label: 'Birdies/ronda', value: (birdies / n).toFixed(1), icon: Bird },
          { label: 'Pars/ronda', value: (pars / n).toFixed(1), icon: Target },
          { label: 'Bogeys/ronda', value: (bogeys / n).toFixed(1), icon: Square },
          { label: 'Doble+/ronda', value: (doublePlus / n).toFixed(1), icon: AlertTriangle },
        ];

        return (
           <Card className="border-border/60 mb-6">
            <CardHeader className="pb-2 px-0 pt-0">
              <SectionHeader className="rounded-b-none mb-0">Estadístiques</SectionHeader>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                {stats.map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-muted-foreground/60 mb-1"><s.icon className="h-5 w-5 mx-auto" strokeWidth={1.5} /></div>
                    <div className="font-display font-extrabold text-lg text-primary tabular-nums">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Handicap evolution */}
              {(() => {
                const hcpData = results
                  .filter(r => r.handicap_at_round != null)
                  .map(r => ({
                    label: `J${(r.rounds as any)?.round_number}`,
                    hcp: Number(r.handicap_at_round),
                  }));
                if (hcpData.length < 2) return null;

                const values = hcpData.map(d => d.hcp);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = max - min || 1;
                const chartH = 60;
                const chartW = Math.max(200, hcpData.length * 60);
                const padX = 30;
                const padY = 22;
                const usableW = chartW - padX * 2;
                const usableH = chartH - padY * 2;

                const points = hcpData.map((d, i) => ({
                  x: padX + (i / (hcpData.length - 1)) * usableW,
                  y: padY + (1 - (d.hcp - min) / range) * usableH,
                  hcp: d.hcp,
                  label: d.label,
                }));

                const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

                return (
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Evolució HCP</p>
                    <div className="overflow-x-auto">
                      <svg width={chartW} height={chartH + 20} className="text-primary">
                        <polyline
                          points={polyline}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        {points.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r="4" fill="hsl(var(--primary))" />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" className="fill-foreground text-[10px] font-mono font-semibold">
                              {p.hcp}
                            </text>
                            <text x={p.x} y={chartH + 14} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                              {p.label}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                );
              })()}
              <div className="flex gap-4 mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground">
                <span>{n} rondes amb targeta</span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Individual scorecards */}
      <SectionHeader>Targetes</SectionHeader>
      <Accordion type="multiple" value={openCards} onValueChange={setOpenCards} className="space-y-3">
        {results?.map(r => {
          const round = r.rounds as any;
          const rawScorecard = r.scorecard as any;
          const scorecard: number[] | null = Array.isArray(rawScorecard) ? rawScorecard : rawScorecard?.scores ?? null;
          const handicapPlay: number | null = rawScorecard?.handicap_play ?? null;

          const coursePar: number[] | undefined = Array.isArray(round?.course_par) ? round.course_par : undefined;
          // Scratch Stableford = puntos sin hándicap. Las bolas levantadas (s===0) cuentan como Par+4 → 0 puntos.
          const scratchStableford = scorecard && coursePar && scorecard.length === coursePar.length
            ? scorecard.reduce((total, s, i) => {
                // Bola levantada o sin dato: equivale a Par+4 (0 puntos Stableford)
                if (s == null || s === 0) return total + 0;
                const diff = s - coursePar[i];
                if (diff <= -3) return total + 5;
                if (diff === -2) return total + 4;
                if (diff === -1) return total + 3;
                if (diff === 0) return total + 2;
                if (diff === 1) return total + 1;
                return total;
              }, 0)
            : null;

          return (
            <AccordionItem key={r.id} value={r.id} id={`scorecard-${r.id}`} className="border border-border/60 rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <Badge variant="outline" className="text-xs font-mono shrink-0">J{round?.round_number}</Badge>
                  <span className="font-semibold">{round?.name}</span>
                  {round?.is_master && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-accent/20 text-accent border-0">MASTER</Badge>}
                  <span className="text-sm text-muted-foreground ml-2">
                    {round?.date ? format(new Date(round.date), 'dd MMM yyyy', { locale }) : ''}
                  </span>
                  <span className="ml-auto mr-2 font-mono font-bold text-primary">{r.stableford_points ?? '—'} pts</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="flex gap-6 mb-3 text-sm items-baseline">
                   <span>HCP Stableford: <strong className="text-primary text-lg">{r.stableford_points ?? '—'}</strong></span>
                   <span className="text-muted-foreground">Scratch Stableford: <strong>{scratchStableford ?? '—'}</strong></span>
                   <span className="text-muted-foreground">
                     HCP: {r.handicap_at_round ?? '—'}
                     {handicapPlay != null ? ` (HPU: ${handicapPlay})` : r.handicap_at_round != null ? ` (${Math.round(r.handicap_at_round)})` : ''}
                   </span>
                </div>

                {scorecard && scorecard.length > 0 ? (
                  <div className="overflow-x-auto">
                    <ScorecardVisual
                      scores={scorecard}
                      par={Array.isArray(round?.course_par) ? round.course_par : undefined}
                      handicap={Array.isArray(round?.course_handicap) ? round.course_handicap : undefined}
                      handicapWomen={Array.isArray((round as any)?.course_handicap_women) ? (round as any).course_handicap_women : undefined}
                      playerGender={player.gender}
                      playerHandicap={handicapPlay ?? r.handicap_at_round}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sense targeta hoyo a hoyo</p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default PlayerDetail;
