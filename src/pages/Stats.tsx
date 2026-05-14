import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, TrendingUp, ChevronDown, Mountain, CircleDot, Bird, Star, Crown, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';
import { buildPlayerCategoryHandicapMap } from '@/lib/playerCategoryHandicap';
import { computeScratchStableford } from '@/lib/scratchStableford';

type LeaderboardEntry = { name: string; value: number; detail?: string; playerId?: string };
type HoleAggregate = { totalOverPar: number; count: number; parCounts: Record<string, number>; hcpCounts: Record<string, number> };
type CourseAggregate = { displayName: string; scores: number[]; holes: Map<number, HoleAggregate> };

const COURSE_STOPWORDS = new Set(['golf', 'club', 'de', 'del', 'la', 'el', 'los', 'las']);

const normalizeText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const getCourseKey = (name: string) => {
  const normalized = normalizeText(name);
  const significantTokens = normalized.split(' ').filter(token => token && !COURSE_STOPWORDS.has(token)).map(token => token.slice(0, 4));
  return significantTokens.join('-') || normalized.replace(/\s+/g, '-') || 'desconegut';
};

const pickDisplayName = (current: string | undefined, candidate: string) => {
  if (!current) return candidate;
  if (candidate.length > current.length) return candidate;
  return current;
};

const getHoleScores = (value: any): number[] => {
  if (Array.isArray(value?.scores)) return value.scores.map(Number);
  if (Array.isArray(value)) return value.map(Number);
  return [];
};

