import { EngineSimulator } from "@/features/knowledge/components/engine-simulator";
import { KnowledgeShell } from "@/features/knowledge/components/knowledge-shell";
import { getRequestLocale } from "@/lib/request-locale";
export const metadata = { title: "Engine Simulator" };
export default async function SimulatorPage() {
  const locale = await getRequestLocale();
  return (
    <KnowledgeShell locale={locale} section="simulator">
      <EngineSimulator locale={locale} />
    </KnowledgeShell>
  );
}
