import type {
  OwnerVehicleDto,
  OwnershipTransferDto,
  VehicleDocumentDto,
} from "@iride/types";

export function vehicleLabel(
  vehicle: Pick<OwnerVehicleDto, "brand" | "model" | "nickname">,
) {
  return vehicle.nickname || `${vehicle.brand} ${vehicle.model}`;
}
export function selectedDocuments(
  documents: readonly VehicleDocumentDto[],
  ids: readonly string[],
) {
  const selected = new Set(ids);
  return documents.filter((document) => selected.has(document.id));
}
export function transferActions(
  transfer: OwnershipTransferDto,
  username: string,
) {
  if (
    transfer.status !== "pending" ||
    new Date(transfer.expiresAt).getTime() <= Date.now()
  )
    return [];
  if (transfer.toUsername === username) return ["accept", "reject"] as const;
  if (transfer.fromUsername === username) return ["cancel"] as const;
  return [];
}
