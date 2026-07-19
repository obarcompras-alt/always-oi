import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { DashboardView } from "@/components/DashboardView";

export const Route = createFileRoute("/dashboard")({ component: Page });

function Page() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
