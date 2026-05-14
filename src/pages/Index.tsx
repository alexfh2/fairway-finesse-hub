import heroBg from '@/assets/hero-editorial.png';
import sponsorsLine from '@/assets/sponsors/sponsors-line.png';
import sponsorsLineLight from '@/assets/sponsors/sponsors-line-light.png';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Trophy, BarChart3, Calendar, ChevronRight, Users, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';
import { buildPlayerCategoryHandicapMap, buildPlayerLastHandicapMap, categorizeByHandicap } from '@/lib/playerCategoryHandicap';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';

const Index = () => {
  const { t, i18n } = useTranslation();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const { data: rounds } = useQuery({
    queryKey: ['public-rounds-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rounds')
        .select('id, name, date, end_date, club, course, sponsor, status, is_master, round_number')
        .eq('status', 'published')
        .order('date', { ascending: true });
      return data || [];
    },
  });

  const { data: topResults } = useQuery({
    queryKey: [...publicCircuitDataQueryKey, 'home-top-results'],
    queryFn: fetchPublicCircuitData,
    select: (data) =>
      [...data.results]
        .filter((result) => result.stableford_points != null)
        .sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0)),
  });

  const buildRanking = (cat: 'hcp_low' | 'hcp_high') => {
    if (!topResults?.length) return [];
    const agg = new Map<string, { name: string; totalPoints: number; rounds: number; handicap: number | null; playerId: string; category: string | null }>();
    // Categoría fijada por el HCP de la primera ronda jugada (consistente con Rankings).
    const categoryHcpMap = buildPlayerCategoryHandicapMap(topResults as any);
    // Para mostrar al lado del nombre: último HCP jugado.
    const lastHcpMap = buildPlayerLastHandicapMap(topResults as any);
    const playerCat = new Map<string, 'hcp_low' | 'hcp_high'>();
    for (const r of topResults) {
      if (playerCat.has(r.player_id)) continue;
      const resolved = categorizeByHandicap(categoryHcpMap.get(r.player_id) ?? null);
      if (resolved) playerCat.set(r.player_id, resolved);
    }
    for (const r of topResults) {
      const p = (r as any).players_public;
      if (!p) continue;
      if (playerCat.get(r.player_id) !== cat) continue;
      const displayHcp = lastHcpMap.get(r.player_id) ?? r.handicap_at_round ?? p.current_handicap;
      const pts = r.stableford_points ?? 0;
      const existing = agg.get(r.player_id);
      if (existing) {
        existing.totalPoints += pts;
        existing.rounds += 1;
      } else {
        agg.set(r.player_id, { name: p.name, totalPoints: pts, rounds: 1, handicap: displayHcp, playerId: r.player_id, category: cat });
      }
    }
    return Array.from(agg.values()).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5);
  };
  const rankingLow = buildRanking('hcp_low');
  const rankingHigh = buildRanking('hcp_high');

  const totalRounds = rounds?.length ?? 0;
  const uniquePlayers = topResults ? new Set(topResults.map(r => r.player_id)).size : 0;
  const totalPoints = topResults ? topResults.reduce((s, r) => s + (r.stableford_points ?? 0), 0) : 0;

  const quickLinks = [
    { icon: Trophy, label: t('home.viewRankings'), desc: 'Consulta la classificació general i per categories', path: '/ranquings' },
    { icon: BarChart3, label: t('home.viewStats'), desc: 'Descobreix dades, gràfics i comparatives del circuit', path: '/estadistiques' },
    { icon: Calendar, label: t('home.calendar', 'Calendari'), desc: 'Consulta les properes jornades i esdeveniments', path: '/jornades' },
  ];

  return (
    <div className="animate-fade-in">
      {/* ——— HERO ——— */}
      <section className="relative min-h-[68vh] lg:min-h-[78vh] overflow-hidden flex items-center">
        {/* Background image */}
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover object-bottom" />
        </div>
        {/* Gradients — keep top transparent so navbar blends */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background/50 to-transparent" />

        {/* Hero text — vertically centered, balanced spacing */}
        <div className="relative z-10 container py-10">
          <p className="font-body text-[11px] font-medium tracking-[0.35em] uppercase text-accent/80 mb-3">
            {t('common.season')} 2026
          </p>
          <h1 className="font-brand text-5xl lg:text-7xl font-bold text-foreground leading-[0.95] mb-1 tracking-tight">
            Gastronòmic <span className="font-extrabold">GOLF</span>
          </h1>
          <p className="font-brand text-xl lg:text-2xl text-accent/70 font-light tracking-wide mb-3">
            circuit de golf
          </p>
          <p className="font-body text-sm text-muted-foreground/70 tracking-wide">
            Classificació i seguiment del circuit
          </p>
        </div>

        {/* ——— SPONSORS overlay (positioned over the lower part of the hero) ——— */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          {/* translucent panel that blends with the image */}
          <div className="bg-gradient-to-t from-background/85 via-background/55 to-transparent backdrop-blur-[2px] pt-10 pb-5">
            <div className="container">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px flex-1 bg-border/30" />
                <h2 className="font-body text-[10px] font-medium tracking-[0.3em] uppercase text-muted-foreground/70">
                  Patrocinadors
                </h2>
                <div className="h-px flex-1 bg-border/30" />
              </div>
              <img
                src={sponsorsLineLight}
                alt="Patrocinadors: Escampa Hotels, bonÀrea, Santi Pàmies Joiers, Grup Optimotor, Pruna Car Go - Omoda Jaecoo, Tancat de Codorniu, Garmin"
                loading="lazy"
                className="block dark:hidden mx-auto w-[85%] sm:w-[75%] h-auto object-contain opacity-65 hover:opacity-95 transition-opacity duration-500"
              />
              <img
                src={sponsorsLine}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="hidden dark:block mx-auto w-[85%] sm:w-[75%] h-auto object-contain opacity-65 hover:opacity-95 transition-opacity duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ——— QUICK ACCESS ——— */}
      <section className="container pt-6 pb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px flex-1 bg-border/60" />
          <h2 className="font-body text-[10px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
            {t('home.quickAccess')}
          </h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mx-auto">
          {quickLinks.map((link) => (
            <Link key={link.path} to={link.path} className="group">
              <div
                className="relative overflow-hidden border border-border/50 px-5 py-5 sm:px-6 sm:py-5 hover:border-accent/40 transition-all duration-500 flex items-center gap-4"
                style={{
                  background:
                    'linear-gradient(180deg, hsl(var(--card) / 0.55) 0%, hsl(var(--card) / 0.2) 100%)',
                  boxShadow: '0 12px 30px -20px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(var(--foreground) / 0.03)',
                }}
              >
                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <link.icon className="h-6 w-6 sm:h-6 sm:w-6 text-accent/80 shrink-0" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-body text-base sm:text-sm font-semibold text-foreground tracking-wide">{link.label}</h3>
                  <p className="hidden sm:block text-[11px] text-muted-foreground leading-snug truncate mt-0.5">{link.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/40 ml-auto shrink-0 group-hover:text-accent/70 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ——— RANKING + STATS ——— */}
      <section className="container pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* General Ranking */}
          <div
            className="lg:col-span-2 relative overflow-hidden border border-border/50"
            style={{
              background:
                'linear-gradient(180deg, hsl(var(--card) / 0.6) 0%, hsl(var(--card) / 0.25) 100%), radial-gradient(circle at 90% 0%, hsl(var(--accent) / 0.07), transparent 40%)',
              boxShadow: '0 20px 50px -25px hsl(0 0% 0% / 0.6), inset 0 1px 0 hsl(var(--foreground) / 0.04)',
            }}
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent/70 via-accent/30 to-transparent" />
            <Tabs defaultValue="low" className="w-full">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-7 py-4 border-b border-border/40 flex-wrap">
                <TabsList className="bg-muted/30 border border-border/40 h-auto p-1">
                  <TabsTrigger
                    value="low"
                    className="text-[11px] font-body font-medium tracking-[0.18em] uppercase px-3 sm:px-4 py-1.5 data-[state=active]:bg-accent/15 data-[state=active]:text-accent"
                  >
                    HCP Inferior
                  </TabsTrigger>
                  <TabsTrigger
                    value="high"
                    className="text-[11px] font-body font-medium tracking-[0.18em] uppercase px-3 sm:px-4 py-1.5 data-[state=active]:bg-accent/15 data-[state=active]:text-accent"
                  >
                    HCP Superior
                  </TabsTrigger>
                </TabsList>
                <Link
                  to="/ranquings"
                  className="flex items-center gap-1 text-[11px] text-accent/80 font-body font-medium tracking-wider uppercase hover:text-accent transition-colors"
                >
                  <span className="hidden sm:inline">Veure rànquing complet</span>
                  <span className="sm:hidden">Veure tot</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {(['low', 'high'] as const).map((key) => {
                const list = key === 'low' ? rankingLow : rankingHigh;
                return (
                  <TabsContent key={key} value={key} className="mt-0">
                    <div className="px-3 sm:px-5 py-2">
                      {list.length > 0 ? (
                        list.map((p, i) => (
                          <RankingRow
                            key={p.playerId}
                            position={i + 1}
                            name={p.name}
                            handicap={p.handicap}
                            points={p.totalPoints}
                            rounds={p.rounds}
                            onClick={() => setSelectedPlayerId(p.playerId)}
                          />
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm py-8 text-center">{t('common.noData')}</p>
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>

          {/* Stats cards */}
          <div className="flex flex-col gap-4">
            <StatCard label="Torneigs disputats" value={totalRounds} sub="de 17" icon={<Calendar className="h-5 w-5" />} />
            <StatCard label="Jugadors actius" value={uniquePlayers} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Punts acumulats" value={totalPoints.toLocaleString()} icon={<TrendingUp className="h-5 w-5" />} />
          </div>
        </div>
      </section>
      <PlayerProfileDialog
        playerId={selectedPlayerId}
        open={!!selectedPlayerId}
        onOpenChange={(open) => !open && setSelectedPlayerId(null)}
      />
    </div>
  );
};

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden border border-border/50 p-7 flex flex-col justify-between flex-1 transition-all duration-500 hover:border-accent/30"
      style={{
        background:
          'linear-gradient(180deg, hsl(var(--card) / 0.6) 0%, hsl(var(--card) / 0.25) 100%), radial-gradient(circle at 85% 15%, hsl(var(--accent) / 0.1), transparent 55%)',
        boxShadow: '0 20px 50px -25px hsl(0 0% 0% / 0.6), inset 0 1px 0 hsl(var(--foreground) / 0.04)',
      }}
    >
      {/* gold top accent */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent/70 via-accent/30 to-transparent" />
      {/* subtle radial highlight on hover */}
      <span aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-accent/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative flex items-center justify-between mb-6 gap-3">
        <span className="font-body text-[13px] md:text-sm font-semibold tracking-[0.18em] uppercase text-foreground/85">{label}</span>
        <span className="text-accent/60 transition-colors group-hover:text-accent/90 shrink-0">{icon}</span>
      </div>
      <div className="relative">
        <span className="font-display text-4xl font-semibold text-foreground tracking-tight">{value}</span>
        {sub && <span className="ml-2 text-sm text-muted-foreground font-body">{sub}</span>}
      </div>
    </div>
  );
}

function RankingRow({
  position,
  name,
  handicap,
  points,
  rounds,
  onClick,
}: {
  position: number;
  name: string;
  handicap: number | null;
  points: number;
  rounds: number;
  onClick: () => void;
}) {
  const isTop3 = position <= 3;
  // Use accent (green) intensity instead of medal colours.
  const accentAlpha = position === 1 ? 0.22 : position === 2 ? 0.14 : position === 3 ? 0.08 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full text-left grid grid-cols-[2.25rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_4rem_5rem_5rem] gap-3 items-center py-3.5 border-b border-border/15 hover:bg-muted/15 transition-all overflow-hidden group"
      style={
        isTop3
          ? {
              background: `linear-gradient(90deg, hsl(var(--accent) / ${accentAlpha}) 0%, hsl(var(--accent) / ${accentAlpha * 0.4}) 35%, transparent 75%)`,
            }
          : undefined
      }
    >
      {isTop3 && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r"
          style={{ background: `linear-gradient(180deg, hsl(var(--accent) / ${Math.min(1, accentAlpha * 4)}) 0%, hsl(var(--accent) / ${accentAlpha}) 100%)` }}
        />
      )}

      <div className="flex items-center justify-center">
        <span
          className={`text-sm font-body font-semibold w-7 text-center ${
            isTop3 ? 'text-accent' : 'text-muted-foreground/70'
          }`}
        >
          {position}
        </span>
      </div>

      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`text-sm sm:text-[15px] font-body font-medium truncate ${isTop3 ? 'text-foreground' : 'text-foreground/90'}`}>
          {name}
          {handicap != null && (
            <span className="ml-1.5 text-xs text-muted-foreground font-normal">
              ({Number(handicap).toFixed(1)})
            </span>
          )}
        </span>
      </div>

      <span className="hidden sm:inline text-xs text-muted-foreground/70 text-right font-mono">{rounds}</span>
      <span
        className={`text-base sm:text-lg text-right font-mono font-bold ${isTop3 ? 'text-accent' : 'text-foreground'}`}
      >
        {points.toLocaleString()}
      </span>
      <span className="hidden sm:inline text-xs text-muted-foreground/70 text-right font-mono">
        {rounds > 0 ? (points / rounds).toFixed(1) : '—'}
      </span>
    </button>
  );
}

export default Index;
