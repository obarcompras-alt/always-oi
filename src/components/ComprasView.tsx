import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ShoppingCart, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supplierBadgeClass } from "./ContagemView";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type Contagem = Database["public"]["Tables"]["contagens"]["Row"];

interface Line {
  item: Item;
  faltamUnidades: number;
  fardos: number;
  custo: number;
  totalAtual: number;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ComprasView() {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [contagens, setContagens] = useState<Contagem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [it, sp, ct] = await Promise.all([
      supabase.from("items").select("*").order("nome"),
      supabase.from("suppliers").select("*").order("nome"),
      supabase.from("contagens").select("*").eq("tipo", "final"),
    ]);
    setItems(it.data ?? []);
    setSuppliers(sp.data ?? []);
    setContagens(ct.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("compras-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "contagens" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const grupos = useMemo(() => {
    const totalByItem = new Map<string, number>();
    for (const item of items) {
      let sum = 0;
      for (const c of contagens) {
        if (c.item_id === item.id) sum += c.unidades + c.fardos * Math.max(1, item.unidades_por_fardo);
      }
      totalByItem.set(item.id, sum);
    }

    const semFornecedor: Line[] = [];
    const bySup = new Map<string, Line[]>();
    for (const item of items) {
      const totalAtual = totalByItem.get(item.id) ?? 0;
      const falta = Math.max(0, item.estoque_minimo - totalAtual);
      if (falta <= 0) continue;
      const upf = Math.max(1, item.unidades_por_fardo);
      const fardos = Math.ceil(falta / upf);
      const custo = falta * Number(item.preco_unidade || 0);
      const line: Line = { item, faltamUnidades: falta, fardos, custo, totalAtual };
      if (item.supplier_id) {
        const arr = bySup.get(item.supplier_id) ?? [];
        arr.push(line); bySup.set(item.supplier_id, arr);
      } else semFornecedor.push(line);
    }
    const grupos = suppliers
      .filter(s => bySup.has(s.id))
      .map(s => ({ supplier: s, lines: bySup.get(s.id)! }));
    if (semFornecedor.length) grupos.push({ supplier: { id: "none", nome: "Sem fornecedor", cor: "slate", created_at: "" } as Supplier, lines: semFornecedor });
    return grupos;
  }, [items, suppliers, contagens]);

  const totalCusto = grupos.reduce((a, g) => a + g.lines.reduce((x, l) => x + l.custo, 0), 0);
  const temContagemFinal = contagens.length > 0;

  function formatLine(l: Line) {
    const upf = Math.max(1, l.item.unidades_por_fardo);
    const partes: string[] = [];
    if (upf > 1) partes.push(`${l.fardos} fardo${l.fardos > 1 ? "s" : ""} (${l.faltamUnidades} un)`);
    else partes.push(`${l.faltamUnidades} un`);
    let s = `${partes.join(" ")} de ${l.item.nome}`;
    if (l.custo > 0) s += ` — ~${brl(l.custo)}`;
    return s;
  }

  function copyGroup(g: { supplier: Supplier; lines: Line[] }) {
    const subtotal = g.lines.reduce((x, l) => x + l.custo, 0);
    const header = subtotal > 0 ? `*${g.supplier.nome}* (~${brl(subtotal)})` : `*${g.supplier.nome}*`;
    const text = header + "\n" + g.lines.map(l => `• ${formatLine(l)}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`Lista de ${g.supplier.nome} copiada`);
  }
  function copyAll() {
    const body = grupos.map(g => {
      const subtotal = g.lines.reduce((x, l) => x + l.custo, 0);
      const header = subtotal > 0 ? `*${g.supplier.nome}* (~${brl(subtotal)})` : `*${g.supplier.nome}*`;
      return header + "\n" + g.lines.map(l => `• ${formatLine(l)}`).join("\n");
    }).join("\n\n");
    const footer = totalCusto > 0 ? `\n\n*Total estimado:* ${brl(totalCusto)}` : "";
    navigator.clipboard.writeText(body + footer);
    toast.success("Lista completa copiada");
  }

  async function zerarCiclo() {
    const { error } = await supabase.from("contagens").delete().eq("tipo", "final");
    if (error) return toast.error(error.message);
    toast.success("Contagem final zerada. Pronto pro próximo ciclo.");
    load();
  }

  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Fornecedores</div>
          <div className="text-2xl font-bold">{grupos.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Itens</div>
          <div className="text-2xl font-bold">{grupos.reduce((a,g)=>a+g.lines.length,0)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Custo ~</div>
          <div className="text-2xl font-bold">{brl(totalCusto)}</div>
        </Card>
      </div>

      {!temContagemFinal && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5 text-sm">
          Nenhuma contagem <b>final</b> registrada ainda. Faça a contagem final nas 3 áreas para gerar a lista.
        </Card>
      )}

      {grupos.length > 0 && (
        <Button className="w-full h-11" onClick={copyAll}>
          <Copy className="h-4 w-4 mr-2" /> Copiar lista completa
        </Button>
      )}

      {grupos.length === 0 && temContagemFinal && (
        <div className="text-center text-muted-foreground py-16">
          <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Estoque em dia. Nada a comprar.
        </div>
      )}

      <div className="space-y-3">
        {grupos.map(g => {
          const subtotal = g.lines.reduce((x, l) => x + l.custo, 0);
          return (
          <Card key={g.supplier.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("border-0", supplierBadgeClass(g.supplier.cor))}>
                  {g.supplier.nome}
                </Badge>
                {subtotal > 0 && <span className="text-xs font-semibold text-primary">~{brl(subtotal)}</span>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => copyGroup(g)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            </div>
            <ul className="space-y-2">
              {g.lines.map(l => {
                const upf = Math.max(1, l.item.unidades_por_fardo);
                return (
                  <li key={l.item.id} className="flex items-start justify-between text-sm gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{l.item.nome}</div>
                      <div className="text-[11px] text-muted-foreground">
                        tem {l.totalAtual} · mín {l.item.estoque_minimo}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-bold text-primary text-sm">
                        {upf > 1 ? `${l.fardos} fardo${l.fardos>1?"s":""}` : `${l.faltamUnidades} un`}
                      </span>
                      {l.custo > 0 && <span className="text-[11px] text-muted-foreground">~{brl(l.custo)}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          );
        })}
      </div>

      {temContagemFinal && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full h-11 mt-4">
              <RotateCcw className="h-4 w-4 mr-2" /> Zerar contagem final (novo ciclo)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zerar contagem final?</AlertDialogTitle>
              <AlertDialogDescription>
                Apaga toda a contagem final das 3 áreas. Use depois de comprar. As contagens de <b>início</b> ficam intactas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={zerarCiclo}>Zerar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
