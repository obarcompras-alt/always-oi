import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus, Search, CheckCircle2, Package, X } from "lucide-react";
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

export function ContagemView() {
  const sessao = useSessao();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [contagens, setContagens] = useState<Contagem[]>([]);
  const [cicloId, setCicloId] = useState<string | null>(null);
  const [unidadeUnId, setUnidadeUnId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessao) navigate({ to: "/" });
  }, [sessao, navigate]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.from("items").select("*").order("nome"),
      supabase.from("suppliers").select("*").order("nome"),
      supabase.from("contagens").select("*"),
      supabase.from("ciclos").select("id").eq("status", "aberto").limit(1).maybeSingle(),
      supabase.from("unidades_medida").select("id").eq("abreviacao", "un").maybeSingle(),
    ]).then(([it, sp, ct, ci, un]) => {
      if (!mounted) return;
      setItems(it.data ?? []);
      setSuppliers(sp.data ?? []);
      setContagens(ct.data ?? []);
      setCicloId(ci.data?.id ?? null);
      setUnidadeUnId(un.data?.id ?? null);
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

  const byItemHere = useMemo(() => {
    if (!sessao) return new Map<string, Contagem>();
    const m = new Map<string, Contagem>();
    for (const c of contagens) if (c.tipo === sessao.tipo && c.area === sessao.area) m.set(c.item_id, c);
    return m;
  }, [contagens, sessao]);

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

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return [];
    return items.filter(i => i.nome.toLowerCase().includes(q));
  }, [items, q]);

  async function upsert(item: Item, next: { unidades: number; fardos: number }) {
    if (!sessao || !cicloId) return;
    const existing = byItemHere.get(item.id);
    const payload = {
      tipo: sessao.tipo,
      area: sessao.area,
      item_id: item.id,
      ciclo_id: cicloId,
      unidades: Math.max(0, Math.floor(next.unidades)),
      fardos: Math.max(0, Math.floor(next.fardos)),
      contador_nome: sessao.nome,
    };
    setContagens(curr => {
      const idx = curr.findIndex(c => c.id === existing?.id);
      if (idx === -1) return [...curr, { ...payload, id: "tmp-" + item.id, updated_at: new Date().toISOString() } as Contagem];
      const copy = [...curr]; copy[idx] = { ...copy[idx], ...payload }; return copy;
    });
    const { error } = await supabase.from("contagens").upsert(payload, { onConflict: "ciclo_id,tipo,area,item_id" });
    if (error) toast.error("Erro ao salvar: " + error.message);
  }


  if (!sessao) return null;
  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Área</div>
          <div className="text-sm font-bold truncate">{sessao.area}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Ciclo</div>
          <div className="text-sm font-bold">{sessao.tipo === "inicio" ? "Início" : "Final"}</div>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Digite o nome do item para contar..."
          className="pl-10 pr-10 h-14 text-base"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!q && (
        <div className="text-center text-muted-foreground py-16 space-y-2">
          <Search className="h-10 w-10 mx-auto opacity-30" />
          <div className="text-sm">Comece digitando o nome do item.</div>
          <div className="text-xs">Ou toque no <b>+</b> abaixo para cadastrar um novo.</div>
        </div>
      )}

      {q && filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          Nenhum item chamado "{query}". Toque no <b>+</b> para cadastrar.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const sup = item.supplier_id ? supplierById.get(item.supplier_id) : null;
          const c = byItemHere.get(item.id);
          const unidades = c?.unidades ?? 0;
          const fardos = c?.fardos ?? 0;
          const totalTudo = totalByItem.get(item.id) ?? 0;
          const upf = Math.max(1, item.unidades_por_fardo);
          const falta = item.estoque_minimo - totalTudo;
          const missing = falta > 0;
          const temFardo = upf > 1;
          return (
            <Card key={item.id} className={cn("p-3 space-y-3", missing && "border-destructive/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{item.nome}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {sup && <Badge variant="outline" className={cn("border-0 text-[10px]", supplierBadgeClass(sup.cor))}>{sup.nome}</Badge>}
                    <span className="text-[10px] text-muted-foreground">mín {item.estoque_minimo}</span>
                    {temFardo && <span className="text-[10px] text-muted-foreground">{upf}/fardo</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("text-4xl font-bold leading-none", missing ? "text-destructive" : "text-emerald-400")}>
                    {totalTudo}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">un em estoque</div>
                  {missing ? (
                    <div className="text-[10px] text-destructive font-medium mt-0.5">faltam {falta}</div>
                  ) : (
                    <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-0.5 mt-0.5">
                      <CheckCircle2 className="h-3 w-3"/> ok
                    </div>
                  )}
                </div>
              </div>

              <UnitBlock
                value={unidades}
                onSet={v => upsert(item, { unidades: v, fardos })}
              />

              {temFardo && (
                <FardoBlock
                  currentFardos={fardos}
                  upf={upf}
                  onApply={delta => upsert(item, { unidades, fardos: Math.max(0, fardos + delta) })}
                  onSetTotal={v => upsert(item, { unidades, fardos: v })}
                />
              )}
            </Card>
          );
        })}
      </div>

      <QuickAddFab suppliers={suppliers} unidadeUnId={unidadeUnId} />
    </div>
  );
}

