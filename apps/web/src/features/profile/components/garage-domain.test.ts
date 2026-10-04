import { expect, test, vi } from "vitest";
import type { OwnershipTransferDto, VehicleDocumentDto } from "@iride/types";
import { selectedDocuments, transferActions } from "./garage-domain";

test("report and transfer attachments must exist in the owner's fetched document list", () => {
  const documents = [
    { id: "owned" },
    { id: "excluded" },
  ] as VehicleDocumentDto[];
  expect(selectedDocuments(documents, ["owned", "foreign"])).toEqual([
    { id: "owned" },
  ]);
});
test("transfer actions follow participant and pending expiry boundaries", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
  const transfer = {
    status: "pending",
    expiresAt: "2026-10-05T00:00:00Z",
    fromUsername: "sender",
    toUsername: "recipient",
  } as OwnershipTransferDto;
  expect(transferActions(transfer, "sender")).toEqual(["cancel"]);
  expect(transferActions(transfer, "recipient")).toEqual(["accept", "reject"]);
  expect(transferActions(transfer, "stranger")).toEqual([]);
  expect(
    transferActions({ ...transfer, status: "accepted" }, "sender"),
  ).toEqual([]);
  expect(
    transferActions(
      { ...transfer, expiresAt: "2026-10-03T00:00:00Z" },
      "recipient",
    ),
  ).toEqual([]);
  vi.useRealTimers();
});
