import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GerenciarView } from "@/components/GerenciarView";

export const Route = createFileRoute("/gerenciar")({
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <GerenciarView />
    </AppShell>
  );
}
