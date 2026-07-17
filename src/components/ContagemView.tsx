import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Minus, Plus, Search, AlertTriangle, CheckCircle2, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSessao } from "@/lib/sessao";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type Contagem = Database["public"]["Tables"]["contagens"]["Row"];

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

function totalUnidades(item: Item, c: { unidades: number; fardos: number } | undefined) {
  if (!c) return 0;
  return c.unidades + c.fardos * Math.max(1, item.unidades_por_fardo);
}

export function ContagemView() {
  const sessao = useSessao();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [contagens, setContagens] = useState<Contagem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  useEffect(() => {
    if (!sessao) navigate({ to: "/" });
  }, [sessao, navigate]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.from("items").select("*").order("nome"),
      supabase.from("suppliers").select("*").order("nome"),
      supabase.from("contagens").select("*"),
    ]).then(([it, sp, ct]) => {
      if (!mounted) return;
      setItems(it.data ?? []);
      setSuppliers(sp.data ?? []);
      setContagens(ct.data ?? []);
      setLoading(false);
    });

    const ch = supabase.channel("contagens-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "contagens" }, payload => {
        setContagens(curr => {
          if (payload.eventType === "DELETE") return curr.filter(c => c.id !== (payload.old as Contagem).id);
          const row = payload.new as Contagem;
          const idx = curr.findIndex(c => c.id === row.id);
          if (idx === -1) return [...curr, row];
          const copy = [...curr]; copy[idx] = row; return copy;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => {
        supabase.from("items").select("*").order("nome").then(({ data }) => data && setItems(data));
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const supplierById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  // contagem da sessão atual (tipo + área) por item
  const byItemHere = useMemo(() => {
    if (!sessao) return new Map<string, Contagem>();
    const m = new Map<string, Contagem>();
    for (const c of contagens) if (c.tipo === sessao.tipo && c.area === sessao.area) m.set(c.item_id, c);
    return m;
  }, [contagens, sessao]);

  // estoque atual total (todas as áreas) do mesmo tipo — mostra o "consolidado"
  const totalByItem = useMemo(() => {
    if (!sessao) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const item of items) {
      let sum = 0;
      for (const c of contagens) {
        if (c.item_id === item.id && c.tipo === sessao.tipo) {
          sum += c.unidades + c.fardos * Math.max(1, item.unidades_por_fardo);
        }
      }
      m.set(item.id, sum);
    }
    return m;
  }, [contagens, items, sessao]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i => {
      if (q && !i.nome.toLowerCase().includes(q)) return false;
      if (showOnlyMissing && (totalByItem.get(i.id) ?? 0) >= i.estoque_minimo) return false;
      return true;
    });
  }, [items, query, showOnlyMissing, totalByItem]);

  const missingCount = items.filter(i => (totalByItem.get(i.id) ?? 0) < i.estoque_minimo).length;

  async function upsert(item: Item, next: { unidades: number; fardos: number }) {
    if (!sessao) return;
    const existing = byItemHere.get(item.id);
    const payload = {
      tipo: sessao.tipo,
      area: sessao.area,
      item_id: item.id,
      unidades: Math.max(0, Math.floor(next.unidades)),
      fardos: Math.max(0, Math.floor(next.fardos)),
      contador_nome: sessao.nome,
    };
    // optimistic
    setContagens(curr => {
      const idx = curr.findIndex(c => c.id === existing?.id);
      if (idx === -1) return [...curr, { ...payload, id: "tmp-" + item.id, updated_at: new Date().toISOString() } as Contagem];
      const copy = [...curr]; copy[idx] = { ...copy[idx], ...payload }; return copy;
    });
    const { error } = await supabase.from("contagens").upsert(payload, { onConflict: "tipo,area,item_id" });
    if (error) toast.error("Erro ao salvar: " + error.message);
  }

  if (!sessao) return null;
  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Área</div>
          <div className="text-sm font-bold truncate">{sessao.area}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Ciclo</div>
          <div className="text-sm font-bold">{sessao.tipo === "inicio" ? "Início" : "Final"}</div>
        </Card>
        <Card className={cn("p-3", missingCount > 0 && "border-destructive/40")}>
          <div className="text-xs text-muted-foreground">Faltando</div>
          <div className={cn("text-sm font-bold", missingCount > 0 && "text-destructive")}>{missingCount}</div>
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
          {items.length === 0 ? "Nenhum item ainda. Cadastre em Gerenciar." : "Nada encontrado."}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const sup = item.supplier_id ? supplierById.get(item.supplier_id) : null;
          const c = byItemHere.get(item.id);
          const unidades = c?.unidades ?? 0;
          const fardos = c?.fardos ?? 0;
          const totalTudo = totalByItem.get(item.id) ?? 0;
          const totalAqui = totalUnidades(item, c);
          const falta = item.estoque_minimo - totalTudo;
          const missing = falta > 0;
          const temFardo = item.unidades_por_fardo > 1;
          return (
            <Card key={item.id} className={cn("p-3 space-y-3", missing && "border-destructive/40")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{item.nome}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {sup && <Badge variant="outline" className={cn("border-0 text-[10px]", supplierBadgeClass(sup.cor))}>{sup.nome}</Badge>}
                    <span className="text-xs text-muted-foreground">mín {item.estoque_minimo}</span>
                    {temFardo && <span className="text-xs text-muted-foreground">{item.unidades_por_fardo}/fardo</span>}
                    {missing ? (
                      <span className="text-xs text-destructive font-medium">faltam {falta}</span>
                    ) : (
                      <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/>ok</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Estoque total (todas as áreas): <b className="text-foreground">{totalTudo}</b>
                    {totalAqui !== totalTudo && <> · aqui: <b className="text-foreground">{totalAqui}</b></>}
                  </div>
                </div>
              </div>

              <CounterBlock
                label="Unidades soltas"
                icon={<Plus className="h-4 w-4" />}
                value={unidades}
                onSet={v => upsert(item, { unidades: v, fardos })}
              />

              {temFardo && (
                <CounterBlock
                  label={`Fardos fechados (${item.unidades_por_fardo} un)`}
                  icon={<Package className="h-4 w-4" />}
                  value={fardos}
                  onSet={v => upsert(item, { unidades, fardos: v })}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CounterBlock({ label, value, onSet }: { label: string; icon: React.ReactNode; value: number; onSet: (v: number) => void }) {
  return (
    <div className="rounded-md border border-border/50 p-2 space-y-2 bg-muted/20">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="secondary" className="h-11 w-11 shrink-0" onClick={() => onSet(Math.max(0, value - 1))}>
          <Minus className="h-5 w-5" />
        </Button>
        <NumberInput value={value} onCommit={onSet} />
        <Button size="icon" variant="secondary" className="h-11 w-11 shrink-0" onClick={() => onSet(value + 1)}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <DeltaRow onApply={delta => onSet(Math.max(0, value + delta))} />
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

function DeltaRow({ onApply }: { onApply: (delta: number) => void }) {
  const [val, setVal] = useState("");
  function apply(sign: 1 | -1) {
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n <= 0) return;
    onApply(sign * n);
    setVal("");
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground shrink-0">Achei/Tirei:</span>
      <Input
        type="number"
        inputMode="numeric"
        placeholder="0"
        value={val}
        onFocus={e => e.target.select()}
        onChange={e => setVal(e.target.value)}
        className="h-9 text-center flex-1"
      />
      <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => apply(-1)}>
        <Minus className="h-4 w-4" />
      </Button>
      <Button size="sm" className="h-9 px-3" onClick={() => apply(1)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
