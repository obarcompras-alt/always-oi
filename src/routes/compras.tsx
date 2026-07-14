import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { ComprasView } from "@/components/ComprasView";

export const Route = createFileRoute("/compras")({
  component: Page,
});

function Page() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" />;
  return (
    <AppShell>
      <ComprasView />
    </AppShell>
  );
}
