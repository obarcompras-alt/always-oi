import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { Beer, ListChecks, ShoppingCart, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const tabs = [
    { to: "/", label: "Contagem", icon: ListChecks },
    { to: "/compras", label: "Compras", icon: ShoppingCart },
    ...(isAdmin ? [{ to: "/gerenciar", label: "Gerenciar", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 grid place-items-center text-primary">
              <Beer className="h-4 w-4" />
            </div>
            <span className="font-bold">Contagem Bar</span>
          </div>
          <button onClick={logout} className="text-muted-foreground hover:text-foreground p-2 -mr-2" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-4 pb-24">
        {children}
      </main>
      <nav className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur z-20 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-3xl grid grid-cols-3">
          {tabs.map(t => {
            const active = pathname === t.to;
            const Icon = t.icon;
            return (
              <Link key={t.to} to={t.to}
                className={cn("flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
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
