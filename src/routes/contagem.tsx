import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ContagemView } from "@/components/ContagemView";

export const Route = createFileRoute("/contagem")({ component: Page });

function Page() {
  return (
    <AppShell>
      <ContagemView />
    </AppShell>
  );
}
