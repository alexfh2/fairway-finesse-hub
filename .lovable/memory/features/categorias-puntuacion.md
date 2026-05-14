---
name: Categorías del circuito
description: 4 categorías oficiales del Circuito Albatros 2026 (sin Senior)
type: feature
---
4 categorías oficiales según el reglamento:
- 1ª Categoría HCP (hcpInf): handicap ≤ 14.4
- 2ª Categoría HCP (hcpSup): handicap ≥ 14.5
- Damas (female): jugadoras con gender='F'
- Scratch: clasificación bruta (sin handicap) de TODOS los jugadores

NO existe categoría Senior en el ranking oficial. El atributo is_senior del jugador se mantiene como filtro/badge informativo en la lista de jugadores, pero no genera ranking.

HCP de categoría: se fija con el handicap_at_round de la primera ronda jugada cronológicamente (ver buildPlayerCategoryHandicapMap). El último HCP jugado se usa SOLO para visualización al lado del nombre.
