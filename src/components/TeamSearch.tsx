import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { searchTeams, type TeamResult } from "@/lib/api";
import { Search, Loader2 } from "lucide-react";

interface Props {
  onSelect: (team: TeamResult) => void;
  selected: TeamResult | null;
}

export function TeamSearch({ onSelect, selected }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (value.length < 3) {
        setResults([]);
        setOpen(false);
        return;
      }
      const timer = setTimeout(async () => {
        setLoading(true);
        try {
          const teams = await searchTeams(value);
          setResults(teams);
          setOpen(true);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 400);
      setDebounceTimer(timer);
    },
    [debounceTimer]
  );

  return (
    <div className="relative w-full">
      <label className="block text-sm font-medium text-muted-foreground mb-1.5">
        Time
      </label>
      {selected ? (
        <button
          onClick={() => {
            onSelect(null as any);
            setQuery("");
            setResults([]);
          }}
          className="flex items-center gap-3 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
        >
          {selected.logo && (
            <img src={selected.logo} alt="" className="w-6 h-6 object-contain" />
          )}
          <span className="font-medium text-card-foreground">{selected.name}</span>
          <span className="ml-auto text-xs text-muted-foreground">trocar</span>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar time..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>
      )}

      {open && results.length > 0 && !selected && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {results.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                onSelect(team);
                setOpen(false);
                setQuery(team.name);
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left"
            >
              {team.logo && (
                <img src={team.logo} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-sm text-popover-foreground">{team.name}</span>
              {team.country && (
                <span className="ml-auto text-xs text-muted-foreground">{team.country}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
