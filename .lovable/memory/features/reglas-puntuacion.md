---
name: Reglas de puntuación del Ranking Regularidad
description: Fórmula oficial del Ranking Regularidad del Circuito Albatros 2026
type: feature
---
Ranking Regularidad (reglamento oficial 2026):
- Se contabilizan las MEJORES 3 tarjetas de cada jugador.
- Se suman 5 puntos adicionales por cada torneo jugado (todas las jornadas publicadas en las que el jugador participó).
- NO se contabiliza la tarjeta del 1º clasificado de cada categoría en cada jornada (pasa directo a la final). Esa tarjeta queda excluida del cálculo de "mejores 3", pero la jornada sí cuenta para el bonus de +5.
- NO se aplica multiplicador MASTER en el ranking de regularidad.
- Total = suma de mejores 3 tarjetas (no excluidas) + (5 × jornadas jugadas).
- Categoría Scratch: usa stableford SCRATCH (sin handicap) calculado desde la scorecard con el par del campo. Mismas reglas (best 3 + bonus + exclusión del ganador).

Implementación: src/lib/seasonRankings.ts (función computeSeasonRankings).
