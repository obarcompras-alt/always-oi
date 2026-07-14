import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { GerenciarView } from "@/components/GerenciarView";

export const Route = createFileRoute("/gerenciar")({
  component: Page,
});

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: rl } = useIsAdmin(user?.id);
  if (loading || rl) return null;
  if (!user) return <Navigate to="/auth" />;
  if (!isAdmin) return <Navigate to="/" />;
  return (
    <AppShell>
      <GerenciarView />
    </AppShell>
  );
}
