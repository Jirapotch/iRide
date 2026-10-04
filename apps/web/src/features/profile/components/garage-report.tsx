import type {
  OwnProfileDto,
  OwnerVehicleDto,
  VehicleDocumentDto,
  VehicleRecordDto,
} from "@iride/types";
import Image from "next/image";
import type { Locale } from "@/lib/locale";
import { selectedDocuments, vehicleLabel } from "./garage-domain";
import styles from "./owner-garage.module.css";

export function GarageReport({
  profile,
  vehicle,
  records,
  documents,
  documentIds,
  locale,
}: {
  readonly profile: OwnProfileDto;
  readonly vehicle: OwnerVehicleDto;
  readonly records: readonly VehicleRecordDto[];
  readonly documents: readonly VehicleDocumentDto[];
  readonly documentIds: readonly string[];
  readonly locale: Locale;
}) {
  const th = locale === "th";
  if (vehicle.owner.id !== profile.id) return null;
  return (
    <article id="garage-report" className={styles.report}>
      <h2>{vehicleLabel(vehicle)}</h2>
      <p>
        {profile.displayName} (@{profile.username})
        {profile.locationName ? ` · ${profile.locationName}` : ""}
      </p>
      <p>
        {vehicle.brand} {vehicle.model} · {vehicle.kind} · {vehicle.year ?? "—"}
      </p>
      <p>
        {th ? "ระยะทาง" : "Mileage"}:{" "}
        {vehicle.mileageKm === null
          ? "—"
          : `${vehicle.mileageKm.toLocaleString()} km`}
      </p>
      <p>
        {th ? "บำรุงรักษาครั้งถัดไป" : "Next service"}:{" "}
        {vehicle.nextServiceKm === null
          ? "—"
          : `${vehicle.nextServiceKm.toLocaleString()} km`}{" "}
        · {vehicle.nextServiceDate ?? "—"}
      </p>
      {vehicle.description ? <p>{vehicle.description}</p> : null}
      <table>
        <thead>
          <tr>
            <th>{th ? "วันที่" : "Date"}</th>
            <th>{th ? "บันทึก" : "Record"}</th>
            <th>km</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.occurredOn}</td>
              <td>
                <strong>{record.title}</strong>
                <p>
                  {record.kind === "service"
                    ? th
                      ? "บำรุงรักษา"
                      : "Service"
                    : th
                      ? "การแต่งรถ"
                      : "Modification"}
                  {record.workshopName ? ` · ${record.workshopName}` : ""}
                </p>
                {record.description ? <p>{record.description}</p> : null}
              </td>
              <td>{record.mileageKm ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{th ? "เอกสารแนบที่เลือก" : "Selected attachments"}</h3>
      {selectedDocuments(documents, documentIds).map((document) => (
        <section key={document.id}>
          <p>
            <a href={`/api/bff/vehicle-documents/${document.id}`}>
              {document.filename}
            </a>{" "}
            · {Math.ceil(document.bytes / 1024)} KB
          </p>
          {document.mimeType.startsWith("image/") ? (
            <Image
              src={`/api/bff/vehicle-documents/${document.id}`}
              alt={document.filename}
              width={800}
              height={600}
              unoptimized
            />
          ) : null}
        </section>
      ))}
    </article>
  );
}
