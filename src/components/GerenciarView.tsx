import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import { SUPPLIER_COLOR_OPTIONS, supplierBadgeClass } from "./ContagemView";
import { cn } from "@/lib/utils";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type Contagem = Database["public"]["Tables"]["contagens"]["Row"];

export function GerenciarView() {
  return (
    <Tabs defaultValue="fornecedores">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
        <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
      </TabsList>
      <TabsContent value="fornecedores" className="mt-4"><SuppliersAdmin /></TabsContent>
      <TabsContent value="relatorios" className="mt-4"><Relatorios /></TabsContent>
    </Tabs>
  );
}

function SuppliersAdmin() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("slate");

  async function load() {
    const { data } = await supabase.from("suppliers").select("*").order("nome");
    setSuppliers(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const { error } = await supabase.from("suppliers").insert({ nome: nome.trim(), cor });
    if (error) return toast.error(error.message);
    setNome(""); setCor("slate");
    load();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={add} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do fornecedor</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Giuliard" />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {SUPPLIER_COLOR_OPTIONS.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={cn("h-9 px-3 rounded-md text-xs border", supplierBadgeClass(c),
                    cor === c ? "ring-2 ring-primary" : "border-transparent")}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full"><Plus className="h-4 w-4 mr-2" />Adicionar</Button>
        </form>
      </Card>

      <div className="space-y-2">
        {suppliers.map(s => (
          <Card key={s.id} className="p-3 flex items-center justify-between">
            <Badge variant="outline" className={cn("border-0", supplierBadgeClass(s.cor))}>{s.nome}</Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover {s.nome}?</AlertDialogTitle>
                  <AlertDialogDescription>Itens desse fornecedor ficarão sem fornecedor.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove(s.id)}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface Row {
  item: Item;
  supplier: Supplier | null;
  inicio: number;
  final: number;
  consumo: number;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Relatorios() {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [contagens, setContagens] = useState<Contagem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("items").select("*").order("nome"),
      supabase.from("suppliers").select("*").order("nome"),
      supabase.from("contagens").select("*"),
    ]).then(([it, sp, ct]) => {
      setItems(it.data ?? []);
      setSuppliers(sp.data ?? []);
      setContagens(ct.data ?? []);
      setLoading(false);
    });
  }, []);

  const rows: Row[] = useMemo(() => {
    const supById = new Map(suppliers.map(s => [s.id, s]));
    return items.map(item => {
      const upf = Math.max(1, item.unidades_por_fardo);
      let inicio = 0, final = 0;
      for (const c of contagens) {
        if (c.item_id !== item.id) continue;
        const total = c.unidades + c.fardos * upf;
        if (c.tipo === "inicio") inicio += total;
        else final += total;
      }
      const consumo = Math.max(0, inicio - final);
      return { item, supplier: item.supplier_id ? supById.get(item.supplier_id) ?? null : null, inicio, final, consumo };
    });
  }, [items, suppliers, contagens]);

  const totalConsumoValor = rows.reduce((a, r) => a + r.consumo * Number(r.item.preco_unidade || 0), 0);

  function copyRelatorio() {
    const lines = ["*Relatório de contagem*", ""];
    const bySup = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.supplier?.nome ?? "Sem fornecedor";
      const arr = bySup.get(key) ?? [];
      arr.push(r); bySup.set(key, arr);
    }
    for (const [sup, rs] of bySup) {
      lines.push(`*${sup}*`);
      for (const r of rs) {
        const custo = r.consumo * Number(r.item.preco_unidade || 0);
        const suffix = custo > 0 ? ` — ~${brl(custo)}` : "";
        lines.push(`• ${r.item.nome}: início ${r.inicio} · final ${r.final} · consumo ${r.consumo}${suffix}`);
      }
      lines.push("");
    }
    if (totalConsumoValor > 0) lines.push(`*Consumo total estimado:* ${brl(totalConsumoValor)}`);
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Relatório copiado");
  }

  if (loading) return <div className="text-center text-muted-foreground py-8">Carregando...</div>;
  if (items.length === 0) return <div className="text-center text-muted-foreground py-8">Nenhum item cadastrado.</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Itens</div>
          <div className="text-2xl font-bold">{rows.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Consumo ~</div>
          <div className="text-2xl font-bold">{brl(totalConsumoValor)}</div>
        </Card>
      </div>

      <Button className="w-full h-11" onClick={copyRelatorio}>
        <Copy className="h-4 w-4 mr-2" /> Copiar relatório completo
      </Button>

      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
          <FileText className="h-4 w-4" /> Consumo por item
        </div>
        <div className="space-y-2">
          {rows.map(r => {
            const custo = r.consumo * Number(r.item.preco_unidade || 0);
            return (
              <div key={r.item.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.item.nome}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.supplier?.nome ?? "sem fornecedor"} · início {r.inicio} · final {r.final}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{r.consumo}</div>
                  {custo > 0 && <div className="text-[11px] text-muted-foreground">~{brl(custo)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
