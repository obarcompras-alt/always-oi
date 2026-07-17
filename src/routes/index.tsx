import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AREAS, type Area, type Tipo, setSessao, useSessao } from "@/lib/sessao";
import { Beer, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Welcome });

function Welcome() {
  const navigate = useNavigate();
  const sessao = useSessao();
  const [nome, setNome] = useState("");
  const [area, setArea] = useState<Area>("Estoque");
  const [tipo, setTipo] = useState<Tipo>("inicio");

  useEffect(() => {
    if (sessao) {
      setNome(sessao.nome);
      setArea(sessao.area);
      setTipo(sessao.tipo);
    }
  }, [sessao]);

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSessao({ nome: nome.trim(), area, tipo });
    navigate({ to: "/contagem" });
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center text-primary">
            <Beer className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">Contagem Bar</div>
            <div className="text-xs text-muted-foreground">Quem é você e o que vai contar?</div>
          </div>
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Seu nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João" className="h-11" required />
          </div>

          <div className="space-y-1.5">
            <Label>Área</Label>
            <div className="grid grid-cols-1 gap-2">
              {AREAS.map(a => (
                <button key={a} type="button" onClick={() => setArea(a)}
                  className={cn("h-11 rounded-md border px-3 text-sm text-left transition-colors",
                    area === a ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ciclo</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["inicio", "final"] as Tipo[]).map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={cn("h-11 rounded-md border px-3 text-sm transition-colors",
                    tipo === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                  {t === "inicio" ? "Início da semana" : "Final da semana"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">A lista de compras usa a contagem <b>final</b>.</p>
          </div>

          <Button type="submit" className="w-full h-11">
            Começar a contar <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
