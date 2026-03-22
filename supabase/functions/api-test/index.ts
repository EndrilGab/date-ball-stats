const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Use GET /api/test" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const apiKeyConfigured = Boolean(Deno.env.get("API_FOOTBALL_KEY"));

  if (!apiKeyConfigured) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Backend ativo, mas API_FOOTBALL_KEY não está configurada.",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const apiKey = Deno.env.get("API_FOOTBALL_KEY")!;
    const season = new Date().getUTCFullYear();
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=33&season=${season}&page=1`,
      {
        headers: { "x-apisports-key": apiKey },
      },
    );

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    console.log("Response API:", data);

    return new Response(
      JSON.stringify({
        ok: response.ok,
        status: response.status,
        message: "Rota de teste do backend funcionando.",
        hasResponse: Boolean(data?.response),
        results: data?.results ?? 0,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Falha na chamada externa da rota de teste.",
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});