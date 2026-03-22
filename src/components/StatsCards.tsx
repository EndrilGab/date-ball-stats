import { type Stats } from "@/lib/api";
import { Trophy, Target, TrendingUp, BarChart3, Percent, Flame } from "lucide-react";

interface Props {
  stats: Stats;
  teamName: string;
  day: number;
  month: number;
}

const months = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function StatsCards({ stats, teamName, day, month }: Props) {
  const cards = [
    { label: "Total de jogos", value: stats.total, icon: BarChart3 },
    { label: "Vitórias", value: stats.wins, icon: Trophy, color: "text-[hsl(var(--win))]" },
    { label: "Empates", value: stats.draws, icon: Target, color: "text-[hsl(var(--draw))]" },
    { label: "Derrotas", value: stats.losses, icon: Target, color: "text-[hsl(var(--loss))]" },
    { label: "Aproveitamento", value: `${stats.aproveitamento}%`, icon: Percent },
    { label: "Gols marcados", value: stats.goalsFor, icon: TrendingUp },
    { label: "Gols sofridos", value: stats.goalsAgainst, icon: TrendingUp },
    { label: "Saldo de gols", value: stats.goalDifference > 0 ? `+${stats.goalDifference}` : stats.goalDifference, icon: BarChart3 },
    { label: "Média de gols/jogo", value: stats.avgGoalsPerGame, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Classification banner */}
      <div className="rounded-xl bg-card border border-border p-5 text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          {teamName} no dia {String(day).padStart(2, "0")} de {months[month]}
        </p>
        <p className="text-4xl font-bold tracking-tight">
          {stats.classificationEmoji}
        </p>
        <p className="text-lg font-semibold text-card-foreground">
          {stats.classification}
        </p>
        <p className="text-xs text-muted-foreground">
          Índice: {stats.score}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-card border border-border p-4 space-y-1 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-center gap-2">
              <card.icon className={`w-4 h-4 ${card.color || "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${card.color || "text-card-foreground"}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