const getMostCommonPar = (parCounts: Record<string, number>) => {
  const topPar = Object.entries(parCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return Number(topPar || 0);
};

type LeaderPlayer = { name: string; totalPoints: number; handicap: number | null; playerId: string };
type LeadersData = Record<string, LeaderPlayer[]>;

const LeadersCard = ({ categories, data, noDataLabel, onSelectPlayer, isOpen, onToggle }: { categories: { key: string; label: string }[]; data: LeadersData; noDataLabel: string; onSelectPlayer: (id: string) => void; isOpen: boolean; onToggle: () => void }) => {
  const [activeTab, setActiveTab] = useState(categories[0]?.key);
  const activePlayers = data[activeTab] || [];
  const leader = activePlayers[0];

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="border border-border/50 bg-card/30 transition-all overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div
              className="flex items-center gap-3 px-5 py-3 border-b border-border/30"
              style={{ background: 'linear-gradient(90deg, hsl(var(--accent) / 0.14) 0%, hsl(var(--accent) / 0.06) 45%, hsl(var(--card) / 0.4) 100%)' }}
            >
              <Crown className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span className="font-body text-[11px] font-medium tracking-[0.15em] uppercase text-foreground flex-1">Líders per categoria</span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground/40 transition-transform duration-200', isOpen && 'rotate-180')} />
            </div>
            <div className="px-5 py-4">
              <p className="text-2xl font-display font-semibold text-foreground">{leader ? `${leader.totalPoints} pts` : '—'}</p>
              <p className="text-[11px] font-body text-muted-foreground mt-1">
                {leader ? `${leader.name} · ${categories.find(c => c.key === activeTab)?.label}` : noDataLabel}
              </p>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-5 pb-4">
            <div className="border-t border-border/30 pt-3">
              <div className="flex flex-wrap gap-2 mb-3">
                {categories.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setActiveTab(cat.key)}
                    className={`px-3 py-1.5 text-[10px] font-body font-medium tracking-[0.15em] uppercase transition-all border ${
                      activeTab === cat.key
                        ? 'border-accent/50 text-accent'
                        : 'border-border/50 bg-card/30 text-muted-foreground hover:border-accent/30 hover:text-foreground'
                    }`}
                    style={activeTab === cat.key ? {
                      background: 'linear-gradient(90deg, hsl(var(--accent) / 0.18) 0%, hsl(var(--accent) / 0.06) 100%)',
                    } : undefined}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              {categories.map(cat => {
                if (cat.key !== activeTab) return null;
                const players = data[cat.key] || [];
                return (
                  <div key={cat.key}>
                    {!players.length ? (
                      <p className="text-muted-foreground text-sm py-2">{noDataLabel}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {players.map((p, i) => (
                          <button
                            key={p.playerId}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onSelectPlayer(p.playerId); }}
                            className="w-full flex items-center gap-2 text-sm hover:text-accent transition-colors text-left"
                          >
                            <span className={cn('w-6 text-center font-body font-bold text-xs', i < 3 ? 'text-accent' : 'text-muted-foreground')}>{i + 1}</span>
                            <span className="flex-1 min-w-0 text-foreground font-body leading-tight truncate">{p.name}</span>
                            <span className="font-mono font-semibold text-foreground tabular-nums whitespace-nowrap">{p.totalPoints} <span className="text-xs text-muted-foreground font-normal">pts</span></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

const Stats = () => {
  const { t } = useTranslation();
  const [openCards, setOpenCards] = useState<Set<number>>(new Set());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const toggleCard = (idx: number) => {
    setOpenCards(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const { data: results, isLoading } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
    select: (data) => data.results,
  });

  const { data: categoryData } = useQuery({
    queryKey: [...publicCircuitDataQueryKey, 'category-leaders'],
    queryFn: fetchPublicCircuitData,
    select: (data) => data.results.filter((result) => result.stableford_points != null),
  });

  const categoryLeaders = useMemo(() => {
    if (!categoryData?.length) return { hcpLow: [], hcpHigh: [], female: [], senior: [] };
    const categoryHcpMap = buildPlayerCategoryHandicapMap(categoryData as any);
    const agg = new Map<string, { name: string; totalPoints: number; rounds: number; gender: string | null; is_senior: boolean; handicap: number | null; playerId: string }>();
    for (const r of categoryData) {
      const p = r.players_public as any;
      if (!p) continue;
      const hcp = categoryHcpMap.get(r.player_id) ?? r.handicap_at_round ?? p.current_handicap;
      const pts = r.stableford_points ?? 0;
      const existing = agg.get(r.player_id);
      if (existing) { existing.totalPoints += pts; existing.rounds += 1; }
      else { agg.set(r.player_id, { name: p.name, totalPoints: pts, rounds: 1, gender: p.gender, is_senior: p.is_senior, handicap: hcp, playerId: r.player_id }); }
    }
    const all = Array.from(agg.values());
    return {
      hcpLow: all.filter(p => p.handicap != null && p.handicap <= 15).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5),
      hcpHigh: all.filter(p => p.handicap != null && p.handicap > 15).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5),
      female: all.filter(p => p.gender === 'F').sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5),
      senior: all.filter(p => p.is_senior).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5),
    };
  }, [categoryData]);

  const leaderCategories = [
    { key: 'hcpLow' as const, label: 'HCP Baix' },
    { key: 'hcpHigh' as const, label: 'HCP Alt' },
  ];

  const { stats, leaderboards } = useMemo(() => {
    if (!results?.length) return { stats: null, leaderboards: [] as LeaderboardEntry[][] };

    const byPlayer = new Map<string, { name: string; stableford: number[]; birdies: number; rounds: { name: string; number: number; pts: number }[] }>();
    const specialShots: LeaderboardEntry[] = [];

    for (const r of results) {
      const name = (r.players_public as any)?.name || 'Desconegut';
      const pid = r.player_id;
      if (!byPlayer.has(pid)) byPlayer.set(pid, { name, stableford: [], birdies: 0, rounds: [] });
      const player = byPlayer.get(pid)!;

      const pars = getHoleScores((r.rounds as any)?.course_par);
      const scores = getHoleScores(r.scorecard);
      const hcps = getHoleScores((r.rounds as any)?.course_handicap);
      const roundClub = (r.rounds as any)?.club || (r.rounds as any)?.name || '';
      for (let h = 0; h < Math.min(scores.length, pars.length); h++) {
        if (pars[h] > 0 && scores[h] > 0 && scores[h] <= pars[h] - 1) player.birdies++;
        if (pars[h] > 0 && scores[h] > 0) {
          const diff = scores[h] - pars[h];
          const hcpLabel = hcps[h] > 0 ? ` · HCP ${hcps[h]}` : '';
          if (scores[h] === 1) specialShots.push({ name, value: 1, detail: `Hole-in-One · Forat ${h + 1} (Par ${pars[h]}${hcpLabel}) · ${roundClub}`, playerId: pid });
          else if (diff <= -3) specialShots.push({ name, value: 1, detail: `Albatros · Forat ${h + 1} (Par ${pars[h]}${hcpLabel}) · ${roundClub}`, playerId: pid });
          else if (diff === -2) specialShots.push({ name, value: 1, detail: `Eagle · Forat ${h + 1} (Par ${pars[h]}${hcpLabel}) · ${roundClub}`, playerId: pid });
        }
      }

      if (r.stableford_points != null) {
        player.stableford.push(r.stableford_points);
        player.rounds.push({ name: (r.rounds as any)?.name || '', number: (r.rounds as any)?.round_number || 0, pts: r.stableford_points });
      }
    }

    const players = Array.from(byPlayer.entries());

    const allRounds: LeaderboardEntry[] = [];
    const allRoundsScratch: LeaderboardEntry[] = [];
    for (const r of results) {
      if (r.stableford_points != null) allRounds.push({ name: (r.players_public as any)?.name || '', value: r.stableford_points, detail: (r.rounds as any)?.name || '', playerId: r.player_id });
      const scratchPts = computeScratchStableford(r.scorecard, (r.rounds as any)?.course_par);
      if (scratchPts != null) allRoundsScratch.push({ name: (r.players_public as any)?.name || '', value: scratchPts, detail: (r.rounds as any)?.name || '', playerId: r.player_id });
    }
    allRounds.sort((a, b) => b.value - a.value);
    allRoundsScratch.sort((a, b) => b.value - a.value);
    const top10BestRound = allRounds.slice(0, 10);
    const top10BestRoundScratch = allRoundsScratch.slice(0, 10);

    const avgList: LeaderboardEntry[] = [];
    for (const [pid, player] of players) {
      if (player.stableford.length >= 3) {
        const avg = player.stableford.reduce((a, b) => a + b, 0) / player.stableford.length;
        avgList.push({ name: player.name, value: Math.round(avg * 10) / 10, detail: `${player.stableford.length} jornades`, playerId: pid });
      }
    }
    avgList.sort((a, b) => b.value - a.value);
    const top10Avg = avgList.slice(0, 10);

    const birdieList: LeaderboardEntry[] = [];
    for (const [pid, player] of players) {
      if (player.birdies > 0) birdieList.push({ name: player.name, value: player.birdies, playerId: pid });
    }
    birdieList.sort((a, b) => b.value - a.value);
    const top10Birdies = birdieList.slice(0, 10);

    const roundNumbers = new Set<number>();
    for (const [, player] of players) for (const round of player.rounds) roundNumbers.add(round.number);
    const sortedRoundNums = Array.from(roundNumbers).sort((a, b) => a - b);

    const courseAggregates = new Map<string, CourseAggregate>();
    const parGroupTotals: Record<3 | 4 | 5, { strokes: number; count: number; perCourse: Map<string, { name: string; strokes: number; count: number }> }> = {
      3: { strokes: 0, count: 0, perCourse: new Map() },
      4: { strokes: 0, count: 0, perCourse: new Map() },
      5: { strokes: 0, count: 0, perCourse: new Map() },
    };
    for (const r of results) {
      const rawCourseName = (r.rounds as any)?.course || (r.rounds as any)?.club || '';
      if (!rawCourseName) continue;
      const courseKey = getCourseKey(rawCourseName);
      const courseAggregate = courseAggregates.get(courseKey) ?? { displayName: rawCourseName, scores: [], holes: new Map<number, HoleAggregate>() };
      courseAggregate.displayName = pickDisplayName(courseAggregate.displayName, rawCourseName);
      if (r.stableford_points != null) courseAggregate.scores.push(r.stableford_points);

      const pars = getHoleScores((r.rounds as any)?.course_par);
      const scores = getHoleScores(r.scorecard);
      const hcps = getHoleScores((r.rounds as any)?.course_handicap);
      for (let h = 0; h < Math.min(scores.length, pars.length); h++) {
        if (isNaN(pars[h]) || pars[h] === 0) continue;
        const holeAggregate = courseAggregate.holes.get(h + 1) ?? { totalOverPar: 0, count: 0, parCounts: {}, hcpCounts: {} };
        const holeScore = !scores[h] || isNaN(scores[h]) || scores[h] === 0 ? pars[h] + 4 : scores[h];
        holeAggregate.totalOverPar += holeScore - pars[h];
        holeAggregate.count += 1;
        holeAggregate.parCounts[String(pars[h])] = (holeAggregate.parCounts[String(pars[h])] || 0) + 1;
        if (hcps[h] > 0) holeAggregate.hcpCounts[String(hcps[h])] = (holeAggregate.hcpCounts[String(hcps[h])] || 0) + 1;
        courseAggregate.holes.set(h + 1, holeAggregate);

        // Par 3/4/5 averages — only count holes that were actually played (exclude picked-up)
        const parValue = pars[h];
        if ((parValue === 3 || parValue === 4 || parValue === 5) && scores[h] > 0) {
          const group = parGroupTotals[parValue as 3 | 4 | 5];
          group.strokes += scores[h];
          group.count += 1;
          const pc = group.perCourse.get(courseKey) ?? { name: rawCourseName, strokes: 0, count: 0 };
          pc.name = pickDisplayName(pc.name, rawCourseName);
          pc.strokes += scores[h];
          pc.count += 1;
          group.perCourse.set(courseKey, pc);
        }
      }
      courseAggregates.set(courseKey, courseAggregate);
    }

    const buildParAverage = (par: 3 | 4 | 5): { avg: number; total: number; perCourse: LeaderboardEntry[] } => {
      const g = parGroupTotals[par];
      const avg = g.count > 0 ? Math.round((g.strokes / g.count) * 100) / 100 : 0;
      const perCourse = Array.from(g.perCourse.values())
        .filter(c => c.count > 0)
        .map(c => {
          const cAvg = Math.round((c.strokes / c.count) * 100) / 100;
          return { name: c.name, value: cAvg, detail: `${c.count} forats jugats · ${(cAvg - par >= 0 ? '+' : '')}${(cAvg - par).toFixed(2)} sobre par` };
        })
        .sort((a, b) => b.value - a.value);
      return { avg, total: g.count, perCourse };
    };
    const par3Stats = buildParAverage(3);
    const par4Stats = buildParAverage(4);
    const par5Stats = buildParAverage(5);

    const courseList: LeaderboardEntry[] = Array.from(courseAggregates.values())
      .filter(course => course.scores.length > 0)
      .map(course => ({ name: course.displayName, value: Math.round((course.scores.reduce((a, b) => a + b, 0) / course.scores.length) * 10) / 10, detail: '' }));
    const coursesByDifficulty = [...courseList].sort((a, b) => a.value - b.value);
    const top10Courses = coursesByDifficulty.slice(0, 10);

    const holeList: { name: string; avgStrokes: number; avgOver: number; par: number; hcp: number | null }[] = [];
    for (const [, course] of courseAggregates) {
      for (const [holeNum, hole] of course.holes) {
        if (hole.count < 3) continue;
        const par = getMostCommonPar(hole.parCounts);
        const hcp = getMostCommonPar(hole.hcpCounts);
        const avgOver = hole.totalOverPar / hole.count;
        const avgStrokes = par + avgOver;
        holeList.push({ name: `Forat ${holeNum} (${course.displayName})`, avgStrokes: Math.round(avgStrokes * 100) / 100, avgOver, par, hcp: Object.keys(hole.hcpCounts).length > 0 ? hcp : null });
      }
    }

    const hardestHoles: LeaderboardEntry[] = [...holeList].sort((a, b) => b.avgOver - a.avgOver).slice(0, 10)
      .map(hole => ({ name: hole.name, value: hole.avgStrokes, detail: `x${(hole.avgStrokes / hole.par).toFixed(2)} par · Par ${hole.par}${hole.hcp != null ? ` · HCP ${hole.hcp}` : ''}` }));
    const easiestHoles: LeaderboardEntry[] = [...holeList].sort((a, b) => a.avgOver - b.avgOver).slice(0, 10)
      .map(hole => ({ name: hole.name, value: hole.avgStrokes, detail: `x${(hole.avgStrokes / hole.par).toFixed(2)} par · Par ${hole.par}${hole.hcp != null ? ` · HCP ${hole.hcp}` : ''}` }));

    const bestRound = top10BestRound[0] || { name: '—', value: 0, detail: '' };
    const bestRoundScratch = top10BestRoundScratch[0] || { name: '—', value: 0, detail: '' };
    const bestAvg = top10Avg[0] || { name: '—', value: 0 };
    const topBirdie = top10Birdies[0] || { name: '—', value: 0 };
    const hardestCourse = top10Courses[0] || { name: '—', value: 0 };
    const hardestHole = hardestHoles[0] || { name: '—', value: 0, detail: '' };
    const easiestHole = easiestHoles[0] || { name: '—', value: 0, detail: '' };

    return {
      stats: { bestRound, bestRoundScratch, bestAvg, topBirdie, hardestCourse, hardestHole, easiestHole, par3Stats, par4Stats, par5Stats, totalPlayers: players.length, totalResults: results.length, specialShots },
      leaderboards: [top10BestRound, top10BestRoundScratch, top10Avg, specialShots, top10Birdies, hardestHoles, easiestHoles, top10Courses, par3Stats.perCourse, par4Stats.perCourse, par5Stats.perCourse],
    };
  }, [results]);

  const statCards = stats
    ? [
        { icon: Trophy, label: `${t('stats.bestRound')} (amb hàndicap)`, value: `${stats.bestRound.value} pts`, detail: `${stats.bestRound.name} — ${stats.bestRound.detail}`, unit: 'pts' },
        { icon: Trophy, label: `${t('stats.bestRound')} (scratch)`, value: `${stats.bestRoundScratch.value} pts`, detail: `${stats.bestRoundScratch.name} — ${stats.bestRoundScratch.detail}`, unit: 'pts' },
        { icon: TrendingUp, label: t('stats.avgStableford'), value: `${stats.bestAvg.value} pts`, detail: stats.bestAvg.name, unit: 'pts' },
        { icon: Star, label: 'Hole-in-One / Eagles / Albatros', value: stats.specialShots.length > 0 ? `${stats.specialShots.length}` : 'Cap encara', detail: stats.specialShots.length > 0 ? stats.specialShots[0].detail || '' : 'Encara no s\'ha aconseguit cap cop especial', unit: 'special' },
        { icon: Bird, label: t('stats.birdies', 'Birdies'), value: `${stats.topBirdie.value}`, detail: stats.topBirdie.name, unit: 'birdies' },
        { icon: CircleDot, label: t('stats.hardestHole', 'Forat més difícil'), value: `${stats.hardestHole.value}`, detail: `${stats.hardestHole.name} — ${stats.hardestHole.detail || ''}`, unit: 'cops' },
        { icon: CircleDot, label: t('stats.easiestHole', 'Forat més fàcil'), value: `${stats.easiestHole.value}`, detail: `${stats.easiestHole.name} — ${stats.easiestHole.detail || ''}`, unit: 'cops' },
        { icon: Mountain, label: t('stats.courseDifficulty', 'Camps per dificultat'), value: `${stats.hardestCourse.value} pts/avg`, detail: `${stats.hardestCourse.name}`, unit: 'pts' },
        { icon: CircleDot, label: 'Mitjana Pars 3', value: stats.par3Stats.total > 0 ? `${stats.par3Stats.avg} cops` : '—', detail: stats.par3Stats.total > 0 ? `${stats.par3Stats.total} forats jugats · ${(stats.par3Stats.avg - 3 >= 0 ? '+' : '')}${(stats.par3Stats.avg - 3).toFixed(2)} sobre par` : 'Sense dades', unit: 'cops' },
        { icon: CircleDot, label: 'Mitjana Pars 4', value: stats.par4Stats.total > 0 ? `${stats.par4Stats.avg} cops` : '—', detail: stats.par4Stats.total > 0 ? `${stats.par4Stats.total} forats jugats · ${(stats.par4Stats.avg - 4 >= 0 ? '+' : '')}${(stats.par4Stats.avg - 4).toFixed(2)} sobre par` : 'Sense dades', unit: 'cops' },
        { icon: CircleDot, label: 'Mitjana Pars 5', value: stats.par5Stats.total > 0 ? `${stats.par5Stats.avg} cops` : '—', detail: stats.par5Stats.total > 0 ? `${stats.par5Stats.total} forats jugats · ${(stats.par5Stats.avg - 5 >= 0 ? '+' : '')}${(stats.par5Stats.avg - 5).toFixed(2)} sobre par` : 'Sense dades', unit: 'cops' },
      ]
    : [];

  return (
    <div className="animate-fade-in">
      <section className="container pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 className="h-5 w-5 text-accent/70" strokeWidth={1.5} />
          <h1 className="font-display text-2xl font-semibold text-foreground">{t('stats.title')}</h1>
        </div>
        <p className="text-[11px] font-body text-muted-foreground tracking-wide mb-6">
          {t('common.season')} 2026
        </p>
      </section>

      <section className="container pb-14">
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">{t('common.loading')}</p>
        ) : !stats ? (
          <p className="text-muted-foreground text-sm py-8 text-center">{t('common.noData')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <LeadersCard
              categories={leaderCategories}
              data={categoryLeaders}
              noDataLabel={t('common.noData')}
              onSelectPlayer={setSelectedPlayerId}
              isOpen={openCards.has(-1)}
              onToggle={() => {
                setOpenCards(prev => {
                  const next = new Set(prev);
                  if (next.has(-1)) next.delete(-1); else next.add(-1);
                  return next;
                });
              }}
            />
            {statCards.map((card, idx) => {
              const lb = leaderboards[idx] || [];
              const hasLeaderboard = lb.length > 0;
              const isOpen = openCards.has(idx);

              return (
                <Collapsible key={card.label} open={isOpen} onOpenChange={() => hasLeaderboard && toggleCard(idx)}>
                  <div className={cn('border border-border/50 bg-card/30 transition-all overflow-hidden', hasLeaderboard && 'cursor-pointer hover:bg-muted/10')}>
                    <CollapsibleTrigger asChild disabled={!hasLeaderboard}>
                      <button className="w-full text-left">
                        <div
                          className="flex items-center gap-3 px-5 py-3 border-b border-border/30"
                          style={{ background: 'linear-gradient(90deg, hsl(var(--accent) / 0.12) 0%, hsl(var(--accent) / 0.04) 50%, hsl(var(--card) / 0.4) 100%)' }}
                        >
                          <card.icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                          <span className="font-body text-[11px] font-medium tracking-[0.15em] uppercase text-foreground flex-1">{card.label}</span>
                          {hasLeaderboard && (
                            <ChevronDown className={cn('h-4 w-4 text-muted-foreground/40 transition-transform duration-200', isOpen && 'rotate-180')} />
                          )}
                        </div>
                        <div className="px-5 py-4">
                          <p className="text-2xl font-display font-semibold text-foreground">{card.value}</p>
                          <p className="text-[11px] font-body text-muted-foreground mt-1">{card.detail}</p>
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    {hasLeaderboard && (
                      <CollapsibleContent>
                        <div className="px-5 pb-4">
                          <div className="border-t border-border/30 pt-3 space-y-1.5">
                            <p className="text-[10px] font-body font-medium text-muted-foreground/70 tracking-[0.2em] uppercase mb-2">{card.unit === 'special' ? 'Registre' : 'Top 10'}</p>
                            {lb.map((entry, i) => {
                              const isHoleStat = card.unit === 'cops';
                              const isSpecial = card.unit === 'special';
                              return (
                                <div key={`${entry.name}-${i}`} className={cn('text-sm', (isHoleStat || isSpecial) ? 'flex flex-col gap-0.5 py-1.5 border-b border-border/20 last:border-b-0' : 'flex flex-col gap-0.5')}>
                                  {isSpecial ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className={cn('w-6 text-center font-body font-bold text-xs', i < 3 ? 'text-accent' : 'text-muted-foreground')}>{i + 1}</span>
                                        {entry.playerId ? <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(entry.playerId!); }} className="font-body font-semibold text-foreground hover:text-accent transition-colors text-left">{entry.name}</button> : <span className="font-body font-semibold text-foreground">{entry.name}</span>}
                                      </div>
                                      {entry.detail && <span className="text-[10px] font-body text-muted-foreground/60 pl-8 leading-snug">{entry.detail}</span>}
                                    </>
                                  ) : isHoleStat ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className={cn('w-6 text-center font-body font-bold text-xs', i < 3 ? 'text-accent' : 'text-muted-foreground')}>{i + 1}</span>
                                        <span className="font-mono font-semibold text-foreground tabular-nums">{entry.value} <span className="text-xs font-normal text-muted-foreground">{card.unit}</span></span>
                                        {entry.detail && <span className="text-[10px] font-body text-muted-foreground/60">· {entry.detail}</span>}
                                      </div>
                                      <span className="text-[10px] font-body text-muted-foreground/60 pl-8 leading-snug">{entry.name}</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className={cn('w-6 text-center font-body font-bold text-xs', i < 3 ? 'text-accent' : 'text-muted-foreground')}>{i + 1}</span>
                                        {entry.playerId ? <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedPlayerId(entry.playerId!); }} className="flex-1 min-w-0 font-body text-foreground leading-tight hover:text-accent transition-colors text-left truncate">{entry.name}</button> : <span className="flex-1 min-w-0 font-body text-foreground leading-tight truncate">{entry.name}</span>}
                                        <span className="font-mono font-semibold text-foreground tabular-nums whitespace-nowrap">{entry.value} <span className="text-xs text-muted-foreground font-normal">{card.unit}</span></span>
                                      </div>
                                      {entry.detail && <span className="text-[10px] font-body text-muted-foreground/60 pl-8 leading-snug">{entry.detail}</span>}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CollapsibleContent>
                    )}
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </section>

      <PlayerProfileDialog playerId={selectedPlayerId} open={!!selectedPlayerId} onOpenChange={(o) => !o && setSelectedPlayerId(null)} />
    </div>
  );
};

export default Stats;
