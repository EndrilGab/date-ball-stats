import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Team {
  id: number;
  name: string;
  logo: string | null;
  country?: string | null;
}

interface FixtureResponse {
  fixture: { id: number; date: string };
  league: { name: string; season: number };
  teams: { home: Team; away: Team };
  goals: { home: number | null; away: number | null };
}

class ApiFootballError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_CACHE_PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const action = body.action || "get-stats";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Configuração do backend incompleta." }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "search-teams") {
      const rawQuery = body.query ?? body.teamId ?? "";
      const query = String(rawQuery).trim();

      if (query.length < 2) {
        return jsonResponse({ teams: [] });
      }

      const { data: cachedTeams } = await supabase
        .from("teams")
        .select("id, name, logo, country")
        .ilike("name", `%${query}%`)
        .limit(10);

      if (cachedTeams && cachedTeams.length > 0) {
        return jsonResponse({ teams: cachedTeams, source: "cache" });
      }

      const apiKey = Deno.env.get("API_FOOTBALL_KEY");
      if (!apiKey) {
        return jsonResponse({ error: "API_FOOTBALL_KEY não configurada.", teams: [] });
      }

      const data = await requestApiFootball(
        `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(query)}`,
        apiKey,
      );

      const teams: Team[] = (data.response || []).map((item: any) => ({
        id: Number(item.team.id),
        name: item.team.name,
        logo: item.team.logo,
        country: item.team.country,
      }));

      if (teams.length > 0) {
        await supabase.from("teams").upsert(teams, { onConflict: "id" });
      }

      return jsonResponse({ teams, source: "api" });
    }

    const teamId = Number(body.teamId);
    const day = Number(body.day);
    const month = Number(body.month);

    if (!Number.isInteger(teamId) || !Number.isInteger(day) || !Number.isInteger(month)) {
      return jsonResponse({ error: "teamId, day e month devem ser numéricos." }, 400);
    }

    const cachedMatches = await fetchAllCachedTeamMatches(supabase, teamId);
    const filteredCachedMatches = filterMatchesByDayMonth(cachedMatches, day, month);

    if (filteredCachedMatches.length > 0) {
      const stats = calculateStats(filteredCachedMatches, teamId);
      return jsonResponse({ stats, matches: filteredCachedMatches, source: "cache" });
    }

    const apiKey = Deno.env.get("API_FOOTBALL_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "API_FOOTBALL_KEY não configurada.", stats: null, matches: [] });
    }

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const startSeason = currentYear - 10;

    const { seasons, preloadedFixtures, preloadedSeason } = await resolveSeasonRange(
      teamId,
      apiKey,
      startSeason,
      currentYear,
    );

    const collectedFixtures: FixtureResponse[] = [...preloadedFixtures];

    for (const season of seasons) {
      if (season === preloadedSeason) continue;
      const fixturesBySeason = await fetchFixturesBySeason(teamId, season, apiKey);
      collectedFixtures.push(...fixturesBySeason);
      await wait(250);
    }

    const teamsToCache: Team[] = [];
    const matchesToCache: any[] = [];

    for (const fixture of collectedFixtures) {
      teamsToCache.push(
        {
          id: Number(fixture.teams.home.id),
          name: fixture.teams.home.name,
          logo: fixture.teams.home.logo,
          country: fixture.teams.home.country || null,
        },
        {
          id: Number(fixture.teams.away.id),
          name: fixture.teams.away.name,
          logo: fixture.teams.away.logo,
          country: fixture.teams.away.country || null,
        },
      );

      if (fixture.goals.home === null || fixture.goals.away === null) {
        continue;
      }

      matchesToCache.push({
        id: Number(fixture.fixture.id),
        date: fixture.fixture.date.split("T")[0],
        home_team_id: Number(fixture.teams.home.id),
        away_team_id: Number(fixture.teams.away.id),
        home_goals: fixture.goals.home,
        away_goals: fixture.goals.away,
        league: fixture.league.name,
        season: fixture.league.season,
      });
    }

    if (collectedFixtures.length === 0) {
      return jsonResponse({
        error: "A API retornou resposta vazia para os filtros informados.",
        stats: null,
        matches: [],
      });
    }

    if (teamsToCache.length > 0) {
      const uniqueTeams = Array.from(new Map(teamsToCache.map((team) => [team.id, team])).values());
      await supabase.from("teams").upsert(uniqueTeams, { onConflict: "id" });
    }

    if (matchesToCache.length > 0) {
      await supabase.from("matches").upsert(matchesToCache, { onConflict: "id" });
    }

    const filteredMatches = filterMatchesByDayMonth(matchesToCache, day, month);
    const stats = calculateStats(filteredMatches, teamId);

    return jsonResponse({ stats, matches: filteredMatches, source: "api" });
  } catch (error) {
    if (error instanceof ApiFootballError) {
      return jsonResponse({ error: error.message, stats: null, matches: [] });
    }

    console.error("Erro api-matches:", error);
    return jsonResponse({ error: (error as Error).message || "Erro interno." }, 500);
  }
});

