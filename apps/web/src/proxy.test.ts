import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/proxy", () => ({ updateSession: vi.fn() }));

import { updateSession } from "@/lib/supabase/proxy";
import { proxy } from "./proxy";

it.each([
  "/knowledge",
  "/knowledge/engine-simulator",
  "/knowledge/engine-processor.js",
  "/learning",
  "/learning/engine-simulator",
  "/learning/engine-processor.js",
])("does not refresh Supabase session on %s", async (pathname) => {
  vi.mocked(updateSession).mockClear();
  await proxy(new NextRequest(`https://iride.example${pathname}`));
  expect(updateSession).not.toHaveBeenCalled();
});
