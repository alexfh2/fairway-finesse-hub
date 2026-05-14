const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!
const AI_GATEWAY = 'https://ai-gateway.lovable.dev'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdf_base64 } = await req.json()
    if (!pdf_base64) {
      return new Response(JSON.stringify({ error: 'pdf_base64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use AI to extract player names and licenses from the PDF
    const response = await fetch(`${AI_GATEWAY}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a data extraction assistant. You will receive a PDF of a golf senior classification/ranking. Extract ALL player names and license numbers from it. Return ONLY a JSON array of objects with "name" and "license" fields. No markdown, no explanation, just the JSON array. Example: [{"name":"GARCIA LOPEZ, JUAN","license":"CB12345678"},{"name":"MARTINEZ ROS, ANA","license":"CB87654321"}]. If you cannot find a license for a player, use an empty string. Extract ALL players, not just the first few.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdf_base64}`,
                },
              },
              {
                type: 'text',
                text: 'Extract all player names and license numbers from this senior golf classification PDF.',
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 8000,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`AI Gateway error: ${response.status} ${errText}`)
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content || '[]'

    // Parse JSON from AI response (strip markdown fences if present)
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let players: { name: string; license: string }[]
    try {
      players = JSON.parse(jsonStr)
    } catch {
      players = []
    }

    return new Response(JSON.stringify({ players }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
