import { afterEach, expect, test, vi } from "vitest";

import { getGarage, getProfileActivities } from "@/lib/content-api";
import { ProfileTabContent } from "./profile-tab-content";

vi.mock("@/lib/content-api", () => ({
  getGarage: vi.fn(),
  getProfileActivities: vi.fn(),
}));
vi.mock("./user-profile-screen", () => ({
  GaragePanel: () => null,
  ProfileActivities: () => null,
}));

afterEach(() => vi.clearAllMocks());

test("garage tab does not request activities", async () => {
  vi.mocked(getGarage).mockResolvedValueOnce([]);

  await ProfileTabContent({
    accessToken: "token",
    canManage: false,
    locale: "en",
    modal: undefined,
    ownerProfile: null,
    selectedVehicleId: undefined,
    tab: "garage",
    username: "e2e_rider",
  });

  expect(getGarage).toHaveBeenCalledOnce();
  expect(getProfileActivities).not.toHaveBeenCalled();
});
