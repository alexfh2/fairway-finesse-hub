import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';
import { computeSeasonRankings, BEST_N_ROUNDS, BONUS_PER_ROUND } from '@/lib/seasonRankings';
import { Trophy, ChevronRight, Users, ChevronDown, User } from 'lucide-react';

const Rankings = () => {
  const { t } = useTranslation();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('hcpLow');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: publicCircuitDataQueryKey,
    queryFn: fetchPublicCircuitData,
    select: (data) => data.results,
  });

  const { data: rounds } = useQuery({
    queryKey: ['public-published-rounds'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rounds')
        .select('id, name, round_number')
        .eq('status', 'published')
        .order('round_number');
      return data || [];
    },
  });

  const publishedRoundIds = useMemo(
    () => new Set((rounds || []).map((r) => r.id)),
    [rounds],
  );

  const seasonRankings = useMemo(
    () => computeSeasonRankings(results || [], publishedRoundIds),
    [results, publishedRoundIds],
  );

  const rankings = useMemo(
    () => ({
      hcpLow: seasonRankings.hcpInf,
      hcpHigh: seasonRankings.hcpSup,
      female: seasonRankings.female,
      scratch: seasonRankings.scratch,
    }),
    [seasonRankings],
  );

  const categories = [
    { key: 'hcpLow', label: '1ª Categoría (≤14.4)' },
    { key: 'hcpHigh', label: '2ª Categoría (≥14.5)' },
    { key: 'female', label: 'Damas' },
    { key: 'scratch', label: 'Scratch' },
  ];

  const renderTable = (players: any[] | undefined) => {
    if (!players?.length) return <p className="text-muted-foreground text-sm py-8 text-center">{t('common.noData')}</p>;

    const hasManyRounds = (rounds?.length || 0) > 3;

    // Solid background per row. Top 3 use a fixed accent tint (no gradient) so sticky
    // columns and middle cells share the same color. Card base color is fully opaque
    // to prevent scrolled round numbers bleeding through sticky name/pos/total cells.
    const cardSolid = 'hsl(var(--card))';
    const top3Bg = (pos: number) => {
      if (pos === 1) return `color-mix(in srgb, hsl(var(--accent)) 14%, hsl(var(--card)))`;
      if (pos === 2) return `color-mix(in srgb, hsl(var(--accent)) 9%, hsl(var(--card)))`;
      if (pos === 3) return `color-mix(in srgb, hsl(var(--accent)) 5%, hsl(var(--card)))`;
      return cardSolid;
    };

    return (
      <>
        {/* ---------- MOBILE VIEW: lista compacta expandible ---------- */}
        <div className="sm:hidden">
          <ul className="divide-y divide-border/20">
            {players.map((p: any, i: number) => {
              const position = i + 1;
              const isTop3 = position <= 3;
              const rowBg = top3Bg(position);
              const isExpanded = expandedPlayerId === p.id;

              return (
                <li key={p.id} style={{ background: rowBg }}>
                  <button
                    type="button"
                    onClick={() => setExpandedPlayerId(isExpanded ? null : p.id)}
                    className="w-full flex items-center gap-2 py-3 px-2 text-left"
                    aria-expanded={isExpanded}
                  >
                    <span
                      className={`w-5 text-[12px] font-body font-semibold tabular-nums ${isTop3 ? 'text-accent' : 'text-muted-foreground'}`}
                    >
                      {position}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-body font-medium text-foreground leading-tight truncate">
                        {p.name}
                        {p.displayHandicap != null && (
                          <span className="ml-1 text-[10px] text-muted-foreground/60 font-mono">
                            ({Number(p.displayHandicap).toFixed(1)})
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`font-mono font-bold text-[13px] tabular-nums ${isTop3 ? 'text-accent' : 'text-foreground'}`}
                    >
                      {p.total}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-2 pb-3 pt-1 animate-fade-in">
                      <div className="grid grid-cols-5 gap-1.5 mb-3">
                        {rounds?.map((r) => {
                          const score = p.roundScores.get(r.id);
                          const val = score?.weighted ?? score?.points;
                          return (
                            <div
                              key={r.id}
                              className="flex flex-col items-center justify-center py-1.5 px-1 border border-border/30 bg-card/40"
                            >
                              <span className="text-[8.5px] font-body font-medium tracking-[0.1em] uppercase text-muted-foreground/60">
                                J{r.round_number}
                              </span>
                              <span className="font-mono text-[11px] text-foreground tabular-nums">
                                {val != null ? val : <span className="text-muted-foreground/30">—</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlayerId(p.id);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-body font-medium tracking-[0.2em] uppercase text-accent border border-accent/30 hover:bg-accent/10 transition-colors"
                      >
                        <User className="h-3 w-3" strokeWidth={1.5} />
                        Ver perfil del jugador
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---------- DESKTOP / TABLET VIEW: tabla completa ---------- */}
        <div className="hidden sm:block relative">
          <div className="overflow-x-auto scroll-smooth -mx-2 px-2 [scrollbar-width:thin]">
            <table className="w-full text-sm border-separate border-spacing-0 min-w-[420px]">
              <thead>
                <tr className="text-[10px] text-muted-foreground/70 font-body font-medium tracking-[0.15em] uppercase">
                  <th className="text-left py-3 pr-1.5 w-8 border-b border-border/30 sticky left-0 z-[6]" style={{ background: cardSolid }}>Pos.</th>
                  <th className="text-left py-3 pr-2 border-b border-border/30 sticky left-8 z-[6]" style={{ background: cardSolid }}>
                    {t('common.name')} <span className="font-normal text-muted-foreground/50">(hcp)</span>
                  </th>
                  {rounds?.map((r) => (
                    <th key={r.id} className="text-right py-3 px-2 whitespace-nowrap border-b border-border/30 font-mono text-[10px]" style={{ background: cardSolid }}>
                      J{r.round_number}
                    </th>
                  ))}
                  <th className="text-right py-3 pl-3 pr-2 border-b border-border/30 border-l border-border/30 sticky right-0 z-[7] text-[10px]" style={{ background: cardSolid, boxShadow: '-4px 0 6px -4px hsl(var(--background) / 0.6)' }}>{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p: any, i: number) => {
                  const position = i + 1;
                  const isTop3 = position <= 3;
                  const rowBg = top3Bg(position);

                  return (
                    <tr key={p.id} className="border-b border-border/20 last:border-0 group">
                      <td
                        className={`py-3 pr-1.5 text-sm font-body font-semibold sticky left-0 z-[4] ${isTop3 ? 'text-accent' : 'text-muted-foreground'}`}
                        style={{ background: rowBg }}
                      >
                        {position}
                      </td>
                      <td className="py-3 pr-2 sticky left-8 z-[4]" style={{ background: rowBg }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayerId(p.id)}
                          className="flex items-center gap-2 hover:text-accent transition-colors text-left"
                        >
                          <div className="h-5 w-5 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                            <Users className="h-2.5 w-2.5 text-muted-foreground/60" />
                          </div>
                          <span className="text-[13px] font-body font-medium text-foreground leading-tight whitespace-nowrap">
                            {p.name}
                            {p.displayHandicap != null && (
                              <span className="ml-1 text-[10px] text-muted-foreground/60 font-mono">
                                ({Number(p.displayHandicap).toFixed(1)})
                              </span>
                            )}
                          </span>
                        </button>
                      </td>
                      {rounds?.map((r) => {
                        const score = p.roundScores.get(r.id);
                        const val = score?.weighted ?? score?.points;
                        return (
                          <td
                            key={r.id}
                            className="py-3 px-2 text-right font-mono text-xs"
                            style={{ background: rowBg }}
                          >
                            {val != null ? val : <span className="text-muted-foreground/30">—</span>}
                          </td>
                        );
                      })}
                      <td
                        className={`py-3 pl-3 pr-2 text-right font-mono font-bold text-sm border-l border-border/30 sticky right-0 z-[5] ${isTop3 ? 'text-accent' : 'text-foreground'}`}
                        style={{ background: rowBg, boxShadow: '-4px 0 6px -4px hsl(var(--background) / 0.6)' }}
                      >
                        {p.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Header section matching Index style */}
      <section className="container pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <Trophy className="h-5 w-5 text-accent/70" strokeWidth={1.5} />
          <h1 className="font-display text-2xl font-semibold text-foreground">{t('rankings.title')}</h1>
        </div>
        <div className="flex items-center gap-2 mb-6">
          <p className="text-[11px] font-body text-muted-foreground tracking-wide">
            {t('rankings.generalClassification')} — {t('common.season')} 2026
          </p>
          <span className="inline-block text-[9px] px-2 py-0.5 border border-accent/30 text-accent/80 font-body font-medium tracking-[0.15em] uppercase">
            Mejores {bestN} jornadas
          </span>
        </div>

        {/* Category tabs matching Index editorial style */}
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px flex-1 bg-border/60" />
          <span className="font-body text-[10px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
            Categorías
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`px-4 py-2 text-[11px] font-body font-medium tracking-[0.15em] uppercase transition-all duration-300 border ${
                activeTab === cat.key
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-border/50 bg-card/30 text-muted-foreground hover:border-accent/20 hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Table section */}
      <section className="container pb-14">
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">{t('common.loading')}</p>
        ) : (
          <div className="border border-border/50 bg-card/30">
            <div className="flex items-center justify-between px-7 py-5 border-b border-border/40">
              <h3 className="font-body text-[11px] font-medium tracking-[0.25em] uppercase text-foreground">
                {categories.find(c => c.key === activeTab)?.label}
              </h3>
            </div>
            <div className="px-3 sm:px-7 py-2">
              {renderTable((rankings as any)[activeTab])}
            </div>
          </div>
        )}
      </section>

      <PlayerProfileDialog
        playerId={selectedPlayerId}
        open={!!selectedPlayerId}
        onOpenChange={(o) => !o && setSelectedPlayerId(null)}
      />
    </div>
  );
};

export default Rankings;