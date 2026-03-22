import { supabase } from "@/integrations/supabase/client";

export interface TeamResult {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
}

export interface MatchResult {
  id: number;
  date: string;
  home_team_id: number;
  away_team_id: number;
  home_goals: number;
  away_goals: number;
  league: string | null;
  season: number | null;
}

export interface Stats {
  total: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  avgGoalsPerGame: number;
  aproveitamento: number;
  score: number;
  classification: string;
  classificationEmoji: string;
  matchesByYear: Record<string, { result: string; goalsFor: number; goalsAgainst: number; league: string }>;
}

export async function searchTeams(query: string): Promise<TeamResult[]> {
  const { data, error } = await supabase.functions.invoke("fetch-fixtures", {
    body: { action: "search-teams", teamId: query },
  });
  if (error) throw error;
  return data.teams || [];
}

export async function getStats(teamId: number, day: number, month: number) {
  const { data, error } = await supabase.functions.invoke("fetch-fixtures", {
    body: { teamId, day, month },
  });
  if (error) throw error;
  if (data.error && !data.stats) throw new Error(data.error);
  return data as { stats: Stats | null; matches: MatchResult[]; source: string; error?: string };
}
