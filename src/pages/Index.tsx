import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TeamSearch } from "@/components/TeamSearch";
import { DatePicker } from "@/components/DatePicker";
import { StatsCards } from "@/components/StatsCards";
import { ResultsChart } from "@/components/ResultsChart";
import { getStats, type TeamResult, type Stats, type MatchResult } from "@/lib/api";
import { BarChart3, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export default function Index() {
  const [team, setTeam] = useState<TeamResult | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const canAnalyze = team && day && month;

  const handleAnalyze = async () => {
    if (!team || !day || !month) return;
    setLoading(true);
    setStats(null);
    try {
      const result = await getStats(team.id, day, month);
      if (result.error) {
        toast.warning(result.error);
      }
      if (result.stats) {
        setStats(result.stats);
        if (result.source === "cache") {
          toast.info("Dados carregados do cache");
        }
      } else if (!result.error) {
        toast.info("Nenhum jogo encontrado nessa data");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar dados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2.5">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            FootDate Analytics
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Search section */}
        <section className="rounded-xl bg-card border border-border p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-card-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Análise por data
            </h2>
            <p className="text-sm text-muted-foreground">
              Selecione um time e uma data para ver o desempenho histórico
            </p>
          </div>

          <TeamSearch onSelect={setTeam} selected={team} />
          <DatePicker day={day} month={month} onDayChange={setDay} onMonthChange={setMonth} />

          <Button
            onClick={handleAnalyze}
            disabled={!canAnalyze || loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              "Analisar"
            )}
          </Button>
        </section>

        {/* Results */}
        {stats && team && day && month && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StatsCards stats={stats} teamName={team.name} day={day} month={month} />
            <ResultsChart stats={stats} />
          </div>
        )}
      </main>
    </div>
  );
}
