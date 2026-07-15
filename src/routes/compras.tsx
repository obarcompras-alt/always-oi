import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ComprasView } from "@/components/ComprasView";

export const Route = createFileRoute("/compras")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <ComprasView />
    </AppShell>
  );
}
