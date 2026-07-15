import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SUPPLIER_COLOR_OPTIONS, supplierBadgeClass } from "./ContagemView";
import { cn } from "@/lib/utils";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];

export function GerenciarView() {
  return (
    <Tabs defaultValue="itens">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="itens">Itens</TabsTrigger>
        <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
      </TabsList>
      <TabsContent value="itens" className="mt-4"><ItensAdmin /></TabsContent>
      <TabsContent value="fornecedores" className="mt-4"><SuppliersAdmin /></TabsContent>
    </Tabs>
  );
}

function ItensAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const [{ data: it }, { data: sp }] = await Promise.all([
      supabase.from("items").select("*").order("nome"),
      supabase.from("suppliers").select("*").order("nome"),
    ]);
    setItems(it ?? []);
    setSuppliers(sp ?? []);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Item removido");
    load();
  }

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogTrigger asChild>
          <Button className="w-full h-11" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4 mr-2" /> Novo item
          </Button>
        </DialogTrigger>
        <ItemForm existing={editing} suppliers={suppliers} onSaved={() => { setOpen(false); setEditing(null); load(); }} />
      </Dialog>

      {items.length === 0 && (
        <div className="text-center text-muted-foreground py-8">Nenhum item ainda.</div>
      )}
      <div className="space-y-2">
        {items.map(i => {
          const sup = suppliers.find(s => s.id === i.supplier_id);
          return (
            <Card key={i.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{i.nome}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                    {sup && <Badge variant="outline" className={cn("border-0", supplierBadgeClass(sup.cor))}>{sup.nome}</Badge>}
                    <span>mín {i.estoque_minimo}</span>
                    <span>fardo {i.unidades_por_fardo}</span>
                    {i.preco_fardo > 0 && <span>R$ {Number(i.preco_fardo).toFixed(2)}/fardo</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover {i.nome}?</AlertDialogTitle>
                        <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(i.id)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ItemForm({ existing, suppliers, onSaved }: { existing: Item | null; suppliers: Supplier[]; onSaved: () => void }) {
  const [nome, setNome] = useState(existing?.nome ?? "");
  const [supplierId, setSupplierId] = useState<string>(existing?.supplier_id ?? "none");
  const [minimo, setMinimo] = useState(existing?.estoque_minimo ?? 0);
  const [fardo, setFardo] = useState(existing?.unidades_por_fardo ?? 1);
  const [contagem, setContagem] = useState(existing?.contagem_atual ?? 0);

  useEffect(() => {
    setNome(existing?.nome ?? "");
    setSupplierId(existing?.supplier_id ?? "none");
    setMinimo(existing?.estoque_minimo ?? 0);
    setFardo(existing?.unidades_por_fardo ?? 1);
    setContagem(existing?.contagem_atual ?? 0);
  }, [existing]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nome: nome.trim(),
      supplier_id: supplierId === "none" ? null : supplierId,
      estoque_minimo: minimo,
      unidades_por_fardo: Math.max(1, fardo),
      contagem_atual: contagem,
    };
    const { error } = existing
      ? await supabase.from("items").update(payload).eq("id", existing.id)
      : await supabase.from("items").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Item atualizado" : "Item criado");
    onSaved();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{existing ? "Editar item" : "Novo item"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={save} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} required />
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
            <Label>Mínimo</Label>
            <Input type="number" min={0} value={minimo} onChange={e => setMinimo(parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Un/fardo</Label>
            <Input type="number" min={1} value={fardo} onChange={e => setFardo(parseInt(e.target.value) || 1)} />
          </div>
          <div className="space-y-1.5">
            <Label>Contagem</Label>
            <Input type="number" min={0} value={contagem} onChange={e => setContagem(parseInt(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" className="w-full">Salvar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
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