function UnitBlock({ value, onSet }: { value: number; onSet: (v: number) => void }) {
  return (
    <div className="rounded-md border border-border/50 p-2 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Unidades soltas nesta área</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="secondary" className="h-11 w-11 shrink-0" onClick={() => onSet(Math.max(0, value - 1))}>
          <Minus className="h-5 w-5" />
        </Button>
        <NumberInput value={value} onCommit={onSet} />
        <Button size="icon" variant="secondary" className="h-11 w-11 shrink-0" onClick={() => onSet(value + 1)}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <DeltaRow label="Achei/Tirei un:" onApply={delta => onSet(Math.max(0, value + delta))} />
    </div>
  );
}

function FardoBlock({ currentFardos, upf, onApply, onSetTotal }: { currentFardos: number; upf: number; onApply: (d: number) => void; onSetTotal: (v: number) => void }) {
  const [val, setVal] = useState("");
  function apply(sign: 1 | -1) {
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n <= 0) return;
    onApply(sign * n);
    setVal("");
  }
  return (
    <div className="rounded-md border border-primary/30 p-2 space-y-2 bg-primary/5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <Package className="h-3 w-3" /> Fardos fechados nesta área
        </div>
        <button
          type="button"
          onClick={() => {
            const v = prompt(`Definir total exato de fardos (atualmente ${currentFardos})`, String(currentFardos));
            if (v == null) return;
            const n = parseInt(v, 10);
            if (!Number.isNaN(n) && n >= 0) onSetTotal(n);
          }}
          className="text-lg font-bold hover:underline"
        >
          {currentFardos}
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Digite quantos fardos achou (ou tirou) e envie. Cada fardo = {upf} un.
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Qtd de fardos"
          value={val}
          onFocus={e => e.target.select()}
          onChange={e => setVal(e.target.value)}
          className="h-11 text-center text-lg font-bold flex-1"
        />
        <Button size="icon" variant="outline" className="h-11 w-11 shrink-0" onClick={() => apply(-1)} title="Tirar fardos">
          <Minus className="h-5 w-5" />
        </Button>
        <Button size="icon" className="h-11 w-11 shrink-0" onClick={() => apply(1)} title="Adicionar fardos">
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function QuickAddFab({ suppliers }: { suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [supplierId, setSupplierId] = useState<string>("none");
  const [minimo, setMinimo] = useState("0");
  const [fardo, setFardo] = useState("1");
  const [preco, setPreco] = useState("0");
  const [saving, setSaving] = useState(false);

  function reset() {
    setNome(""); setSupplierId("none"); setMinimo("0"); setFardo("1"); setPreco("0");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("items").insert({
      nome: nome.trim(),
      supplier_id: supplierId === "none" ? null : supplierId,
      estoque_minimo: parseInt(minimo) || 0,
      unidades_por_fardo: Math.max(1, parseInt(fardo) || 1),
      preco_unidade: Math.max(0, parseFloat(preco.replace(",", ".")) || 0),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Item criado");
    reset();
    setOpen(false);
  }

  return (
    <>
      <Button
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-40"
        aria-label="Cadastrar novo item"
      >
        <Plus className="h-6 w-6" />
      </Button>
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo item</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Heineken 600ml" required />
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem fornecedor</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Mínimo</Label>
                <Input type="number" inputMode="numeric" min={0} value={minimo} onFocus={e => e.target.select()} onChange={e => setMinimo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Un/fardo</Label>
                <Input type="number" inputMode="numeric" min={1} value={fardo} onFocus={e => e.target.select()} onChange={e => setFardo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">R$/un</Label>
                <Input type="number" inputMode="decimal" min={0} step="0.01" value={preco} onFocus={e => e.target.select()} onChange={e => setPreco(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-11" disabled={saving}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
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

function DeltaRow({ label, onApply }: { label: string; onApply: (delta: number) => void }) {
  const [val, setVal] = useState("");
  function apply(sign: 1 | -1) {
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n <= 0) return;
    onApply(sign * n);
    setVal("");
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
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
