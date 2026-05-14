import React from 'react';

const DEFAULT_PAR = [4, 4, 5, 3, 5, 3, 4, 4, 4, 4, 5, 3, 4, 5, 4, 4, 3, 5];

interface ScorecardVisualProps {
  scores: number[];
  par?: number[];
  handicap?: number[];
  /** Optional female-specific stroke index distribution; used when playerGender === 'F' */
  handicapWomen?: number[];
  playerHandicap?: number | null;
  playerGender?: string | null;
}

const calcPlayingHcp = (hcp: number): number => Math.round(hcp);

const calcExtraStrokes = (strokeIndex: number, playerHcp: number): number => {
  const playingHcp = calcPlayingHcp(playerHcp);
  const fullStrokes = Math.floor(playingHcp / 18);
  const remainder = playingHcp % 18;
  return fullStrokes + (strokeIndex <= remainder ? 1 : 0);
};

const calcStablefordPoints = (
  gross: number,
  holePar: number,
  strokeIndex: number,
  playerHcp: number
): number | null => {
  if (gross == null || gross === 0) return null;
  const extra = calcExtraStrokes(strokeIndex, playerHcp);
  const net = gross - extra;
  const diff = net - holePar;
  if (diff <= -3) return 5;
  if (diff === -2) return 4;
  if (diff === -1) return 3;
  if (diff === 0) return 2;
  if (diff === 1) return 1;
  return 0;
};

/** Color scale for Stableford points - bright & prominent for dark bg */
const getStbStyle = (pts: number | null): string => {
  if (pts == null) return 'text-muted-foreground';
  if (pts >= 5) return 'bg-[hsl(140_70%_55%)] text-[hsl(150_50%_10%)] font-bold ring-2 ring-[hsl(140_70%_65%)]/60 shadow-lg';
  if (pts === 4) return 'bg-[hsl(140_55%_70%)] text-[hsl(150_50%_12%)] font-bold ring-1 ring-[hsl(140_55%_75%)]/50 shadow-md';
  if (pts === 3) return 'bg-accent/80 text-accent-foreground font-bold shadow-sm';
  if (pts === 2) return 'text-accent font-bold border border-accent/50';
  if (pts === 1) return 'bg-cream/40 text-cream font-semibold';
  return 'bg-destructive/30 text-destructive-foreground font-semibold';
};

