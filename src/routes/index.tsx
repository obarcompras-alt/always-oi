import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ContagemView } from "@/components/ContagemView";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <ContagemView />
    </AppShell>
  );
}
