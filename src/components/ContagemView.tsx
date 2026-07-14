import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Minus, Plus, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];

const supplierColors: Record<string, string> = {
  slate: "bg-slate-500/20 text-slate-200",
  amber: "bg-amber-500/20 text-amber-200",
  emerald: "bg-emerald-500/20 text-emerald-200",
  rose: "bg-rose-500/20 text-rose-200",
  violet: "bg-violet-500/20 text-violet-200",
  sky: "bg-sky-500/20 text-sky-200",
  orange: "bg-orange-500/20 text-orange-200",
};
export const SUPPLIER_COLOR_OPTIONS = Object.keys(supplierColors);
export function supplierBadgeClass(cor?: string | null) {
  return supplierColors[cor ?? "slate"] ?? supplierColors.slate;
}

export function ContagemView() {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.from("items").select("*").order("nome"),
      supabase.from("suppliers").select("*").order("nome"),
    ]).then(([it, sp]) => {
      if (!mounted) return;
      setItems(it.data ?? []);
      setSuppliers(sp.data ?? []);
      setLoading(false);
    });

    const ch = supabase.channel("items-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, payload => {
        setItems(curr => {
          if (payload.eventType === "DELETE") return curr.filter(i => i.id !== (payload.old as Item).id);
          const row = payload.new as Item;
          const idx = curr.findIndex(i => i.id === row.id);
          if (idx === -1) return [...curr, row].sort((a, b) => a.nome.localeCompare(b.nome));
          const copy = [...curr];
          copy[idx] = row;
          return copy;
        });
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const supplierById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i => {
      if (q && !i.nome.toLowerCase().includes(q)) return false;
      if (showOnlyMissing && i.contagem_atual >= i.estoque_minimo) return false;
      return true;
    });
  }, [items, query, showOnlyMissing]);

  const missingCount = items.filter(i => i.contagem_atual < i.estoque_minimo).length;

  async function adjust(item: Item, delta: number) {
    const newVal = Math.max(0, item.contagem_atual + delta);
    setItems(curr => curr.map(i => i.id === item.id ? { ...i, contagem_atual: newVal } : i));
    const { error } = await supabase.from("items").update({ contagem_atual: newVal }).eq("id", item.id);
    if (error) toast.error("Erro ao salvar: " + error.message);
  }

  async function setValue(item: Item, val: number) {
    const newVal = Math.max(0, Math.floor(val));
    setItems(curr => curr.map(i => i.id === item.id ? { ...i, contagem_atual: newVal } : i));
    const { error } = await supabase.from("items").update({ contagem_atual: newVal }).eq("id", item.id);
    if (error) toast.error("Erro ao salvar: " + error.message);
  }

  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Itens</div>
          <div className="text-2xl font-bold">{items.length}</div>
        </Card>
        <Card className={cn("p-3", missingCount > 0 && "border-destructive/40")}>
          <div className="text-xs text-muted-foreground">Faltando</div>
          <div className={cn("text-2xl font-bold", missingCount > 0 && "text-destructive")}>{missingCount}</div>
        </Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar item..." className="pl-9 h-11" />
        </div>
        <Button
          variant={showOnlyMissing ? "default" : "outline"}
          onClick={() => setShowOnlyMissing(v => !v)}
          className="h-11 shrink-0"
        >
          <AlertTriangle className="h-4 w-4 mr-1" /> Faltas
        </Button>
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          {items.length === 0 ? "Nenhum item ainda. Peça pro admin cadastrar." : "Nada encontrado."}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const sup = item.supplier_id ? supplierById.get(item.supplier_id) : null;
          const falta = item.estoque_minimo - item.contagem_atual;
          const missing = falta > 0;
          return (
            <Card key={item.id} className={cn("p-3", missing && "border-destructive/40")}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{item.nome}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {sup && <Badge variant="outline" className={cn("border-0 text-[10px]", supplierBadgeClass(sup.cor))}>{sup.nome}</Badge>}
                    <span className="text-xs text-muted-foreground">mín {item.estoque_minimo}</span>
                    {missing ? (
                      <span className="text-xs text-destructive font-medium">faltam {falta}</span>
                    ) : (
                      <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/>ok</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="secondary" className="h-11 w-11 shrink-0" onClick={() => adjust(item, -1)}>
                  <Minus className="h-5 w-5" />
                </Button>
                <NumberInput value={item.contagem_atual} onCommit={v => setValue(item, v)} />
                <Button size="icon" variant="secondary" className="h-11 w-11 shrink-0" onClick={() => adjust(item, +1)}>
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              <DeltaRow onApply={delta => adjust(item, delta)} />
            </Card>

          );
        })}
      </div>
    </div>
  );
}

function NumberInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setLocal(String(value)); }, [value]);
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={local}
      onFocus={e => { focused.current = true; e.target.select(); }}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const n = parseInt(local, 10);
        if (!Number.isNaN(n) && n !== value) onCommit(n);
        else setLocal(String(value));
      }}
      className="h-11 text-center text-lg font-bold"
    />
  );
}
