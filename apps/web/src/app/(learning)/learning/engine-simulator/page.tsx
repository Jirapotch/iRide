import type { Metadata } from "next";

import { EngineSimulator } from "@/features/learning/components/engine-simulator";
import { LearningShell } from "@/features/learning/components/learning-shell";
import { getRequestLocale } from "@/lib/request-locale";

export const metadata: Metadata = {
  title: "Engine Simulator 3D | iRide",
  description:
    "Explore 35 engines with an interactive 3D cutaway and RPM-driven sound.",
};

export default async function EngineSimulatorPage() {
  const locale = await getRequestLocale();
  return (
    <LearningShell locale={locale}>
      <EngineSimulator locale={locale} />
    </LearningShell>
  );
}
