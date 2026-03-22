import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Team {
  id: number;
  name: string;
  logo: string;
  country?: string;
}

interface FixtureResponse {
  fixture: { id: number; date: string };
  league: { name: string; season: number };
  teams: { home: Team; away: Team };
  goals: { home: number | null; away: number | null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teamId, day, month, action } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Action: search teams
    if (action === "search-teams") {
      const apiKey = Deno.env.get("API_FOOTBALL_KEY");
      const { query } = await Promise.resolve({ query: teamId }); // teamId is actually query here

      // First check cached teams
      const { data: cachedTeams } = await supabase
        .from("teams")
        .select("id, name, logo, country")
        .ilike("name", `%${query}%`)
        .limit(10);

      if (cachedTeams && cachedTeams.length > 0) {
        return new Response(JSON.stringify({ teams: cachedTeams }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "API_FOOTBALL_KEY not configured", teams: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const res = await fetch(
        `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(String(query))}`,
        { headers: { "x-apisports-key": apiKey } }
      );
      const data = await res.json();
      const teams = (data.response || []).map((t: any) => ({
        id: t.team.id,
        name: t.team.name,
        logo: t.team.logo,
        country: t.team.country,
      }));

      // Cache teams
      if (teams.length > 0) {
        await supabase.from("teams").upsert(teams, { onConflict: "id" });
      }

      return new Response(JSON.stringify({ teams }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: get-stats (default)
    if (!teamId || !day || !month) {
      return new Response(
        JSON.stringify({ error: "teamId, day and month are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache first - get all matches for this team on this day/month
    const { data: cachedMatches } = await supabase
      .from("matches")
      .select("*")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

    // Filter by day/month locally
    const filteredCached = (cachedMatches || []).filter((m: any) => {
      const d = new Date(m.date);
      return d.getUTCDate() === day && d.getUTCMonth() + 1 === month;
    });

    if (filteredCached.length > 0) {
      const stats = calculateStats(filteredCached, teamId);
      return new Response(JSON.stringify({ stats, matches: filteredCached, source: "cache" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from API
    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API_FOOTBALL_KEY not configured. Please add your API key.", stats: null, matches: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const currentYear = new Date().getFullYear();
    const allFixtures: FixtureResponse[] = [];
    const startYear = currentYear - 10;

    // Fetch fixtures for each year
    for (let year = startYear; year <= currentYear; year++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const url = `https://v3.football.api-sports.io/fixtures?team=${teamId}&date=${dateStr}`;

      const res = await fetch(url, {
        headers: { "x-apisports-key": apiKey },
      });
      const data = await res.json();

      if (data.response) {
        allFixtures.push(...data.response);
      }

      // Rate limit - API allows 10 req/min on free plan
      await new Promise((r) => setTimeout(r, 700));
    }

    // Save teams and matches to cache
    const teamsToSave: any[] = [];
    const matchesToSave: any[] = [];

    for (const f of allFixtures) {
      const homeTeam = f.teams.home;
      const awayTeam = f.teams.away;

      teamsToSave.push(
        { id: homeTeam.id, name: homeTeam.name, logo: homeTeam.logo },
        { id: awayTeam.id, name: awayTeam.name, logo: awayTeam.logo }
      );

      if (f.goals.home !== null && f.goals.away !== null) {
        matchesToSave.push({
          id: f.fixture.id,
          date: f.fixture.date.split("T")[0],
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          home_goals: f.goals.home,
          away_goals: f.goals.away,
          league: f.league.name,
          season: f.league.season,
        });
      }
    }

    // Deduplicate teams
    const uniqueTeams = Array.from(
      new Map(teamsToSave.map((t) => [t.id, t])).values()
    );

    if (uniqueTeams.length > 0) {
      await supabase.from("teams").upsert(uniqueTeams, { onConflict: "id" });
    }
    if (matchesToSave.length > 0) {
      await supabase.from("matches").upsert(matchesToSave, { onConflict: "id" });
    }

    const stats = calculateStats(matchesToSave, teamId);

    return new Response(
      JSON.stringify({ stats, matches: matchesToSave, source: "api" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateStats(matches: any[], teamId: number) {
  let wins = 0, draws = 0, losses = 0;
  let goalsFor = 0, goalsAgainst = 0;

  const matchesByYear: Record<number, { result: string; goalsFor: number; goalsAgainst: number; opponent: string; league: string }> = {};

  for (const m of matches) {
    const isHome = m.home_team_id === teamId;
    const gf = isHome ? m.home_goals : m.away_goals;
    const ga = isHome ? m.away_goals : m.home_goals;

    goalsFor += gf;
    goalsAgainst += ga;

    let result: string;
    if (gf > ga) { wins++; result = "win"; }
    else if (gf === ga) { draws++; result = "draw"; }
    else { losses++; result = "loss"; }

    const year = new Date(m.date).getFullYear();
    matchesByYear[year] = { result, goalsFor: gf, goalsAgainst: ga, opponent: "", league: m.league || "" };
  }

  const total = matches.length;
  const points = wins * 3 + draws;
  const score = total > 0 ? points / total : 0;
  const aproveitamento = total > 0 ? ((points) / (total * 3)) * 100 : 0;

  let classification: string;
  let classificationEmoji: string;
  if (score >= 2.0) { classification = "Data sortuda"; classificationEmoji = "🔥"; }
  else if (score >= 1.2) { classification = "Neutra"; classificationEmoji = "⚖️"; }
  else { classification = "Azarada"; classificationEmoji = "💀"; }

  return {
    total,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    avgGoalsPerGame: total > 0 ? +(goalsFor / total).toFixed(2) : 0,
    aproveitamento: +aproveitamento.toFixed(1),
    score: +score.toFixed(2),
    classification,
    classificationEmoji,
    matchesByYear,
  };
}
