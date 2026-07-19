import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, AlertTriangle, CheckCircle2, Package, TrendingDown } from "lucide-react";
import { supplierBadgeClass } from "./ContagemView";
import { cn } from "@/lib/utils";
import { AREAS } from "@/lib/sessao";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type Contagem = Database["public"]["Tables"]["contagens"]["Row"];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DashboardView() {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [contagens, setContagens] = useState<Contagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<"inicio" | "final">("final");
  const [onlyMissing, setOnlyMissing] = useState(false);

  async function load() {
    const [it, sp, ct] = await Promise.all([
      supabase.from("items").select("*").order("nome"),
      supabase.from("suppliers").select("*").order("nome"),
      supabase.from("contagens").select("*"),
    ]);
    setItems(it.data ?? []);
    setSuppliers(sp.data ?? []);
    setContagens(ct.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("dash-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "contagens" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const supById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const rows = useMemo(() => {
    return items.map(item => {
      const upf = Math.max(1, item.unidades_por_fardo);
      const porArea: Record<string, number> = {};
      let total = 0;
      for (const a of AREAS) porArea[a] = 0;
      for (const c of contagens) {
        if (c.item_id !== item.id || c.tipo !== tipo) continue;
        const u = c.unidades + c.fardos * upf;
        porArea[c.area] = (porArea[c.area] ?? 0) + u;
        total += u;
      }
      const falta = Math.max(0, item.estoque_minimo - total);
      const valorEstoque = total * Number(item.preco_unidade || 0);
      return { item, upf, porArea, total, falta, valorEstoque };
    });
  }, [items, contagens, tipo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.item.nome.toLowerCase().includes(q)) return false;
      if (onlyMissing && r.falta === 0) return false;
      return true;
    });
  }, [rows, query, onlyMissing]);

  const totalItens = rows.length;
  const totalFaltando = rows.filter(r => r.falta > 0).length;
  const totalUnidades = rows.reduce((a, r) => a + r.total, 0);
  const totalValor = rows.reduce((a, r) => a + r.valorEstoque, 0);

  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Itens cadastrados</div>
          <div className="text-2xl font-bold">{totalItens}</div>
        </Card>
        <Card className={cn("p-3", totalFaltando > 0 && "border-destructive/40")}>
          <div className="text-xs text-muted-foreground">Faltando</div>
          <div className={cn("text-2xl font-bold", totalFaltando > 0 && "text-destructive")}>{totalFaltando}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Unidades em estoque</div>
          <div className="text-2xl font-bold">{totalUnidades}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Valor estimado</div>
          <div className="text-2xl font-bold">{brl(totalValor)}</div>
        </Card>
      </div>

      <div className="flex gap-2">
        {(["inicio", "final"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={cn(
              "flex-1 h-10 rounded-md border text-sm font-medium transition-colors",
              tipo === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {t === "inicio" ? "Início" : "Final"}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar item..." className="pl-9 h-11" />
        </div>
        <Button
          variant={onlyMissing ? "default" : "outline"}
          onClick={() => setOnlyMissing(v => !v)}
          className="h-11 shrink-0"
        >
          <AlertTriangle className="h-4 w-4 mr-1" /> Faltas
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            {rows.length === 0 ? "Nenhum item cadastrado." : "Nada encontrado."}
          </div>
        )}
        {filtered.map(r => {
          const sup = r.item.supplier_id ? supById.get(r.item.supplier_id) : null;
          const missing = r.falta > 0;
          return (
            <Card key={r.item.id} className={cn("p-3", missing && "border-destructive/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{r.item.nome}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {sup && <Badge variant="outline" className={cn("border-0 text-[10px]", supplierBadgeClass(sup.cor))}>{sup.nome}</Badge>}
                    <span className="text-[10px] text-muted-foreground">mín {r.item.estoque_minimo}</span>
                    {r.upf > 1 && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3"/>{r.upf}/fardo</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("text-3xl font-bold leading-none", missing ? "text-destructive" : "text-foreground")}>
                    {r.total}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">un total</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mt-3">
                {AREAS.map(a => (
                  <div key={a} className="rounded-md bg-muted/40 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground truncate">{a}</div>
                    <div className="text-sm font-bold">{r.porArea[a] ?? 0}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-2 text-[11px]">
                {missing ? (
                  <span className="text-destructive font-medium flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" /> faltam {r.falta} un
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> em dia
                  </span>
                )}
                {r.valorEstoque > 0 && <span className="text-muted-foreground">~{brl(r.valorEstoque)}</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
