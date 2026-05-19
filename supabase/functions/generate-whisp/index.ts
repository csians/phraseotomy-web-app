import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { elementName, themeName } = await req.json();

    if (!elementName || !themeName) {
      return new Response(
        JSON.stringify({ error: "Missing elementName or themeName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Generating whisp for element: ${elementName}, theme: ${themeName}`);

    // Call Lovable AI to generate a one-word hint
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
            content: "You are a creative game hint generator. Generate EXACTLY ONE WORD that serves as a subtle hint for the given element within the theme context. The word should be related but not too obvious. Choose words from categories like: movie names, sports, dance names, people names, places, objects, or concepts. NEVER use adult content. Respond with ONLY the single word, nothing else."
          },
          {
            role: "user",
            content: `Generate a one-word hint for the element "${elementName}" within the theme "${themeName}". The hint should be creative and help the storyteller craft their story.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error("AI API error:", error);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const whisp = aiData.choices?.[0]?.message?.content?.trim() || "story";

    console.log(`Generated whisp: ${whisp}`);

    return new Response(
      JSON.stringify({ whisp }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-whisp:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
