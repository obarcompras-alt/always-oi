import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supplierBadgeClass } from "./ContagemView";
import { cn } from "@/lib/utils";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];

interface Line {
  item: Item;
  unidades: number;
  fardos: number;
}

export function ComprasView() {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

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
    const ch = supabase.channel("compras-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => {
        supabase.from("items").select("*").order("nome").then(({ data }) => data && setItems(data));
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const grupos = useMemo(() => {
    const semFornecedor: Line[] = [];
    const bySup = new Map<string, Line[]>();
    for (const item of items) {
      const falta = Math.max(0, item.estoque_minimo - item.contagem_atual);
      if (falta <= 0) continue;
      const fardos = Math.ceil(falta / Math.max(1, item.unidades_por_fardo));
      const line: Line = { item, unidades: falta, fardos };
      if (item.supplier_id) {
        const arr = bySup.get(item.supplier_id) ?? [];
        arr.push(line);
        bySup.set(item.supplier_id, arr);
      } else {
        semFornecedor.push(line);
      }
    }
    const grupos = suppliers
      .filter(s => bySup.has(s.id))
      .map(s => ({ supplier: s, lines: bySup.get(s.id)! }));
    if (semFornecedor.length) grupos.push({ supplier: { id: "none", nome: "Sem fornecedor", cor: "slate", created_at: "" } as Supplier, lines: semFornecedor });
    return grupos;
  }, [items, suppliers]);

  const totalFardos = grupos.reduce((a, g) => a + g.lines.reduce((x, l) => x + l.fardos, 0), 0);

  function formatLine(l: Line) {
    return `${l.fardos} fardo${l.fardos > 1 ? "s" : ""} de ${l.item.nome}`;
  }

  function copyGroup(g: { supplier: Supplier; lines: Line[] }) {
    const text = `*${g.supplier.nome}*\n` + g.lines.map(l => `• ${formatLine(l)}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`Lista de ${g.supplier.nome} copiada`);
  }
  function copyAll() {
    const text = grupos.map(g => `*${g.supplier.nome}*\n` + g.lines.map(l => `• ${formatLine(l)}`).join("\n")).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Lista completa copiada");
  }

  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Fornecedores</div>
          <div className="text-2xl font-bold">{grupos.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total fardos</div>
          <div className="text-2xl font-bold">{totalFardos}</div>
        </Card>
      </div>

      {grupos.length > 0 && (
        <Button className="w-full h-11" onClick={copyAll}>
          <Copy className="h-4 w-4 mr-2" /> Copiar lista completa
        </Button>
      )}

      {grupos.length === 0 && (
        <div className="text-center text-muted-foreground py-16">
          <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Estoque em dia. Nada a comprar.
        </div>
      )}

      <div className="space-y-3">
        {grupos.map(g => (
          <Card key={g.supplier.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("border-0", supplierBadgeClass(g.supplier.cor))}>
                  {g.supplier.nome}
                </Badge>
                <span className="text-xs text-muted-foreground">{g.lines.reduce((a,l)=>a+l.fardos,0)} fardos</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => copyGroup(g)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            </div>
            <ul className="space-y-2">
              {g.lines.map(l => (
                <li key={l.item.id} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 truncate pr-2">{l.item.nome}</span>
                  <span className="font-bold text-primary shrink-0">{l.fardos} fardo{l.fardos>1?"s":""}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
