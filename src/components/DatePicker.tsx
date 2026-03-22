import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  day: number | null;
  month: number | null;
  onDayChange: (d: number) => void;
  onMonthChange: (m: number) => void;
}

export function DatePicker({ day, month, onDayChange, onMonthChange }: Props) {
  const daysInMonth = month ? new Date(2024, month, 0).getDate() : 31;

  return (
    <div className="flex gap-3 w-full">
      <div className="flex-1">
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Dia</label>
        <Select value={day?.toString() || ""} onValueChange={(v) => onDayChange(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <SelectItem key={d} value={d.toString()}>
                {String(d).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Mês</label>
        <Select value={month?.toString() || ""} onValueChange={(v) => onMonthChange(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {months.map((name, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
