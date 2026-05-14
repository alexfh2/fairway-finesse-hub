import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, ChevronDown, BarChart3, CalendarPlus, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ca, es } from 'date-fns/locale';
import { fetchPublicCircuitData, publicCircuitDataQueryKey } from '@/lib/publicCircuitData';
import { buildPlayerCategoryHandicapMap } from '@/lib/playerCategoryHandicap';
import { computeScratchStableford } from '@/lib/scratchStableford';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';

const Rounds = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ca' ? ca : es;
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState('hcpLow');

  const { data: rounds, isLoading } = useQuery({
    queryKey: ['public-rounds-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rounds')
        .select('*')
        .order('date', { ascending: true });
      return data || [];
    },
  });

  const today = new Date().toISOString().split('T')[0];

  const buildIcsContent = (round: any) => {
    const startDate = round.date.replace(/-/g, '');
    const endRaw = round.end_date || round.date;
    const endNext = new Date(endRaw);
    endNext.setDate(endNext.getDate() + 1);
    const endDate = endNext.toISOString().split('T')[0].replace(/-/g, '');
    const title = `${round.name} — Circuit Gastronòmic Golf`;
    const location = [round.club, round.course].filter(Boolean).join(' — ');
    const description = [round.sponsor ? `Patrocinador: ${round.sponsor}` : '', round.is_master ? 'Jornada MASTER (x1.25)' : ''].filter(Boolean).join('\\n');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Circuit Gastronomic Golf//CA',
      'BEGIN:VEVENT', `DTSTART;VALUE=DATE:${startDate}`, `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:${title}`, location ? `LOCATION:${location}` : '', description ? `DESCRIPTION:${description}` : '',
      `UID:${round.id}@gastronomicgolf`, 'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  };

  const downloadIcs = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllIcs = () => {
    if (!rounds?.length) return;
    const events = rounds.map(r => {
      const startDate = r.date.replace(/-/g, '');
      const endRaw = r.end_date || r.date;
      const endNext = new Date(endRaw);
      endNext.setDate(endNext.getDate() + 1);
      const endDate = endNext.toISOString().split('T')[0].replace(/-/g, '');
      const title = `${r.name} — Circuit Gastronòmic Golf`;
      const location = [r.club, r.course].filter(Boolean).join(' — ');
      const description = [r.sponsor ? `Patrocinador: ${r.sponsor}` : '', r.is_master ? 'Jornada MASTER (x1.25)' : ''].filter(Boolean).join('\\n');
      return [
        'BEGIN:VEVENT', `DTSTART;VALUE=DATE:${startDate}`, `DTEND;VALUE=DATE:${endDate}`,
        `SUMMARY:${title}`, location ? `LOCATION:${location}` : '', description ? `DESCRIPTION:${description}` : '',
        `UID:${r.id}@gastronomicgolf`, 'END:VEVENT',
      ].filter(Boolean).join('\r\n');
    }).join('\r\n');
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Circuit Gastronomic Golf//CA\r\n${events}\r\nEND:VCALENDAR`;
    downloadIcs(ics, 'circuit-gastronomic-golf-2026.ics');
  };

  const { data: roundData } = useQuery({
    queryKey: [...publicCircuitDataQueryKey, 'round-results', expandedRound],
    queryFn: async () => {
      if (!expandedRound) return { results: [], categoryHcpMap: new Map<string, number | null>() };
      const data = await fetchPublicCircuitData();
      const categoryHcpMap = buildPlayerCategoryHandicapMap(data.results as any);
      const results = data.results
        .filter((result) => result.round_id === expandedRound)
        .sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
      return { results, categoryHcpMap };
    },
    enabled: !!expandedRound,
  });

  const roundResults = roundData?.results;
  const categoryHcpMap = roundData?.categoryHcpMap ?? new Map<string, number | null>();

  const categorizeResults = (results: typeof roundResults) => {
    if (!results) return {};
    const hcpLow = results.filter(r => {
      const hcp = categoryHcpMap.get(r.player_id) ?? r.handicap_at_round ?? ((r as any).players_public)?.current_handicap;
      return hcp != null && hcp <= 15.0;
    }).sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const hcpHigh = results.filter(r => {
      const hcp = categoryHcpMap.get(r.player_id) ?? r.handicap_at_round ?? ((r as any).players_public)?.current_handicap;
      return hcp != null && hcp > 15.0;
    }).sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const female = results.filter(r => ((r as any).players_public)?.gender === 'F')
      .sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const senior = results.filter(r => ((r as any).players_public)?.is_senior)
      .sort((a, b) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    // Scratch: ranking por Stableford bruto (sin handicap), todos los jugadores.
    const scratch = results
      .map(r => ({ ...r, _scratchPts: computeScratchStableford(r.scorecard, (r as any).rounds?.course_par) }))
      .filter(r => r._scratchPts != null)
      .sort((a, b) => (b._scratchPts ?? 0) - (a._scratchPts ?? 0));
    return { hcpLow, hcpHigh, female, senior, scratch };
  };

  const categorized = categorizeResults(roundResults);

  const roundCategories = [
    { key: 'hcpLow', label: 'HCP Baix (≤15)' },
    { key: 'hcpHigh', label: 'HCP Alt (>15)' },
    { key: 'female', label: t('categories.female') },
    { key: 'senior', label: t('categories.senior') },
    { key: 'scratch', label: 'Scratch' },
  ];

  const renderResultsTable = (results: any[], scoreField: 'stableford' | 'scratch' = 'stableford') => {
    if (!results?.length) return <p className="text-muted-foreground text-sm py-4 text-center">{t('common.noData')}</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-[10px] text-muted-foreground/70 font-body font-medium tracking-[0.15em] uppercase">
              <th className="text-left py-3 pr-2 w-12 border-b border-border/30">Pos.</th>
              <th className="text-left py-3 border-b border-border/30">{t('common.name')} <span className="font-normal text-muted-foreground/50">(hcp)</span></th>
              <th className="text-right py-3 border-b border-border/30">{scoreField === 'scratch' ? 'Scratch' : 'Stableford'}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r: any, i: number) => {
              const position = i + 1;
              const isTop3 = position <= 3;
              const accentAlpha = position === 1 ? 0.18 : position === 2 ? 0.11 : position === 3 ? 0.06 : 0;
              const value = scoreField === 'scratch'
                ? (r._scratchPts ?? computeScratchStableford(r.scorecard, r.rounds?.course_par))
                : r.stableford_points;
              return (
                <tr
                  key={r.id}
                  className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors"
                  style={
                    isTop3
                      ? {
                          background: `linear-gradient(90deg, hsl(var(--accent) / ${accentAlpha}) 0%, hsl(var(--accent) / ${accentAlpha * 0.4}) 30%, transparent 70%)`,
                        }
                      : undefined
                  }
                >
                  <td className={`py-3.5 pr-2 text-sm font-body font-semibold ${isTop3 ? 'text-accent' : 'text-muted-foreground'}`}>{position}</td>
                  <td className="py-3.5">
                    <button type="button" onClick={() => setSelectedPlayerId(r.player_id)} className="flex items-center gap-2 hover:text-accent transition-colors text-left">
                      <div className="h-6 w-6 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                        <Users className="h-3 w-3 text-muted-foreground/60" />
                      </div>
                      <span className="text-sm font-body font-medium text-foreground">{((r as any).players_public)?.name}</span>
                      {r.handicap_at_round != null && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono">({Number(r.handicap_at_round).toFixed(1)})</span>
                      )}
                    </button>
                  </td>
                  <td className={`py-3.5 text-right font-mono font-bold text-sm ${isTop3 ? 'text-accent' : 'text-foreground'}`}>{value ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <section className="container pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-accent/70" strokeWidth={1.5} />
            <h1 className="font-display text-2xl font-semibold text-foreground">{t('rounds.title')}</h1>
          </div>
          <button
            onClick={downloadAllIcs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-body font-medium tracking-[0.1em] uppercase border border-border/50 bg-card/30 text-muted-foreground hover:border-accent/20 hover:text-foreground transition-all"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Afegir totes
          </button>
        </div>
        <p className="text-[11px] font-body text-muted-foreground tracking-wide mb-6">
          {t('rounds.calendar')} — {t('common.season')} 2026
        </p>
      </section>

      <section className="container pb-14">
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">{t('common.loading')}</p>
        ) : !rounds?.length ? (
          <p className="text-muted-foreground text-sm py-8 text-center">{t('common.noData')}</p>
        ) : (
          <div className="space-y-2">
            {rounds.map((round) => {
              const played = round.date < today || (round.end_date && round.end_date < today);
              const hasResults = round.status === 'published';
              const isExpanded = expandedRound === round.id;

              return (
                <div key={round.id} className={`border transition-all ${played ? 'border-accent/20 bg-accent/[0.03]' : 'border-border/50 bg-card/30'}`}>
                  <button
                    onClick={() => hasResults ? setExpandedRound(isExpanded ? null : round.id) : null}
                    className={`w-full text-left px-5 py-4 ${!hasResults ? 'cursor-default' : 'hover:bg-muted/10'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-mono text-[10px] tracking-wider ${played ? 'text-accent/60' : 'text-muted-foreground/40'}`}>J{round.round_number}</span>
                          <span className={`font-display text-base font-semibold ${played ? 'text-foreground' : 'text-muted-foreground/50'}`}>{round.name}</span>
                          {round.is_master && (
                            <span className="text-[9px] px-2 py-0.5 border border-accent/30 text-accent/80 font-body font-medium tracking-[0.15em] uppercase">MASTER</span>
                          )}
                          {played ? (
                            <span className="text-[9px] px-2 py-0.5 border border-accent/20 text-accent/60 font-body font-medium tracking-[0.1em] uppercase">Jugada</span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 border border-border/40 text-muted-foreground/40 font-body font-medium tracking-[0.1em] uppercase">Pendent</span>
                          )}
                          {round.sponsor && (
                            <span className={`text-[11px] font-body ${played ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}`}>· {round.sponsor}</span>
                          )}
                        </div>
                        <div className={`flex items-center gap-4 text-[11px] font-body ${played ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(round.date), 'dd MMM yyyy', { locale })}
                            {round.end_date && round.end_date !== round.date && (
                              <> — {format(new Date(round.end_date), 'dd MMM yyyy', { locale })}</>
                            )}
                          </span>
                          {round.course && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {round.course}
                            </span>
                          )}
                        </div>
                        {hasResults && (
                          <span className="text-[10px] text-accent/70 font-body font-medium flex items-center gap-1 tracking-wide uppercase">
                            <BarChart3 className="h-3 w-3" />
                            Veure resultats
                          </span>
                        )}
                        {!hasResults && played && (
                          <span className="text-[10px] text-muted-foreground/50 font-body italic">Pendent de resultats</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!played && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadIcs(buildIcsContent(round), `${round.name.replace(/\s+/g, '-').toLowerCase()}.ics`);
                            }}
                            className="p-1.5 hover:bg-muted/30 transition-colors"
                            title="Afegir al calendari"
                          >
                            <CalendarPlus className="h-4 w-4 text-muted-foreground/50 hover:text-accent transition-colors" />
                          </button>
                        )}
                        {hasResults && (
                          <ChevronDown className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/30 px-5 py-4">
                      <div className="flex items-center gap-2 mb-3 text-[11px] font-body text-muted-foreground tracking-wide">
                        <Users className="h-3.5 w-3.5" />
                        <span>{roundResults?.length || 0} participants</span>
                      </div>

                      {roundResults && roundResults.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {roundCategories.map((cat) => (
                              <button
                                key={cat.key}
                                onClick={() => setActiveResultTab(cat.key)}
                                className={`px-4 py-2 text-[11px] font-body font-medium tracking-[0.15em] uppercase transition-all duration-300 border ${
                                  activeResultTab === cat.key
                                    ? 'border-accent/40 bg-accent/10 text-accent'
                                    : 'border-border/50 bg-card/30 text-muted-foreground hover:border-accent/20 hover:text-foreground'
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                          {renderResultsTable((categorized as any)[activeResultTab], activeResultTab === 'scratch' ? 'scratch' : 'stableford')}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <PlayerProfileDialog playerId={selectedPlayerId} open={!!selectedPlayerId} onOpenChange={(o) => !o && setSelectedPlayerId(null)} />
    </div>
  );
};

export default Rounds;
