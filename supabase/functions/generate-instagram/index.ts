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

    const { round_id, language } = await req.json();

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
      .filter((r: any) => r.category === "hcp_low" || (r.handicap_at_round !== null && r.handicap_at_round <= 15))
      .sort((a: any, b: any) => (b.stableford_points ?? 0) - (a.stableford_points ?? 0));
    const hcpHigh = results
      .filter((r: any) => r.category === "hcp_high" || (r.handicap_at_round !== null && r.handicap_at_round > 15))
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

    const langLabel = language === "ca" ? "català" : "castellà";

    const prompt = `Genera un post d'Instagram en ${langLabel} per compartir els RESULTATS d'una jornada de golf del circuit Gastronòmic Golf Experience.

ESTRUCTURA DE REFERÈNCIA (adapta-la per a RESULTATS, no per a convocatòria):
🏌️‍♂️✨ GASTRONÒMIC GOLF EXPERIENCE ✨🏌️‍♀️
[Emoji + Nom del torneig/jornada]
📍 [Camp]
📅 [Data]

[1-2 frases resum engrescadores sobre com va anar la jornada]

🏆 RESULTATS

🏌️ *Hàndicap Baix*
🥇 [Nom] — [Punts] pts
🥈 [Nom] — [Punts] pts
🥉 [Nom] — [Punts] pts

🏌️ *Hàndicap Alt*
🥇 [Nom] — [Punts] pts
🥈 [Nom] — [Punts] pts
🥉 [Nom] — [Punts] pts

👩 *Classificació Femenina*
🥇 [Nom] — [Punts] pts

👴 *Classificació Sènior (+65)*
🥇 [Nom] — [Punts] pts

[Si hi ha actuacions destacades com birdies, mencionar-les amb emojis]

[Frase de tancament engrescadora sobre la propera jornada o el circuit]

🤝 Sponsors & Ordre de Mèrit
@omodajaecoo.prunacargo
@cavesbohigas
@escampa_hotels
@santipamiesjoiers
@tancatdecodorniu
@garmin_iberia
@bonareaoficial_cat
#GastronomicGolf #GolfiGastronomia #CircuitGastronomic

DADES DE LA JORNADA:
- Jornada: ${round.name} (J${round.round_number})
- Temporada: ${season?.year || "N/A"}
- Club: ${round.club || "N/A"}
- Camp: ${round.course || "N/A"}
- Data: ${round.date}
- Patrocinador: ${round.sponsor || "cap"}
${round.is_master ? "- JORNADA MASTER (punts x1.25)" : ""}

CLASSIFICACIÓ HANDICAP BAIX (≤15.0):
${hcpLow.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

CLASSIFICACIÓ HANDICAP ALT (15.1–36.0):
${hcpHigh.slice(0, 3).map((r: any, i: number) => `${i + 1}. ${r.players?.name} — ${r.stableford_points} pts (Hcp ${r.handicap_at_round})`).join("\n")}

${females.length > 0 ? `CLASSIFICACIÓ FEMENINA — Guanyadora:\n1. ${females[0].players?.name} — ${females[0].stableford_points} pts (Hcp ${females[0].handicap_at_round})` : ""}
${seniors.length > 0 ? `CLASSIFICACIÓ SÈNIOR (+65) — Guanyador:\n1. ${seniors[0].players?.name} — ${seniors[0].stableford_points} pts (Hcp ${seniors[0].handicap_at_round})` : ""}
${notablePerformances ? `ACTUACIONS DESTACADES: ${notablePerformances}` : ""}

Total participants: ${results.length}

INSTRUCCIONS:
- Utilitza emojis de manera similar a l'estructura de referència
- Per a Hàndicap Baix i Alt: inclou els 3 primers classificats (🥇🥈🥉)
- Per a Femenina i Sènior: menciona NOMÉS el/la guanyador/a (🥇)
- IMPORTANT: Deixa una línia en blanc entre cada secció/categoria per facilitar la lectura
- Inclou SEMPRE els sponsors i hashtags al final
- El to ha de ser celebratori i engrescador
- Modalitat STABLEFORD, NO mencionIs resultats scratch
- Si és jornada MASTER, destaca-ho
- Si hi ha patrocinador, menciona'l
- Retorna NOMÉS el text del post, sense JSON ni markdown

Retorna el text complet del post d'Instagram.`;

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
          { role: "system", content: "Ets un community manager especialitzat en golf i gastronomia. Generes posts d'Instagram atractius i engrescadors amb emojis." },
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
