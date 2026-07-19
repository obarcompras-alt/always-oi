import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ReactNode, useEffect } from "react";
import { Beer, ListChecks, ShoppingCart, Settings, LogOut, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessao, setSessao } from "@/lib/sessao";
import { signOut, useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const sessao = useSessao();
  const { user, nome, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const tabs = [
    { to: "/dashboard", label: "Estoque", icon: LayoutDashboard },
    { to: "/contagem", label: "Contagem", icon: ListChecks },
    { to: "/compras", label: "Compras", icon: ShoppingCart },
    { to: "/gerenciar", label: "Gerenciar", icon: Settings },
  ];

  function trocar() {
    setSessao(null);
    navigate({ to: "/" });
  }

  async function sair() {
    await signOut();
    setSessao(null);
    navigate({ to: "/auth" });
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/15 grid place-items-center text-primary shrink-0">
              <Beer className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight truncate">Contagem Bar</div>
              {sessao ? (
                <div className="text-[10px] text-muted-foreground truncate">
                  {sessao.nome} · {sessao.area} · {sessao.tipo === "inicio" ? "início" : "final"}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground truncate">{nome}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {sessao && (
              <Button size="sm" variant="ghost" onClick={trocar} className="h-8 px-2 text-xs">
                Trocar área
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={sair} className="h-8 px-2 text-xs">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-3xl w-full p-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur z-20">
        <div className="mx-auto max-w-3xl grid grid-cols-4">
          {tabs.map(t => {
            const active = pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-16 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
