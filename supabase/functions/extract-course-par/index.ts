import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, file, mode } = await req.json();
    const isWomen = mode === 'women';
    if (!url && !file) {
      return new Response(JSON.stringify({ success: false, error: "URL or file is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = isWomen
      ? `You are a golf course data extractor. Extract ONLY the WOMEN'S handicap (stroke index) for each of the 18 holes from the provided content.
Many scorecards show separate stroke index columns for men and women (sometimes labeled "Hcp Dones", "Hcp Mujeres", "Hcp Ladies", "S.I. Ladies", "Red tees", "Rojo", or a column next to the women's/red tee yardages).
Return an array of exactly 18 integers (values 1-18, each used once) representing the women's stroke index for holes 1-18.
If the scorecard only shows one handicap column, return that one (it will be the same as men's).`
      : `You are a golf course data extractor. Extract the par AND handicap (stroke index) for each hole from the provided content.
Return structured data with two arrays of exactly 18 integers each:
- par: the par value for holes 1-18 (typically 3, 4, or 5)
- handicap: the stroke index/handicap for holes 1-18 (values 1-18, each used once)
Look for patterns like "Par 4", "Par 5", "Par 3" and "Hcp", "Handicap", "Stroke Index", "S.I." associated with hole numbers.
If the scorecard shows "Amarillo/Yellow", "Blanco/White", "Rojo/Red" tees, extract par from the main/yellow tees unless specified otherwise. For handicap, use the men's stroke index column.`;

    let messages: any[];

    const userTextFile = isWomen
      ? "Extract ONLY the women's handicap (stroke index) for each of the 18 holes from this golf course scorecard:"
      : "Extract the par and handicap (stroke index) for each of the 18 holes from this golf course scorecard:";
    const userTextUrlPrefix = isWomen
      ? "Extract ONLY the women's handicap (stroke index) for each of the 18 holes from this golf course webpage:"
      : "Extract the par and handicap (stroke index) for each of the 18 holes from this golf course webpage:";

    if (file) {
      // file is a base64 data URI like "data:image/jpeg;base64,..."
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userTextFile },
            { type: "image_url", image_url: { url: file } },
          ],
        },
      ];
    } else {
      // URL: fetch HTML
      const pageResponse = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GolfBot/1.0)" },
      });
      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch URL: ${pageResponse.status}`);
      }
      const html = await pageResponse.text();
      const truncatedHtml = html.substring(0, 15000);

      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userTextUrlPrefix}\n\n${truncatedHtml}`,
        },
      ];
    }

    const toolDef = isWomen
      ? {
          type: "function" as const,
          function: {
            name: "extract_women_handicap",
            description: "Return the women's handicap (stroke index) values for all 18 holes",
            parameters: {
              type: "object",
              properties: {
                handicap_women: {
                  type: "array",
                  items: { type: "integer" },
                  description: "Array of 18 women's stroke index values, one per hole (holes 1-18). Values 1-18.",
                },
              },
              required: ["handicap_women"],
              additionalProperties: false,
            },
          },
        }
      : {
          type: "function" as const,
          function: {
            name: "extract_course_data",
            description: "Return the par and handicap (stroke index) values for all 18 holes of the golf course",
            parameters: {
              type: "object",
              properties: {
                par: {
                  type: "array",
                  items: { type: "integer" },
                  description: "Array of 18 par values, one per hole (holes 1-18)",
                },
                handicap: {
                  type: "array",
                  items: { type: "integer" },
                  description: "Array of 18 stroke index/handicap values, one per hole (holes 1-18). Values 1-18.",
                },
                course_name: {
                  type: "string",
                  description: "Name of the golf course if found",
                },
              },
              required: ["par", "handicap"],
              additionalProperties: false,
            },
          },
        };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: file ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview",
        messages,
        tools: [toolDef],
        tool_choice: { type: "function", function: { name: toolDef.function.name } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      throw new Error("AI extraction failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    if (isWomen) {
      const handicapWomen: number[] = extracted.handicap_women;
      if (!Array.isArray(handicapWomen) || handicapWomen.length !== 18) {
        throw new Error(`Expected 18 women's handicap values but got ${handicapWomen?.length || 0}. Try entering manually.`);
      }
      return new Response(JSON.stringify({
        success: true,
        handicap_women: handicapWomen,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const par: number[] = extracted.par;
    const handicap: number[] = extracted.handicap;

    if (!Array.isArray(par) || !Array.isArray(handicap)) {
      throw new Error("AI did not return arrays. Try entering manually.");
    }

    // Tolerate off-by-one extractions (commonly the AI omits hole 18 or merges totals)
    const padArray = (arr: number[], label: string) => {
      if (arr.length === 18) return arr;
      if (arr.length === 17) {
        console.warn(`${label}: got 17 values, padding with 0 — please review manually`);
        return [...arr, 0];
      }
      if (arr.length === 19) {
        console.warn(`${label}: got 19 values, trimming last — please review manually`);
        return arr.slice(0, 18);
      }
      throw new Error(`Expected 18 ${label} values but got ${arr.length}. Try entering manually.`);
    };

    const parFinal = padArray(par, "par");
    const handicapFinal = padArray(handicap, "handicap");

    return new Response(JSON.stringify({
      success: true,
      par: parFinal,
      handicap: handicapFinal,
      course_name: extracted.course_name,
      total_par: parFinal.reduce((a: number, b: number) => a + b, 0),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("extract-course-par error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
