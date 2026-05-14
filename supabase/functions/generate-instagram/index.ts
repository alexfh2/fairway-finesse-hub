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

    const { round_id, language, weather_conditions } = await req.json();

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("*")
      .eq("id", round_id)
      .single();
    if (roundError) throw roundError;

    const { data: results, error: resultsError } = await supabase
      .from("results")
      .select("*, players(*)")
      .eq("round_id", round_id)
      .order("stableford_points", { ascending: false });
    if (resultsError) throw resultsError;

    const { data: season } = await supabase
      .from("seasons")
      .select("year")
      .eq("id", round.season_id)
      .single();

    // Categorize results
    const hcpLow = results
      .filter((r: any) => r.handicap_at_round !== null && r.handicap_at_round <= 14.4)
      .sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const hcpHigh = results
      .filter((r: any) => r.handicap_at_round !== null && r.handicap_at_round > 14.4)
      .sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const females = results
      .filter((r: any) => r.is_female_prize || r.players?.gender === 'F')
      .sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const seniors = results
      .filter((r: any) => r.is_senior_prize || r.players?.is_senior === true)
      .sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));

    // Notable performances (birdies)
    const coursePar = round.course_par as number[] | null;
    let notablePerformances = "";
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

    const prompt = `Genera un post de Instagram en castellano para compartir los RESULTADOS de una jornada de golf del Circuito Albatros.

ESTRUCTURA DE REFERENCIA (adáptala para RESULTADOS, no para convocatoria):
🏌️‍♂️✨ CIRCUITO ALBATROS ✨🏌️‍♀️
[Emoji + Nombre del torneo/jornada]
📍 [Campo]
📅 [Fecha]

[1-2 frases resumen atractivas sobre cómo fue la jornada]

🏆 RESULTADOS

🏌️ *Handicap Bajo*
🥇 [Nombre] — [Puntos] pts
🥈 [Nombre] — [Puntos] pts
🥉 [Nombre] — [Puntos] pts

🏌️ *Handicap Alto*
🥇 [Nombre] — [Puntos] pts
🥈 [Nombre] — [Puntos] pts
🥉 [Nombre] — [Puntos] pts

👩 *Clasificación Femenina*
🥇 [Nombre] — [Puntos] pts

👴 *Clasificación Senior (+65)*
🥇 [Nombre] — [Puntos] pts

[Si hay actuaciones destacadas como birdies, menciónalas con emojis]

[Frase de cierre atractiva sobre la próxima jornada o el circuito]

#CircuitoAlbatros #Golf

DATOS DE LA JORNADA:
- Jornada: ${round.name} (J${round.round_number})
- Temporada: ${season?.year || "N/A"}
- Club: ${round.club || "N/A"}
- Campo: ${round.course || "N/A"}
- Fecha: ${round.date}
- Patrocinador: ${round.sponsor || "ninguno"}
${round.is_master ? "- JORNADA MASTER (puntos x1.25)" : ""}

CLASIFICACIÓN HANDICAP BAJO (≤14.4):
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

CLASIFICACIÓN HANDICAP ALTO (14.5–36.0):
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

${females.length > 0 ? `CLASIFICACIÓN FEMENINA — Ganadora:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ""}
${seniors.length > 0 ? `CLASIFICACIÓN SENIOR (+65) — Ganador:\n1. ${seniors[0].players?.name} — ${seniors[0].stableford_points} pts (Hcp ${seniors[0].handicap_at_round})` : ""}
${notablePerformances ? `ACTUACIONES DESTACADAS: ${notablePerformances}` : ""}

Total participantes: ${results.length}
${(() => {
  const w = weather_conditions || {};
  const lines: string[] = [];
  if (w.friday) lines.push(`  · Viernes: ${w.friday}`);
  if (w.saturday) lines.push(`  · Sábado: ${w.saturday}`);
  if (w.sunday) lines.push(`  · Domingo: ${w.sunday}`);
  if (w.green_speed) lines.push(`  · Velocidad de greens: ${w.green_speed}`);
  if (w.wind) lines.push(`  · Viento: ${w.wind}`);
  return lines.length ? `\nCONDICIONES METEOROLÓGICAS Y DEL CAMPO:\n${lines.join('\n')}` : '';
})()}

INSTRUCCIONES:
- Escribe SIEMPRE en castellano
- Utiliza emojis de manera similar a la estructura de referencia
- Para Handicap Bajo y Alto: incluye los 3 primeros clasificados (🥇🥈🥉)
- Para Femenina y Senior: menciona SOLO al ganador/a (🥇)
- IMPORTANTE: Deja una línea en blanco entre cada sección/categoría para facilitar la lectura
- Incluye SIEMPRE los hashtags al final
- El tono debe ser celebratorio y atractivo
- Modalidad STABLEFORD, NO menciones resultados scratch
- Si es jornada MASTER, destácalo
- Si hay patrocinador, menciónalo
- Si se han facilitado condiciones meteorológicas o del campo y son relevantes (lluvia, viento fuerte, greens muy rápidos, calor extremo…), intégralas con naturalidad en una frase del resumen. Si son normales, omítelas.
- Devuelve SOLO el texto del post, sin JSON ni markdown

Devuelve el texto completo del post de Instagram.`;

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
          { role: "system", content: "Eres un community manager especializado en golf. Generas posts de Instagram atractivos en castellano con emojis." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Clean potential markdown wrapping
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "");
    }

    return new Response(JSON.stringify({ success: true, post: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