async function fetchFixturesBySeason(teamId: number, season: number, apiKey: string): Promise<FixtureResponse[]> {
  const url = `https://v3.football.api-sports.io/fixtures?team=${teamId}&season=${season}`;
  const data = await requestApiFootball(url, apiKey);

  const planRange = parsePlanRange(data?.errors?.plan);
  if (planRange) {
    return [];
  }

  const apiErrors = formatApiErrors(data?.errors);
  if (apiErrors) {
    throw new ApiFootballError(502, `Erro da API-FOOTBALL: ${apiErrors}`);
  }

  return data.response || [];
}

async function resolveSeasonRange(
  teamId: number,
  apiKey: string,
  requestedStart: number,
  requestedEnd: number,
): Promise<{ seasons: number[]; preloadedFixtures: FixtureResponse[]; preloadedSeason: number | null }> {
  const probeSeason = requestedEnd;
  const probeData = await requestApiFootball(
    `https://v3.football.api-sports.io/fixtures?team=${teamId}&season=${probeSeason}`,
    apiKey,
  );

  const planRange = parsePlanRange(probeData?.errors?.plan);
  if (planRange) {
    const start = Math.max(requestedStart, planRange.start);
    const end = Math.min(requestedEnd, planRange.end);
    return {
      seasons: buildSeasonRange(start, end),
      preloadedFixtures: [],
      preloadedSeason: null,
    };
  }

  const apiErrors = formatApiErrors(probeData?.errors);
  if (apiErrors) {
    throw new ApiFootballError(502, `Erro da API-FOOTBALL: ${apiErrors}`);
  }

  return {
    seasons: buildSeasonRange(requestedStart, requestedEnd),
    preloadedFixtures: probeData.response || [],
    preloadedSeason: probeSeason,
  };
}

function buildSeasonRange(start: number, end: number): number[] {
  if (start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

async function fetchAllCachedTeamMatches(supabase: ReturnType<typeof createClient>, teamId: number): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const to = from + MAX_CACHE_PAGE - 1;
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao ler cache de partidas: ${error.message}`);
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < MAX_CACHE_PAGE) {
      break;
    }

    from += MAX_CACHE_PAGE;
  }

  return allRows;
}

function filterMatchesByDayMonth(matches: any[], day: number, month: number): any[] {
  return matches.filter((match) => {
    const date = new Date(`${match.date}T00:00:00Z`);
    return date.getUTCDate() === day && date.getUTCMonth() + 1 === month;
  });
}

async function requestApiFootball(url: string, apiKey: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  const textBody = await response.text();
  let data: any = {};

  if (textBody) {
    try {
      data = JSON.parse(textBody);
    } catch {
      data = { raw: textBody };
    }
  }

  console.log("Response API:", data);

  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiFootballError(401, "Erro 401: API key inválida na API-FOOTBALL.");
    }
    if (response.status === 403) {
      throw new ApiFootballError(403, "Erro 403: acesso bloqueado pela API-FOOTBALL.");
    }
    if (response.status === 429) {
      throw new ApiFootballError(429, "Erro 429: limite de requisições da API-FOOTBALL excedido.");
    }

    throw new ApiFootballError(response.status, `Erro ${response.status}: falha na API-FOOTBALL.`);
  }

  return data;
}

function parsePlanRange(planError?: unknown): { start: number; end: number } | null {
  if (typeof planError !== "string") return null;
  const matched = planError.match(/from\s+(\d{4})\s+to\s+(\d{4})/i);
  if (!matched) return null;
  return {
    start: Number(matched[1]),
    end: Number(matched[2]),
  };
}

function formatApiErrors(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;

  const entries = Object.entries(errors as Record<string, unknown>).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });

  if (entries.length === 0) return null;
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ");
}

function calculateStats(matches: any[], teamId: number) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  const matchesByYear: Record<
    number,
    { result: string; goalsFor: number; goalsAgainst: number; league: string }
  > = {};

  for (const match of matches) {
    const isHome = Number(match.home_team_id) === Number(teamId);
    const gf = isHome ? Number(match.home_goals) : Number(match.away_goals);
    const ga = isHome ? Number(match.away_goals) : Number(match.home_goals);

    goalsFor += gf;
    goalsAgainst += ga;

    let result: "win" | "draw" | "loss";
    if (gf > ga) {
      wins += 1;
      result = "win";
    } else if (gf === ga) {
      draws += 1;
      result = "draw";
    } else {
      losses += 1;
      result = "loss";
    }

    const year = new Date(`${match.date}T00:00:00Z`).getUTCFullYear();
    matchesByYear[year] = {
      result,
      goalsFor: gf,
      goalsAgainst: ga,
      league: match.league || "",
    };
  }

  const total = matches.length;
  const points = wins * 3 + draws;
  const score = total > 0 ? points / total : 0;
  const aproveitamento = total > 0 ? (points / (total * 3)) * 100 : 0;

  let classification = "Azarada";
  let classificationEmoji = "💀";

  if (score >= 2) {
    classification = "Data sortuda";
    classificationEmoji = "🔥";
  } else if (score >= 1.2) {
    classification = "Neutra";
    classificationEmoji = "⚖️";
  }

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}