const ScorecardVisual: React.FC<ScorecardVisualProps> = ({ scores, par = DEFAULT_PAR, handicap, handicapWomen, playerHandicap, playerGender }) => {
  // Pick female-specific stroke index distribution when applicable
  const effectiveHandicap = (playerGender === 'F' && Array.isArray(handicapWomen) && handicapWomen.length === 18)
    ? handicapWomen
    : handicap;

  const front9 = scores.slice(0, 9);
  const back9 = scores.slice(9, 18);
  const frontPar = par.slice(0, 9);
  const backPar = par.slice(9, 18);
  const frontHcp = effectiveHandicap?.slice(0, 9);
  const backHcp = effectiveHandicap?.slice(9, 18);

  const canCalcStableford = playerHandicap != null && effectiveHandicap && effectiveHandicap.length === 18;
  const playingHcp = playerHandicap != null ? calcPlayingHcp(playerHandicap) : null;

  const stablefordPoints = canCalcStableford
    ? scores.map((s, i) => calcStablefordPoints(s, par[i], effectiveHandicap![i], playerHandicap!))
    : null;

  const frontStb = stablefordPoints?.slice(0, 9);
  const backStb = stablefordPoints?.slice(9, 18);

  const sumScores = (arr: number[]) => {
    const valid = arr.filter(s => s > 0);
    return valid.length === arr.length ? valid.reduce((a, b) => a + b, 0) : null;
  };

  const frontTotal = sumScores(front9);
  const backTotal = sumScores(back9);
  const hasLiftedBall = scores.some(s => s === 0);

  const sumStb = (arr: (number | null)[] | undefined) =>
    arr ? arr.reduce((s: number, v) => s + (v ?? 0), 0) : null;

  const getStrokeMarker = (holeIdx: number): number => {
    if (!canCalcStableford || !effectiveHandicap) return 0;
    return calcExtraStrokes(effectiveHandicap[holeIdx], playerHandicap!);
  };

  const renderScore = (score: number, holePar: number) => {
    if (score == null || score === 0) return <span className="text-muted-foreground/60 font-semibold">—</span>;

    const diff = score - holePar;

    if (diff <= -2) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-cream/60 text-cream/80 font-semibold text-xs">
          <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full border border-cream/60">
            {score}
          </span>
        </span>
      );
    }

    if (diff === -1) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-cream/60 text-cream/80 font-semibold text-xs">
          {score}
        </span>
      );
    }

    if (diff === 0) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 border-2 border-muted-foreground/40 text-muted-foreground font-medium text-xs">
          {score}
        </span>
      );
    }

    if (diff === 1) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 bg-muted/30 border border-border/40 text-muted-foreground font-medium text-xs">
          {score}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center justify-center w-8 h-8 bg-destructive/15 border border-destructive/30 text-destructive/80 font-semibold text-xs">
        {score}
      </span>
    );
  };

  const renderStrokeDots = (extraStrokes: number) => {
    if (extraStrokes === 0) return null;
    return (
      <div className="absolute top-0.5 right-0.5 flex gap-[2px]">
        {Array.from({ length: Math.min(extraStrokes, 3) }).map((_, i) => (
          <span
            key={i}
            className="w-[4px] h-[4px] rounded-full bg-accent inline-block"
          />
        ))}
      </div>
    );
  };

  const headerCellClass = "text-center py-1.5 px-1 font-mono text-[10px] bg-[hsl(var(--primary)/0.08)] text-muted-foreground/70 border border-border/30";
  const headerLabelClass = "py-1.5 px-2 font-medium text-[10px] bg-[hsl(var(--primary)/0.08)] text-muted-foreground/70 border border-border/30 w-14";
  const holeCellClass = "text-center py-2 px-1 font-mono text-sm font-bold bg-[hsl(var(--primary)/0.08)] text-foreground border border-border/30";
  const holeLabelClass = "py-2 px-2 font-semibold text-sm bg-[hsl(var(--primary)/0.08)] text-foreground border border-border/30 w-14";
  const resultCellClass = "text-center py-2.5 px-1 border border-border/20";
  const resultLabelClass = "py-2.5 px-2 font-medium text-xs border border-border/20 w-14";
  const totalCellClass = "text-center py-2 px-1 font-mono font-bold border border-border/30 w-12";
  const strokeDotCellClass = "text-center py-0.5 px-1 bg-[hsl(var(--primary)/0.08)] border-x border-border/30 h-3";
  const strokeDotLabelClass = "py-0.5 px-2 bg-[hsl(var(--primary)/0.08)] border-x border-border/30 w-14 h-3";

  const renderHalf = (
    halfScores: number[],
    halfPar: number[],
    startHole: number,
    total: number | null,
    halfHcp?: number[],
    halfStb?: (number | null)[],
    holeOffset = 0
  ) => (
    <table className="text-xs w-full border-collapse">
      <thead>
        <tr>
          <td className={holeLabelClass}>Forat</td>
          {halfScores.map((_, i) => (
              <td key={i} className={holeCellClass}>
                {startHole + i}
              </td>
          ))}
          <td className={`${holeCellClass} ${totalCellClass} bg-[hsl(var(--primary)/0.12)]`}>Tot</td>
        </tr>
        {canCalcStableford && (
          <tr>
            <td className={strokeDotLabelClass}></td>
            {halfScores.map((_, i) => {
              const strokes = getStrokeMarker(holeOffset + i);
              return (
                <td key={i} className={strokeDotCellClass}>
                  {strokes > 0 && (
                    <div className="flex justify-center gap-[3px]">
                      {Array.from({ length: Math.min(strokes, 3) }).map((_, j) => (
                        <span key={j} className="w-[6px] h-[6px] rounded-full bg-accent inline-block" />
                      ))}
                    </div>
                  )}
                </td>
              );
            })}
            <td className={strokeDotCellClass}></td>
          </tr>
        )}
        <tr>
          <td className={headerLabelClass}>Par</td>
          {halfPar.map((p, i) => (
            <td key={i} className={headerCellClass}>{p}</td>
          ))}
          <td className={`${headerCellClass} ${totalCellClass} bg-[hsl(var(--primary)/0.12)]`}>{halfPar.reduce((a, b) => a + b, 0)}</td>
        </tr>
        {halfHcp && (
          <tr>
            <td className={headerLabelClass}>HCP</td>
            {halfHcp.map((h, i) => (
              <td key={i} className={headerCellClass}>{h}</td>
            ))}
            <td className={`${headerCellClass} ${totalCellClass} bg-[hsl(var(--primary)/0.12)]`}></td>
          </tr>
        )}
      </thead>
      <tbody>
        <tr>
          <td className={`${resultLabelClass} font-semibold text-foreground`}>Cops</td>
          {halfScores.map((s, i) => (
            <td key={i} className={`${resultCellClass} bg-background`}>
              <div className="flex items-center justify-center h-[2.5rem]">
                {renderScore(s, halfPar[i])}
              </div>
            </td>
          ))}
          <td className={`${resultCellClass} ${totalCellClass} bg-muted/30 text-sm`}>
            {total != null ? total : '—'}
          </td>
        </tr>
        {halfStb && (
          <tr>
            <td className={`${resultLabelClass} font-bold text-accent uppercase tracking-wider bg-secondary/30`}>Stb</td>
            {halfStb.map((pts, i) => (
              <td key={i} className={`${resultCellClass} bg-secondary/20`}>
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-sm ${getStbStyle(pts)}`}>
                  {pts != null ? pts : '—'}
                </span>
              </td>
            ))}
            <td className={`${resultCellClass} ${totalCellClass} text-accent-foreground bg-accent text-base font-bold`}>
              {sumStb(halfStb)}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const totalStb = stablefordPoints ? stablefordPoints.reduce((s, v) => s + (v ?? 0), 0) : null;
  const totalStrokes = frontTotal != null && backTotal != null ? frontTotal + backTotal : null;
  const totalPar = par.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {renderHalf(front9, frontPar, 1, frontTotal, frontHcp, frontStb ?? undefined, 0)}
      {renderHalf(back9, backPar, 10, backTotal, backHcp, backStb ?? undefined, 9)}

      {/* Totales 18 hoyos dentro de la tarjeta */}
      <div className="grid grid-cols-3 gap-2 border-2 border-accent/40 rounded-lg bg-secondary/30 p-3">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">PAR CAMP</div>
          <div className="font-mono font-bold text-base text-foreground mt-1">{totalPar}</div>
        </div>
        <div className="text-center border-x border-border/40">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total cops</div>
          <div className="font-mono font-bold text-base text-cream mt-1">
            {totalStrokes != null ? totalStrokes : '—'}
            {hasLiftedBall && <span className="text-[9px] text-muted-foreground ml-1">(incomplet)</span>}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">Total Stb</div>
          <div className="font-mono font-bold text-lg text-accent mt-1">{totalStb ?? '—'}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <span className="sr-only">
          Total: {totalStrokes ?? '—'}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground ml-auto flex-wrap">
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-4 rounded-full border-2 border-primary inline-block" /> Birdie
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-4 border-2 border-foreground/60 inline-block" /> Par
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-4 bg-muted border border-border inline-block" /> Bogey
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-4 bg-destructive/15 border border-destructive/30 inline-block" /> Doble+
          </span>
          {canCalcStableford && (
            <span className="inline-flex items-center gap-1">
              <span className="flex gap-[2px]">
                <span className="w-[5px] h-[5px] rounded-full bg-accent inline-block" />
                <span className="w-[5px] h-[5px] rounded-full bg-accent inline-block" />
              </span>
              Punts HCP
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScorecardVisual;
