import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Beer } from "lucide-react";
import { toast } from "sonner";
import { signIn, signUp, useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "cadastro">("login");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || senha.length < 4) {
      toast.error("Preencha nome e senha (mín. 4 caracteres).");
      return;
    }
    setBusy(true);
    const { error } = mode === "login" ? await signIn(nome, senha) : await signUp(nome, senha);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "login" ? "Bem-vindo!" : "Conta criada!");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center text-primary">
            <Beer className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">Contagem Bar</div>
            <div className="text-xs text-muted-foreground">
              {mode === "login" ? "Entrar na sua conta" : "Criar conta"}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: João"
              autoComplete="username"
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="h-11"
              required
              minLength={4}
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={busy}>
            {busy ? "..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "cadastro" : "login")}
            className="text-primary font-medium hover:underline"
          >
            {mode === "login" ? "Cadastrar" : "Entrar"}
          </button>
        </div>
      </Card>
    </div>
  );
}
