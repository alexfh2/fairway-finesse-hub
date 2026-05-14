import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedResult {
  position: number;
  name: string;
  license: string;
  gender: string;
  handicap: number | null;
  handicap_play: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  scores: number[];
  source_url: string;
  _is_senior?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, format } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const detectedSource = detectSource(url);
    let results: ParsedResult[];
    let categories: { id: string; name: string; count: number }[] | undefined;

    if (detectedSource === "golfdirecto") {
      const gd = await parseGolfDirecto(url, format);
      results = gd.results;
      categories = gd.categories;
    } else if (detectedSource === "teeone") {
      results = await parseTeeoneViaAPI(url, format);
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const html = await response.text();
      results = parseGenericTable(html, url);
    }

    return new Response(
      JSON.stringify({ success: true, source: detectedSource, results, count: results.length, categories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function detectSource(url: string): string {
  if (url.includes("golfdirecto.com")) return "golfdirecto";
  if (url.includes("teeone.golf") || url.includes("teeone.es")) return "teeone";
  return "generic";
}

// ─── GOLFDIRECTO ───────────────────────────────────────────────────────────────

interface GolfDirectoResult {
  results: ParsedResult[];
  categories: { id: string; name: string; count: number }[];
}

async function parseGolfDirecto(url: string, format?: string): Promise<GolfDirectoResult> {
  const gameMatch = url.match(/game\/([a-f0-9]{24})/);
  if (!gameMatch) {
    throw new Error("No s'ha pogut extreure l'ID del torneig de la URL de GolfDirecto");
  }
  const gameId = gameMatch[1];
  const categoryMatch = url.match(/category=([a-f0-9]{24})/);
  const requestedCategoryId = categoryMatch ? categoryMatch[1] : null;

  const gameRes = await fetch(
    `https://www.golfdirecto.com/web/home/game/${gameId}/active`,
    { headers: { Accept: "application/json" } }
  );
  if (!gameRes.ok) throw new Error(`Error obtenint info del torneig GolfDirecto: ${gameRes.status}`);
  const gameData = await gameRes.json();
  const game = gameData.data || gameData;

  const allCategories: { id: string; name: string; count: number }[] = (game.categories || []).map(
    (c: { _id: string; name: string; __playersCount: number }) => ({
      id: c._id,
      name: c.name || "Sense nom",
      count: c.__playersCount || 0,
    })
  );

  // Determine which category to fetch for results (SCRATCH by default)
  let categoryId = requestedCategoryId;
  if (!categoryId) {
    const scratch = allCategories.find((c) => c.name.toUpperCase().includes("SCRATCH"));
    categoryId = scratch?.id || allCategories[0]?.id;
  }

  if (!categoryId) {
    throw new Error("No s'han trobat categories al torneig de GolfDirecto");
  }

  // Find SENIOR and FEMENINA category IDs to detect membership
  const seniorCatId = allCategories.find((c) => c.name.toUpperCase().includes("SENIOR"))?.id;
  const femCatId = allCategories.find((c) => c.name.toUpperCase().includes("FEMEN"))?.id;

  // Fetch senior player licenses for cross-reference
  const seniorLicenses = new Set<string>();
  if (seniorCatId) {
    try {
      const seniorRes = await fetch(
        `https://www.golfdirecto.com/web/home/score/ranking/entry?game=${gameId}&category=${seniorCatId}`,
        { headers: { Accept: "application/json" } }
      );
      if (seniorRes.ok) {
        const seniorData = await seniorRes.json();
        for (const entry of (seniorData.data || [])) {
          const lic = entry.player?.license;
          if (lic) seniorLicenses.add(lic);
        }
      }
    } catch { /* ignore */ }
  }

  // Fetch ranking for selected category
  const rankRes = await fetch(
    `https://www.golfdirecto.com/web/home/score/ranking/entry?game=${gameId}&category=${categoryId}`,
    { headers: { Accept: "application/json" } }
  );
  if (!rankRes.ok) throw new Error(`Error obtenint ranking GolfDirecto: ${rankRes.status}`);
  const rankData = await rankRes.json();
  const entries = rankData.data || [];

  const selectedCat = allCategories.find((c) => c.id === categoryId);
  const isNet = selectedCat?.name?.toUpperCase().includes("SCRATCH") === false;

  interface EntryData {
    playerId: string;
    result: ParsedResult;
  }
  const entryDataList: EntryData[] = [];

  for (const entry of entries) {
    const player = entry.player || {};
    const view = entry.view || {};
    const dayView = view.day || view.acc || {};

    // Format: "APELLIDOS, NOMBRE" (federation standard) for consistent alphabetical sorting
    const surname = (player.surname || "").trim();
    const firstName = (player.firstName || "").trim();
    const name = surname && firstName
      ? `${surname}, ${firstName}`
      : (surname || firstName);
    if (!name || name.length < 2) continue;

    const positionValue = parseNumber(dayView.rankingPosition ?? dayView.realRanking);
    const hcpExact = parseNumber(player.hcpExact);
    const hcpGame = parseNumber(player.hcpGame);
    const stablefordPoints = parseNumber(dayView.onlyNet ?? (isNet ? dayView.result : null));
    const scratchScore = parseNumber(dayView.strokeNumber ?? dayView.onlyGross ?? (!isNet ? dayView.result : null));

    const license = player.license || "";
    const isSenior = seniorLicenses.has(license);

    entryDataList.push({
      playerId: player._id || "",
      result: {
        position: positionValue != null ? Math.trunc(positionValue) : 0,
        name,
        license,
        gender: player.gender === "F" ? "F" : player.gender === "M" ? "M" : "",
        handicap: hcpExact,
        handicap_play: hcpGame != null ? Math.trunc(hcpGame) : null,
        stableford_points: stablefordPoints,
        scratch_score: scratchScore,
        scores: [],
        source_url: url,
        _is_senior: isSenior,
      },
    });
  }

  // Fetch hole-by-hole scorecards in parallel (batches of 10)
  const batchSize = 10;
  for (let i = 0; i < entryDataList.length; i += batchSize) {
    const batch = entryDataList.slice(i, i + batchSize);
    const scorecardPromises = batch.map(async (ed) => {
      if (!ed.playerId) return;
      try {
        const cardRes = await fetch(
          `https://www.golfdirecto.com/web/home/score/player/${ed.playerId}/result?game=${gameId}`,
          { headers: { Accept: "application/json" } }
        );
        if (!cardRes.ok) return;
        const cardData = await cardRes.json();
        const data = cardData.data || cardData;
        const score = data.score || {};

        const holes: number[] = [];
        for (let h = 1; h <= 18; h++) {
          const val = score[`gross${h}`];
          if (val != null) holes.push(Number(val));
          else holes.push(0);
        }
        const hasData = holes.some((v) => v > 0);
        if (hasData) {
          ed.result.scores = holes;
          // If any hole is 0 (ball picked up), scratch is invalid
          const hasLiftedBall = holes.some((v) => v === 0);
          if (hasLiftedBall) {
            ed.result.scratch_score = null;
          }
        }
      } catch {
        // silently skip scorecard errors
      }
    });
    await Promise.all(scorecardPromises);
  }

  const results = entryDataList.map((ed) => ed.result);
  results.sort((a, b) => a.position - b.position);

  return { results, categories: allCategories };
}

// ─── TEEONE ────────────────────────────────────────────────────────────────────

async function parseTeeoneViaAPI(url: string, format?: string): Promise<ParsedResult[]> {
  const pageResponse = await fetch(url);
  if (!pageResponse.ok) throw new Error(`Failed to fetch Teeone page: ${pageResponse.status}`);
  const html = await pageResponse.text();

  const getHidden = (name: string): string => {
    const match = html.match(new RegExp(`${name}"\\s*value="([^"]*)"`));
    return match ? match[1] : "";
  };

  const apiDomain = getHidden("HidAPIDominio");
  const token = getHidden("HidTokenAPI");
  const idInicioSesion = getHidden("HidInicioSesion");
  const idVendedor = getHidden("HidVendedor");
  const codTorneo = getHidden("HidTorneo");
  const culture = getHidden("HidCultura") || "es-ES";

  if (!apiDomain || !token || !codTorneo) {
    throw new Error("No s'han pogut extreure els paràmetres de l'API de Teeone. Comprova la URL.");
  }

  const vueltasRes = await fetch(`${apiDomain}/api/LiveScoring/ObtenerVueltasLive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ culture, token, idInicioSesion, idVendedor, codTorneo }),
  });
  const vueltasData = await vueltasRes.json();
  const vueltas: number[] = vueltasData.cod === 1 ? vueltasData.listaVueltas : [1];
  const lastVuelta = vueltas[vueltas.length - 1] || 1;

  const isStableford = !format || format === "stableford";
  const idTipoClasificacion = isStableford ? "4" : "1";

  const classRes = await fetch(`${apiDomain}/api/LiveScoring/ObtenerPosicionesClasificacionLive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      culture, token, idInicioSesion, idVendedor, codTorneo,
      numVuelta: String(lastVuelta),
      idTipoClasificacion,
      codSexo: "T", hcpDesde: "-10", hcpHasta: "54",
      hcpDesempate: false, codNivel: "T",
    }),
  });

  const classData = await classRes.json();
  if (classData.cod !== 1 || !classData.listaPosiciones) {
    throw new Error(classData.msg || "Error obtenint classificació de Teeone");
  }

  const results: ParsedResult[] = [];
  for (const p of classData.listaPosiciones) {
    const pos = parseInt(p.pos) || p.posReal || 0;
    if (!p.nombre || p.nombre.trim().length < 2) continue;

    const scores: number[] = [];
    if (p.r1 && parseInt(p.r1) > 0) scores.push(parseInt(p.r1));
    if (p.r2 && parseInt(p.r2) > 0) scores.push(parseInt(p.r2));
    if (p.r3 && parseInt(p.r3) > 0) scores.push(parseInt(p.r3));
    if (p.r4 && parseInt(p.r4) > 0) scores.push(parseInt(p.r4));

    const total = parseInt(p.tot) || null;
    const handicap = p.hex ? parseFloat(String(p.hex).replace(",", ".")) : null;

    results.push({
      position: pos,
      name: p.nombre.trim(),
      license: p.licencia || "",
      gender: p.codSexo === "F" ? "F" : p.codSexo === "M" ? "M" : "",
      handicap: isNaN(handicap as number) ? null : handicap,
      handicap_play: null,
      stableford_points: isStableford ? total : null,
      scratch_score: !isStableford ? total : null,
      scores,
      source_url: url,
    });
  }

  return results;
}

