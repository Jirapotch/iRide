import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes } from "react";
import { expect, it, vi } from "vitest";

vi.mock("@/features/navigation/components/pending-link", () => ({
  PendingLink: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}));

import { EngineSimulator } from "./engine-simulator";

it("exposes the engine, throttle, audio, and crank controls in English", () => {
  const html = renderToStaticMarkup(<EngineSimulator locale="en" />);
  expect(html).toContain("Engine Simulator 3D");
  expect(html).toContain("Start engine");
  expect(html).toContain("Throttle");
  expect(html).toContain("Exhaust sound");
  expect(html).toContain("Crank angle");
  expect(html).toContain("V car engines");
  expect(html).toContain("2-cylinder inline 270°");
  expect(html).toMatch(/aria-pressed="true"[^>]*>Stock<\/button>/);
  expect(html).not.toContain("unpkg.com");
});
