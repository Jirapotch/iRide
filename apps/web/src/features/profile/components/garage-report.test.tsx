import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type {
  OwnProfileDto,
  OwnerVehicleDto,
  VehicleDocumentDto,
  VehicleRecordDto,
} from "@iride/types";
import { GarageReport } from "./garage-report";

const profile = {
  id: "owner",
  displayName: "Real Owner",
  username: "rider",
  locationName: "Bangkok",
} as OwnProfileDto;
const vehicle = {
  id: "vehicle",
  owner: { id: "owner" },
  brand: "Honda",
  model: "CB500",
  kind: "motorcycle",
  nickname: null,
  year: 2024,
  mileageKm: 10000,
  nextServiceKm: 12000,
  nextServiceDate: "2026-11-01",
  description: null,
} as OwnerVehicleDto;
const records = [
  {
    id: "record",
    title: "Oil change",
    occurredOn: "2026-10-01",
    mileageKm: 10000,
    kind: "service",
    workshopName: "Local shop",
    description: "New oil",
  },
] as VehicleRecordDto[];
const documents = [
  {
    id: "selected",
    filename: "receipt.pdf",
    mimeType: "application/pdf",
    bytes: 1024,
  },
  {
    id: "excluded",
    filename: "private.pdf",
    mimeType: "application/pdf",
    bytes: 1024,
  },
] as VehicleDocumentDto[];

test("print report uses fetched owner vehicle records and only selected attachments", () => {
  const markup = renderToStaticMarkup(
    <GarageReport
      profile={profile}
      vehicle={vehicle}
      records={records}
      documents={documents}
      documentIds={["selected", "unknown"]}
      locale="en"
    />,
  );
  expect(markup).toContain("Real Owner");
  expect(markup).toContain("Oil change");
  expect(markup).toContain("10,000 km");
  expect(markup).toContain("receipt.pdf");
  expect(markup).not.toContain("private.pdf");
});
test("report refuses a vehicle belonging to another profile", () => {
  expect(
    renderToStaticMarkup(
      <GarageReport
        profile={{ ...profile, id: "other" }}
        vehicle={vehicle}
        records={records}
        documents={documents}
        documentIds={["selected"]}
        locale="en"
      />,
    ),
  ).toBe("");
});
