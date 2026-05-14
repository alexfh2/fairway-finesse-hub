import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: require admin role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;
    const { data: isAdmin } = await supabaseAuth.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { round_id, language, tone, sponsor, special_mention, weather_conditions } = await req.json();

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch round data
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", round_id)
      .single();
    if (roundError) throw roundError;

    // Fetch results with player info
    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select("*, players(*)")
      .eq("round_id", round_id)
      .order("stableford_points", { ascending: false });
    if (resultsError) throw resultsError;

    // Fetch season
    const { data: season } = await supabase
      .from("seasons")
      .select("year")
      .eq("id", round.season_id)
      .single();

    // Build context for AI — Stableford only (no scratch)
    const topStableford = results.slice(0, 5);
    
    // Categorize results
    const hcpLow = results.filter((r: any) => r.category === 'hcp_low' || (r.handicap_at_round !== null && r.handicap_at_round <= 14.4));
    const hcpHigh = results.filter((r: any) => r.category === 'hcp_high' || (r.handicap_at_round !== null && r.handicap_at_round > 14.4));
    const females = results.filter((r: any) => r.is_female_prize || r.players?.gender === 'F');
    const seniors = results.filter((r: any) => r.is_senior_prize || r.players?.is_senior === true);

    // Sort each category by stableford
    hcpLow.sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    hcpHigh.sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    females.sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    seniors.sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));

    // Check for notable scorecards
    const coursePar = round.course_par as number[] | null;
    let notablePerformances = '';
    if (coursePar && Array.isArray(coursePar)) {
      results.forEach((r: any) => {
        if (r.scorecard && Array.isArray(r.scorecard)) {
          const birdies = r.scorecard.filter((s: number, i: number) => s < coursePar[i]).length;
          if (birdies >= 3) {
            notablePerformances += `${r.players?.name}: ${birdies} birdies. `;
          }
        }
      });
    }

    const toneLabel = tone === 'press'
      ? 'nota de prensa deportiva, formal y profesional'
      : 'cercano y atractivo para redes sociales (WhatsApp/Instagram), con emojis y tono próximo';

    const prompt = `Genera una noticia deportiva de golf en castellano con tono de ${toneLabel}.
IMPORTANTE: La competición es en modalidad STABLEFORD. NO menciones resultados scratch ni golpes totales. Todos los resultados son en puntos Stableford.
El circuito es el "Circuito Albatros" — un circuito de golf con grandes premios.

TEXTO DE REFERENCIA DE ESTILO (adáptalo al golf y al Circuito Albatros):
---
Tras [X] intensas jornadas, la clasificación se está consolidando y ya se perfilan los jugadores que lucharán por el podio esta temporada.

Handicap Bajo: ¡la batalla de los mejores!
La competición no puede estar más ajustada. [Descripción del líder y perseguidores]

1. [Nombre] encabeza con [X] pts, mostrando una regularidad impresionante.
2. Muy cerca, [Nombre] con [X] pts.
3. La tercera posición es para [Nombre] con [X] pts.

TOP 10:
[Listado]

Handicap Alto: ¡los que mejor dominan el campo!
[Misma estructura]

Clasificación Femenina:
[Misma estructura con top 3]

Clasificación Senior (+65):
[Misma estructura con top 3]

[Si hay actuaciones destacadas: birdies, hole-in-ones, etc.]

Para más detalles y clasificaciones actualizadas, visite nuestra web.
---

DATOS DE LA JORNADA:
- Jornada: ${round.name} (J${round.round_number})
- Temporada: ${season?.year || 'N/A'}
- Club: ${round.club || 'N/A'}
- Campo: ${round.course || 'N/A'}
- Fecha: ${round.date}
- Patrocinador: ${sponsor || 'ninguno'}
${round.is_master ? '- JORNADA MASTER (puntos x1.25)' : ''}
${special_mention ? `- Mención especial: ${special_mention}` : ''}
${(() => {
  const w = weather_conditions || {};
  const lines: string[] = [];
  if (w.friday) lines.push(`  · Viernes: ${w.friday}`);
  if (w.saturday) lines.push(`  · Sábado: ${w.saturday}`);
  if (w.sunday) lines.push(`  · Domingo: ${w.sunday}`);
  if (w.green_speed) lines.push(`  · Velocidad de los greens: ${w.green_speed}`);
  if (w.wind) lines.push(`  · Viento: ${w.wind}`);
  return lines.length ? `- Condiciones meteorológicas y del campo:\n${lines.join('\n')}` : '';
})()}

CLASIFICACIÓN HANDICAP BAJO (≤14.4) — ${hcpLow.length} jugadores:
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join('\n')}

CLASIFICACIÓN HANDICAP ALTO (14.5–36.0) — ${hcpHigh.length} jugadores:
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join('\n')}

${females.length > 0 ? `CLASIFICACIÓN FEMENINA — ${females.length} jugadoras:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ''}
${seniors.length > 0 ? `CLASIFICACIÓN SENIOR (+65) — ${seniors.length} jugadores:\n1. ${seniors[0].players?.name} — ${seniors[0].stableford_points} pts (Hcp ${seniors[0].handicap_at_round})` : ''}
${notablePerformances ? `ACTUACIONES DESTACADAS: ${notablePerformances}` : ''}

Total participantes: ${results.length}

INSTRUCCIONES:
- ABSOLUTAMENTE NINGÚN EMOJI. Ni un solo emoji en todo el texto. Es una nota de prensa profesional para enviar a diarios y medios de comunicación.
- Tono formal, sobrio y periodístico. Sin exclamaciones excesivas.
- Sigue la estructura: introducción, después cada categoría con descripción + top 3 (Hcp Bajo y Alto) o ganador/a (Femenina y Senior)
- Para Handicap Bajo y Handicap Alto: incluye los 3 primeros clasificados con comentarios personalizados
- Para Femenina y Senior: menciona SOLO al ganador/a
- OBLIGATORIO: incluye SIEMPRE las 4 categorías si hay datos: Handicap Bajo, Handicap Alto, Femenina y Senior
- Separa cada sección/categoría con una línea en blanco para facilitar la lectura
- NO menciones resultados scratch ni golpes totales
- Si se han facilitado condiciones meteorológicas, velocidad de greens o viento, intégralas con naturalidad en la narración cuando sean relevantes (especialmente si han sido duras: lluvia, viento fuerte, greens muy rápidos, calor, etc.). Si son condiciones normales, puedes omitirlas o mencionarlas brevemente. No hagas una sección separada de meteorología.
- Genera un título atractivo
- Un subtítulo complementario
- Un cuerpo completo con la narración por categorías
- 3-5 highlights (frases cortas de destacados)
- Un extracto SEO de máximo 160 caracteres

Devuelve EXCLUSIVAMENTE un JSON válido con este formato:
{
  "title": "...",
  "subtitle": "...",
  "body": "...",
  "highlights": ["...", "..."],
  "seo_excerpt": "..."
}`;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un redactor deportivo especializado en golf. Responde SIEMPRE en castellano y con JSON válido, sin markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle potential markdown wrapping)
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const news = JSON.parse(cleaned);

    return new Response(JSON.stringify({ success: true, news }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
