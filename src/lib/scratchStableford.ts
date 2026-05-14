/**
 * Calcula los puntos Stableford SCRATCH (sin handicap) de una tarjeta.
 * Fórmula: por hoyo, max(0, 2 - (golpes - par)). Hoyos sin golpes (0/null) se omiten.
 * Si los golpes son 0/null (bola levantada) → no suma.
 */
export function computeScratchStableford(scorecard: any, coursePar: any): number | null {
  const scores: (number | null)[] | null = Array.isArray(scorecard)
    ? scorecard
    : Array.isArray(scorecard?.scores)
    ? scorecard.scores
    : null;
  const pars: number[] | null = Array.isArray(coursePar) ? coursePar : null;
  if (!scores || !pars || scores.length !== pars.length) return null;
  let total = 0;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (s == null || s === 0) continue;
    total += Math.max(0, 2 - (s - pars[i]));
  }
  return total;
}
