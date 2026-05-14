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

    const publishedUrl = "https://circuitoalbatros.lovable.app/rankings";

    const prompt = `Genera un mensaje de WhatsApp en castellano para compartir los RESULTADOS de una jornada de golf del Circuito Albatros.

IMPORTANTE: La competición es en modalidad STABLEFORD. Todos los resultados son en PUNTOS STABLEFORD, NO en golpes. No menciones "golpes" ni "scratch".

TEXTO DE REFERENCIA (adapta el estilo pero con datos Stableford):
---
Resultados ${round.name} — Temporada ${season?.year || "N/A"}

RESULTADOS DE LA ${round.name} DEL CIRCUITO ALBATROS ${season?.year || ""}

El ${round.club || "club"} ha acogido la ${round.name} del Circuito Albatros, disputada el ${round.date}, con la participación de ${results.length} jugadores.
${round.sponsor ? `Jornada patrocinada por ${round.sponsor}.` : ""}
${round.is_master ? "⭐ JORNADA MASTER — ¡Puntos x1.25!" : ""}

En la clasificación Handicap Bajo (≤14.4), [NOMBRE] se ha impuesto con [X] puntos Stableford, seguido de [NOMBRE] ([X]) y [NOMBRE] ([X]).

En la clasificación Handicap Alto (14.5–36), [NOMBRE] se ha impuesto con [X] puntos, seguido de [NOMBRE] ([X]) y [NOMBRE] ([X]).
${females.length > 0 ? `\nEn la clasificación Femenina, [NOMBRE] se ha impuesto con [X] puntos.` : ""}
${seniors.length > 0 ? `\nEn la clasificación Senior (+65), [NOMBRE] se ha impuesto con [X] puntos.` : ""}

Las clasificaciones completas y estadísticas detalladas se pueden consultar en: ${publishedUrl}
---

DATOS REALES:
CLASIFICACIÓN HANDICAP BAJO (≤14.4) — ${hcpLow.length} jugadores:
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

CLASIFICACIÓN HANDICAP ALTO (14.5–36.0) — ${hcpHigh.length} jugadores:
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

${females.length > 0 ? `CLASIFICACIÓN FEMENINA — Ganadora:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ""}
${seniors.length > 0 ? `CLASIFICACIÓN SENIOR (+65) — Ganador:\n1. ${seniors[0].players?.name} — ${seniors[0].stableford_points} pts (Hcp ${seniors[0].handicap_at_round})` : ""}

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
- Sigue EXACTAMENTE la estructura del texto de referencia: título, introducción, resultados por categorías, enlace final
- Para Handicap Bajo y Alto: incluye los 3 primeros clasificados
- Para Femenina y Senior: menciona SOLO al ganador/a
- IMPORTANTE: Deja una línea en blanco entre cada sección/categoría para facilitar la lectura
- Utiliza formato *negritas* de WhatsApp para el título y nombres de categorías
- Tono formal e informativo, sin emojis excesivos (solo alguno puntual si procede)
- SIEMPRE puntos Stableford, NUNCA golpes ni scratch
- Si se han facilitado condiciones meteorológicas o del campo y son relevantes (lluvia, viento fuerte, greens muy rápidos, calor extremo…), intégralas con naturalidad en la introducción. Si son normales, omítelas.
- Incluye el enlace a las clasificaciones al final: ${publishedUrl}
- Devuelve SOLO el texto del mensaje, sin JSON ni markdown`;

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
          { role: "system", content: "Eres un redactor deportivo de golf. Generas mensajes de WhatsApp claros, formales y concisos en castellano." },
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
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "");
    }

    return new Response(JSON.stringify({ success: true, message: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