// ─── GENERIC TABLE ─────────────────────────────────────────────────────────────

function parseGenericTable(html: string, sourceUrl: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let bestTable = "";
  let bestScore = 0;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(clean)) !== null) {
    const content = tableMatch[1].toLowerCase();
    let score = 0;
    if (content.includes("jugador") || content.includes("player") || content.includes("nombre")) score += 5;
    if (content.includes("stableford") || content.includes("puntos")) score += 3;
    if (content.includes("handicap") || content.includes("hcp")) score += 3;
    if (content.includes("pos")) score += 2;
    const rowCount = (content.match(/<tr/g) || []).length;
    score += Math.min(rowCount, 10);
    if (score > bestScore) { bestScore = score; bestTable = tableMatch[1]; }
  }

  if (!bestTable) return results;

  const headerMatch = bestTable.match(/<thead>([\s\S]*?)<\/thead>/i) ||
    bestTable.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!headerMatch) return results;

  const headers: string[] = [];
  const thRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  let th;
  while ((th = thRegex.exec(headerMatch[1])) !== null) {
    headers.push(stripHtml(th[1]).trim().toLowerCase());
  }

  const nameIdx = headers.findIndex(h =>
    h.includes("jugador") || h.includes("nombre") || h.includes("player") || h.includes("nom")
  );
  const ptsIdx = headers.findIndex(h =>
    h.includes("stableford") || h.includes("puntos") || h.includes("pts") || h.includes("points")
  );
  const hcpIdx = headers.findIndex(h =>
    h.includes("hcp") || h.includes("handicap") || h.includes("hex")
  );

  if (nameIdx < 0) return results;

  const allRows = bestTable.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  let posCounter = 0;

  for (let i = 1; i < allRows.length; i++) {
    const cells: string[] = [];
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cell;
    while ((cell = cellRegex.exec(allRows[i])) !== null) {
      cells.push(cell[1]);
    }
    if (cells.length < 2) continue;

    const name = stripHtml(cells[nameIdx]).trim();
    if (!name || name.length < 2) continue;

    posCounter++;
    const ptsText = ptsIdx >= 0 && ptsIdx < cells.length ? stripHtml(cells[ptsIdx]).trim() : "";
    const hcpText = hcpIdx >= 0 && hcpIdx < cells.length ? stripHtml(cells[hcpIdx]).trim() : "";

    results.push({
      position: posCounter,
      name,
      license: "",
      gender: "",
      handicap: hcpText ? parseFloat(hcpText.replace(",", ".")) : null,
      handicap_play: null,
      stableford_points: ptsText ? parseInt(ptsText) : null,
      scratch_score: null,
      scores: [],
      source_url: sourceUrl,
    });
  }

  return results;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}
