import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { RouteThumbnail } from "./route-thumbnail";

it("renders a north-up route without stretching the SVG viewport", () => {
  const markup = renderToStaticMarkup(
    <RouteThumbnail
      event={{
        id: "trip-1",
        kind: "trip",
        title: "Mountain route",
        description: null,
        locationLabel: "Start",
        latitude: 13,
        longitude: 100,
        destinationLabel: "Finish",
        destinationLatitude: 19,
        destinationLongitude: 98,
        startsAt: null,
        endsAt: null,
        timezone: "Asia/Bangkok",
        vehicleKinds: ["car"],
        organizer: {
          id: "user-1",
          username: "rider",
          displayName: "Rider",
        },
        canEdit: false,
        createdAt: "2026-09-08T00:00:00.000Z",
        updatedAt: "2026-09-08T00:00:00.000Z",
        stops: [],
      }}
    />,
  );

  expect(markup).toContain('preserveAspectRatio="xMidYMid meet"');
  expect(markup).not.toContain('preserveAspectRatio="none"');
});
