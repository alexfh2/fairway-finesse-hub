---
name: Excel Import
description: Header-based Excel parser that dynamically maps columns by name aliases instead of fixed positions
type: feature
---
The Excel parser (`src/lib/parseExcelResults.ts`) uses **dynamic header detection**:
- Scans first 5 rows to find the header row (≥3 recognized column names)
- Maps columns by normalized name aliases (case/accent insensitive)
- Supported aliases: Pos, Nombre/Nom, Licencia/Llicència, Hex, NVH, Edad/Edat, Sex, Cat, Hpu, Total/Net/Stableford, Brt/Bruto/Gross/Totalx
- Hole columns detected by numeric headers 1-18
- Ignores non-mapped columns (e.g. Equipo/Team)
- Each Excel source may have different column layouts; the parser adapts automatically
