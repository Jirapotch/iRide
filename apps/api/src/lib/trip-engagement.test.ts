import { expect, it, vi } from "vitest";
import { handleTripParticipation } from "./trip-engagement";

it("saves an explicit interested state with optional public rider details", async () => {
  const tripId = "652dc233-b88f-4d35-86af-c780b677be44";
  const saveParticipation = vi.fn(async () => ({
    eventId: tripId,
    status: "planned" as const,
    completedAt: null,
    canOrganize: false,
    canContribute: false,
    viewerStatus: "interested" as const,
    participants: [],
    announcements: [],
    recap: null,
  }));
  const response = await handleTripParticipation(
    new Request(`https://example.test/api/v1/events/${tripId}/participation`, {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "interested",
        vehicleId: null,
        ridingArea: null,
      }),
    }),
    tripId,
    {
      authenticate: async () => ({ userId: "rider-1", accessToken: "token" }),
      repository: { saveParticipation },
    },
  );
  expect(response.status).toBe(200);
  expect(saveParticipation).toHaveBeenCalledWith("rider-1", "token", tripId, {
    status: "interested",
    vehicleId: null,
    ridingArea: null,
  });
});
