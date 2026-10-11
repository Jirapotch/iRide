export interface VehicleInput {
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  mileageKm: number | null;
}
export interface Vehicle extends VehicleInput {
  id: string;
  coverPhotoId: string | null;
  createdAt: string;
  deleting: boolean;
}
export interface ServiceInput {
  title: string;
  occurredOn: string;
  mileageKm: number | null;
  workshop: string | null;
  cost: number | null;
  notes: string | null;
}
export interface ServiceRecord extends ServiceInput {
  id: string;
  vehicleId: string;
  createdAt: string;
}
export interface VehiclePhoto {
  id: string;
  vehicleId: string;
  driveFileId: string | null;
  name: string;
  mimeType: string;
  bytes: number;
  createdAt: string;
  status: "uploading" | "ready";
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface VehicleDetail {
  vehicle: Vehicle;
  services: Page<ServiceRecord>;
  photos: VehiclePhoto[];
  totalCost: number;
}
