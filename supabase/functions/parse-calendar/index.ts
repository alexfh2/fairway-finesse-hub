import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const monthMap: Record<string, string> = {
  gener: "01", febrer: "02", febret: "02", març: "03", abril: "04",
  maig: "05", juny: "06", juliol: "07", agost: "08",
  setembre: "09", octubre: "10", novembre: "11", desembre: "12",
};

interface ParsedRound {
  round_number: number;
  name: string;
  club: string;
  sponsor: string;
  dates: string[];
  detail_url: string;
  image_url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url, file } = body;

    if (!url && !file) {
      return new Response(
        JSON.stringify({ success: false, error: "URL or file is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If file (image/PDF) is provided, use AI to extract calendar data
    if (file) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You extract golf tournament calendar data from images/PDFs. Return structured data using the provided tool.`
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all rounds/jornades from this golf calendar. For each round, extract: round number, course/club name, dates, and sponsor if visible." },
                { type: "image_url", image_url: { url: file } }
              ]
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_calendar",
              description: "Extract golf tournament calendar rounds",
              parameters: {
                type: "object",
                properties: {
                  rounds: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        round_number: { type: "number" },
                        name: { type: "string", description: "Course/club name" },
                        club: { type: "string" },
                        sponsor: { type: "string" },
                        dates: { type: "array", items: { type: "string" }, description: "Dates in YYYY-MM-DD format" },
                      },
                      required: ["round_number", "name", "dates"]
                    }
                  }
                },
                required: ["rounds"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "extract_calendar" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        throw new Error("Error processing image");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("AI could not extract calendar data");

      const parsed = JSON.parse(toolCall.function.arguments);
      const rounds: ParsedRound[] = (parsed.rounds || []).map((r: any) => ({
        round_number: r.round_number,
        name: r.name || `Jornada ${r.round_number}`,
        club: r.club || "",
        sponsor: r.sponsor || "",
        dates: r.dates || [],
        detail_url: "",
        image_url: "",
      }));

      return new Response(
        JSON.stringify({ success: true, rounds }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // URL-based parsing (existing logic)
    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();
    const rounds = parseCalendar(html);

    return new Response(
      JSON.stringify({ success: true, rounds }),
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

function parseCalendar(html: string): ParsedRound[] {
  const year = new Date().getFullYear();

  // Strip scripts/styles
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Strategy: Find all <a> blocks that contain "jornada" text
  // The WordPress page structure has blocks per round with:
  // - An image link to the round detail
  // - A text link with club name + "Sortides Xª jornada" + dates

  // Extract round detail URLs (non-wp, non-utility links on gastronomicgolf.com)
  const detailUrlRegex = /href="(https:\/\/gastronomicgolf\.com\/(?!wp-|feed|comment|festesoci)[a-z0-9-]+\/?)"[^>]*>/gi;
  const detailUrls: string[] = [];
  const seenUrls = new Set<string>();
  let m;
  while ((m = detailUrlRegex.exec(clean)) !== null) {
    const u = m[1].replace(/\/$/, "");
    if (!seenUrls.has(u)) {
      seenUrls.add(u);
      detailUrls.push(u);
    }
  }

  // Extract poster images
  const imageRegex = /src="(https:\/\/gastronomicgolf\.com\/wp-content\/uploads\/[^"]*\d+x\d+[^"]*)"/gi;
  const imageUrls: string[] = [];
  while ((m = imageRegex.exec(clean)) !== null) {
    imageUrls.push(m[1]);
  }

  // Get text content preserving some structure
  const text = clean
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "–")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/[ \t]+/g, " ");

  // Find all "Sortides Xª jornada" markers
  const jornadaRegex = /Sortides\s+(\d+)[ªº]?\s*jornada/gi;
  const markers: { index: number; num: number }[] = [];
  while ((m = jornadaRegex.exec(text)) !== null) {
    markers.push({ index: m.index, num: parseInt(m[1]) });
  }

  const rounds: ParsedRound[] = [];

  for (let i = 0; i < markers.length; i++) {
    // Look back ~300 chars for club name, forward ~300 chars for dates
    const blockStart = Math.max(0, markers[i].index - 300);
    const blockEnd = i + 1 < markers.length
      ? markers[i + 1].index - 50
      : markers[i].index + 400;
    const block = text.substring(blockStart, blockEnd);

    const roundNum = markers[i].num;

    // Extract dates from this block only (after "Sortides")
    const afterSortides = text.substring(markers[i].index, blockEnd);
    const dates = extractDates(afterSortides, year);

    // Extract club: look for known patterns before "Gastronòmic/Gastronomic"
    let club = "";
    // Try to find club name pattern: text before "Gastron" that looks like a club name
    const beforeGastro = block.substring(0, block.indexOf("Gastron"));
    if (beforeGastro) {
      // Get last meaningful line/phrase
      const lines = beforeGastro.split("\n").filter(l => l.trim().length > 3);
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1].trim();
        // Clean up common prefixes
        club = lastLine
          .replace(/^.*?(Golf|Gaudí|La Roca|Panorámica|Empordà|Montanyà|Torremirona)/i, "$1")
          .replace(/\s+/g, " ")
          .trim();
      }
    }

    // Extract sponsor
    let sponsor = "";
    const sponsorMatch = block.match(/Gastron[oò]mic\s+de\s+[A-Za-zÀ-úçÉ\s&']+/i);
    if (sponsorMatch) {
      sponsor = sponsorMatch[0].trim();
    }

    rounds.push({
      round_number: roundNum,
      name: club || `Jornada ${roundNum}`,
      club,
      sponsor,
      dates,
      detail_url: detailUrls[i] || "",
      image_url: imageUrls[i] || "",
    });
  }

  return rounds;
}

function extractDates(text: string, year: number): string[] {
  const dates: string[] = [];
  const dateRegex = /(?:Dilluns|Dimarts|Dimecres|Dijous|Divendres|Dissabte|Diumenge)\s+(\d{1,2})\s+d[e']?\s*(\w+)/gi;
  let match;
  while ((match = dateRegex.exec(text)) !== null) {
    const day = match[1].padStart(2, "0");
    const monthName = match[2].toLowerCase();
    const month = monthMap[monthName];
    if (month) {
      const d = `${year}-${month}-${day}`;
      if (!dates.includes(d)) dates.push(d);
    }
  }
  return dates.sort();
}
