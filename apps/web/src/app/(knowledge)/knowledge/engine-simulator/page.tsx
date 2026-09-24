import type { Metadata } from "next";

import { EngineSimulator } from "@/features/knowledge/components/engine-simulator";
import { KnowledgeShell } from "@/features/knowledge/components/knowledge-shell";
import { getRequestLocale } from "@/lib/request-locale";

export const metadata: Metadata = {
  title: "Engine Simulator 3D | iRide",
  description:
    "Explore 35 engines with an interactive 3D cutaway and RPM-driven sound.",
};

export default async function EngineSimulatorPage() {
  const locale = await getRequestLocale();
  return (
    <KnowledgeShell locale={locale} section="simulator">
      <EngineSimulator locale={locale} />
    </KnowledgeShell>
  );
}
