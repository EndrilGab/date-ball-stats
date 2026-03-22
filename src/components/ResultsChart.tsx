import { type Stats } from "@/lib/api";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, Cell, CartesianGrid } from "recharts";

interface Props {
  stats: Stats;
}

const resultMap: Record<string, { label: string; value: number }> = {
  win: { label: "Vitória", value: 3 },
  draw: { label: "Empate", value: 1 },
  loss: { label: "Derrota", value: 0 },
};

const colorMap: Record<string, string> = {
  win: "hsl(153, 60%, 40%)",
  draw: "hsl(38, 90%, 55%)",
  loss: "hsl(0, 72%, 51%)",
};

export function ResultsChart({ stats }: Props) {
  const data = Object.entries(stats.matchesByYear)
    .map(([year, m]) => ({
      year,
      value: resultMap[m.result]?.value ?? 0,
      result: m.result,
      label: resultMap[m.result]?.label ?? m.result,
      goals: `${m.goalsFor}x${m.goalsAgainst}`,
      league: m.league,
    }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  if (data.length === 0) return null;

  const chartConfig = {
    value: { label: "Resultado" },
  };

  return (
    <div className="rounded-xl bg-card border border-border p-5 space-y-3">
      <h3 className="text-sm font-semibold text-card-foreground">Resultados por ano</h3>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorMap.win }} />
          Vitória
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorMap.draw }} />
          Empate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorMap.loss }} />
          Derrota
        </span>
      </div>
      <ChartContainer config={chartConfig} className="h-[220px] w-full">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis
            domain={[0, 3]}
            ticks={[0, 1, 3]}
            tickFormatter={(v) => (v === 3 ? "V" : v === 1 ? "E" : "D")}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, props) => (
                  <span>
                    {props.payload.label} — {props.payload.goals}
                    {props.payload.league && (
                      <span className="block text-muted-foreground">{props.payload.league}</span>
                    )}
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((entry, i) => (
              <Cell key={i} fill={colorMap[entry.result] || colorMap.loss} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
