import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, ShoppingCart, RotateCcw, Minus, Plus, X, Eye } from "lucide-react";
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
  sugerido: number; // faltam em unidades (sugestão automática)
  qty: number;      // quantidade final a comprar em unidades (após edição)
  fardos: number;
  custo: number;
  totalAtual: number;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const LS_QTY = "compras_qty_v1";
const LS_HIDDEN = "compras_hidden_v1";

export function ComprasView() {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [contagens, setContagens] = useState<Contagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qtyOverride, setQtyOverride] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(LS_QTY) || "{}"); } catch { return {}; }
  });
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(LS_HIDDEN) || "[]")); } catch { return new Set(); }
  });

  useEffect(() => { localStorage.setItem(LS_QTY, JSON.stringify(qtyOverride)); }, [qtyOverride]);
  useEffect(() => { localStorage.setItem(LS_HIDDEN, JSON.stringify([...hidden])); }, [hidden]);

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

  function setQty(itemId: string, qty: number) {
    setQtyOverride(o => ({ ...o, [itemId]: Math.max(0, Math.floor(qty)) }));
  }
  function clearQty(itemId: string) {
    setQtyOverride(o => { const n = { ...o }; delete n[itemId]; return n; });
  }
  function hide(itemId: string) {
    setHidden(h => new Set([...h, itemId]));
  }
  function unhide(itemId: string) {
    setHidden(h => { const n = new Set(h); n.delete(itemId); return n; });
  }
  function resetAll() {
    setQtyOverride({});
    setHidden(new Set());
    toast.success("Ajustes limpos");
  }

  const { grupos, ocultos } = useMemo(() => {
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
    const ocultos: { item: Item; supplier: Supplier | null }[] = [];
    const supById = new Map(suppliers.map(s => [s.id, s]));

    for (const item of items) {
      const totalAtual = totalByItem.get(item.id) ?? 0;
      const sugerido = Math.max(0, item.estoque_minimo - totalAtual);
      const qty = qtyOverride[item.id] ?? sugerido;
      if (hidden.has(item.id)) {
        if (sugerido > 0) ocultos.push({ item, supplier: item.supplier_id ? supById.get(item.supplier_id) ?? null : null });
        continue;
      }
      if (qty <= 0) continue;
      const upf = Math.max(1, item.unidades_por_fardo);
      const fardos = Math.ceil(qty / upf);
      const custo = qty * Number(item.preco_unidade || 0);
      const line: Line = { item, sugerido, qty, fardos, custo, totalAtual };
      if (item.supplier_id) {
        const arr = bySup.get(item.supplier_id) ?? [];
        arr.push(line); bySup.set(item.supplier_id, arr);
      } else semFornecedor.push(line);
    }
    const grupos = suppliers
      .filter(s => bySup.has(s.id))
      .map(s => ({ supplier: s, lines: bySup.get(s.id)! }));
    if (semFornecedor.length) grupos.push({ supplier: { id: "none", nome: "Sem fornecedor", cor: "slate", created_at: "" } as Supplier, lines: semFornecedor });
    return { grupos, ocultos };
  }, [items, suppliers, contagens, qtyOverride, hidden]);

  const totalCusto = grupos.reduce((a, g) => a + g.lines.reduce((x, l) => x + l.custo, 0), 0);
  const temContagemFinal = contagens.length > 0;

  function formatLine(l: Line) {
    const upf = Math.max(1, l.item.unidades_por_fardo);
    const partes: string[] = [];
    if (upf > 1) partes.push(`${l.fardos} fardo${l.fardos > 1 ? "s" : ""} (${l.qty} un)`);
    else partes.push(`${l.qty} un`);
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
    setQtyOverride({});
    setHidden(new Set());
    toast.success("Contagem final zerada. Pronto pro próximo ciclo.");
    load();
  }

  if (loading) return <div className="text-center text-muted-foreground py-12">Carregando...</div>;

  const temAjustes = Object.keys(qtyOverride).length > 0 || hidden.size > 0;

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
        <div className="flex gap-2">
          <Button className="flex-1 h-11" onClick={copyAll}>
            <Copy className="h-4 w-4 mr-2" /> Copiar lista completa
          </Button>
          {temAjustes && (
            <Button variant="outline" className="h-11" onClick={resetAll} title="Restaurar sugestões automáticas">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
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
            <ul className="space-y-3">
              {g.lines.map(l => {
                const upf = Math.max(1, l.item.unidades_por_fardo);
                const editado = qtyOverride[l.item.id] != null && qtyOverride[l.item.id] !== l.sugerido;
                return (
                  <li key={l.item.id} className="space-y-1.5 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{l.item.nome}</div>
                        <div className="text-[11px] text-muted-foreground">
                          tem {l.totalAtual} · mín {l.item.estoque_minimo} · sugerido {l.sugerido} un
                          {editado && <> · <span className="text-primary">editado</span></>}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => hide(l.item.id)} title="Remover da lista">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="secondary" className="h-9 w-9 shrink-0" onClick={() => setQty(l.item.id, l.qty - 1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={l.qty}
                        onFocus={e => e.target.select()}
                        onChange={e => setQty(l.item.id, parseInt(e.target.value) || 0)}
                        className="h-9 text-center font-bold flex-1"
                      />
                      <Button size="icon" variant="secondary" className="h-9 w-9 shrink-0" onClick={() => setQty(l.item.id, l.qty + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <div className="w-20 text-right shrink-0">
                        <div className="text-xs font-bold text-primary">
                          {upf > 1 ? `${l.fardos} fardo${l.fardos>1?"s":""}` : `${l.qty} un`}
                        </div>
                        {l.custo > 0 && <div className="text-[10px] text-muted-foreground">~{brl(l.custo)}</div>}
                      </div>
                    </div>
                    {editado && (
                      <button type="button" onClick={() => clearQty(l.item.id)} className="text-[10px] text-muted-foreground hover:text-foreground underline">
                        restaurar sugestão ({l.sugerido} un)
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          );
        })}
      </div>

      {ocultos.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Removidos da lista ({ocultos.length})</div>
          <div className="space-y-1.5">
            {ocultos.map(o => (
              <div key={o.item.id} className="flex items-center justify-between text-sm gap-2">
                <span className="truncate text-muted-foreground">{o.item.nome}</span>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => unhide(o.item.id)}>
                  <Eye className="h-3 w-3 mr-1" /> Restaurar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

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
                Apaga toda a contagem final das 3 áreas e limpa os ajustes da lista. Use depois de comprar. As contagens de <b>início</b> ficam intactas.
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
