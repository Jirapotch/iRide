"use client";

import {
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  Modal,
  Popconfirm,
  Skeleton,
  Tag,
} from "antd";
import {
  Car,
  ClockCounterClockwise,
  DotsThree,
  Plus,
} from "@phosphor-icons/react";
import type {
  GarageSummaryDto,
  OwnProfileDto,
  OwnershipTransferDto,
} from "@iride/types";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locale";
import type { ProfileQuery } from "../profile-routing";
import { browserApiGet, browserApiMutation } from "@/services/browser-api";
import { mediaVariantUrl } from "@/lib/content-api";
import { GarageVehicleDetail } from "./garage-vehicle-detail";
import { GarageVehicleForm } from "./garage-vehicle-form";
import { transferActions, vehicleLabel } from "./garage-domain";
import styles from "./owner-garage.module.css";

export function OwnerGarage({
  locale,
  profile,
  query,
  overview = false,
}: {
  readonly locale: Locale;
  readonly profile: OwnProfileDto;
  readonly query: ProfileQuery;
  readonly overview?: boolean;
}) {
  const th = locale === "th";
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [summary, setSummary] = useState<GarageSummaryDto | null>(null);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void browserApiGet<GarageSummaryDto>(
      "/profile/me/garage-summary",
      controller.signal,
    )
      .then((data) => {
        setSummary(data);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [profile.id, revision]);
  function refresh() {
    setRevision((value) => value + 1);
    router.refresh();
  }
  async function transferAction(
    transfer: OwnershipTransferDto,
    action: string,
  ) {
    setBusy(transfer.id);
    setActionError(false);
    try {
      await browserApiMutation(
        `/vehicle-transfers/${transfer.id}/${action}`,
        "POST",
      );
      refresh();
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  }
  if (error)
    return (
      <Alert
        type="error"
        showIcon
        title={th ? "โหลด Garage ไม่ได้" : "Could not load garage."}
        action={
          <Button
            onClick={() => {
              setError(false);
              refresh();
            }}
          >
            {th ? "ลองอีกครั้ง" : "Retry"}
          </Button>
        }
      />
    );
  if (!summary)
    return (
      <div className={styles.panel} role="status" aria-busy="true">
        <Skeleton active />
      </div>
    );
  const selected = summary.vehicles.find(
    (vehicle) => vehicle.id === query.vehicle,
  );
  const vehicles = overview
    ? summary.vehicles.filter((vehicle) => !vehicle.archivedAt).slice(0, 3)
    : summary.vehicles;
  const transfers = summary.transfers.filter(
    (transfer) => transfer.status === "pending",
  );
  return (
    <section className={styles.panel}>
      {actionError ? (
        <Alert
          role="alert"
          type="error"
          title={
            th ? "ดำเนินการไม่ได้ กรุณาลองใหม่" : "Action failed. Please retry."
          }
          closable
          onClose={() => setActionError(false)}
        />
      ) : null}
      {!overview && selected ? (
        <GarageVehicleDetail
          key={`${profile.id}:${selected.id}`}
          vehicle={selected}
          profile={profile}
          locale={locale}
          query={query}
          revision={revision}
          onChanged={refresh}
        />
      ) : (
        <>
          <div className={styles.heading}>
            <h2>
              {th ? "รถของฉัน" : "My garage"}{" "}
              <Tag>
                {
                  summary.vehicles.filter((vehicle) => !vehicle.archivedAt)
                    .length
                }
              </Tag>
            </h2>
            {overview ? (
              <Link href="/profile?tab=garage">
                {th ? "ดูทั้งหมด" : "View all"}
              </Link>
            ) : profile.canWrite ? (
              <Button
                href="/profile?tab=garage&modal=create-vehicle"
                icon={<Plus size={18} />}
                type="primary"
              >
                {th ? "เพิ่มรถ" : "Add vehicle"}
              </Button>
            ) : null}
          </div>
          <div className={styles.grid}>
            {vehicles.map((vehicle) => (
              <Card size="small" key={vehicle.id}>
                <div className={styles.vehicle}>
                  <div className={styles.thumbnail}>
                    {vehicle.mediaIds[0] ? (
                      <Image
                        alt={vehicleLabel(vehicle)}
                        src={mediaVariantUrl(vehicle.mediaIds[0], "thumbnail")}
                        width={80}
                        height={64}
                        unoptimized
                      />
                    ) : (
                      <Car size={30} />
                    )}
                  </div>
                  <div>
                    <h3>{vehicleLabel(vehicle)}</h3>
                    <p className={styles.metadata}>
                      {vehicle.brand} {vehicle.model} ·{" "}
                      {vehicle.year ?? vehicle.kind}
                    </p>
                    <p className={styles.metadata}>
                      {vehicle.mileageKm === null
                        ? th
                          ? "ยังไม่ระบุระยะทาง"
                          : "Mileage not set"
                        : `${vehicle.mileageKm.toLocaleString()} km`}
                    </p>
                    {vehicle.archivedAt ? (
                      <Tag>{th ? "เก็บถาวร" : "Archived"}</Tag>
                    ) : null}
                    {vehicle.pendingTransfer ? (
                      <Tag color="orange">
                        {th ? "รอโอน" : "Transfer pending"}
                      </Tag>
                    ) : null}
                  </div>
                </div>
                <div className={styles.actions}>
                  {profile.canWrite &&
                  !vehicle.archivedAt &&
                  !vehicle.pendingTransfer ? (
                    <Button
                      type="primary"
                      icon={<Plus size={17} />}
                      href={`/profile?tab=garage&vehicle=${vehicle.id}&modal=add-record`}
                    >
                      {th ? "เพิ่มบันทึก" : "Add record"}
                    </Button>
                  ) : null}
                  <Button
                    href={`/profile?tab=garage&vehicle=${vehicle.id}&section=history`}
                    icon={<ClockCounterClockwise size={17} />}
                  >
                    {th ? "ประวัติ" : "History"} ({vehicle.recordCount})
                  </Button>
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        {
                          key: "details",
                          label: (
                            <Link
                              href={`/profile?tab=garage&vehicle=${vehicle.id}`}
                              className={styles.menuLink}
                            >
                              {th ? "รายละเอียดรถ" : "Vehicle details"}
                            </Link>
                          ),
                        },
                        {
                          key: "report",
                          label: (
                            <Link
                              href={`/profile?tab=garage&vehicle=${vehicle.id}&modal=report`}
                              className={styles.menuLink}
                            >
                              {th ? "รายงานสำหรับขาย" : "Sale report"}
                            </Link>
                          ),
                        },
                        ...(profile.canWrite &&
                        !vehicle.archivedAt &&
                        !vehicle.pendingTransfer
                          ? [
                              {
                                key: "edit",
                                label: (
                                  <Link
                                    href={`/profile?tab=garage&vehicle=${vehicle.id}&modal=edit`}
                                    className={styles.menuLink}
                                  >
                                    {th ? "แก้ไขรถ" : "Edit vehicle"}
                                  </Link>
                                ),
                              },
                              {
                                key: "transfer",
                                label: (
                                  <Link
                                    href={`/profile?tab=garage&vehicle=${vehicle.id}&modal=transfer`}
                                    className={styles.menuLink}
                                  >
                                    {th ? "โอนกรรมสิทธิ์" : "Transfer"}
                                  </Link>
                                ),
                              },
                            ]
                          : []),
                      ],
                    }}
                  >
                    <Button
                      icon={<DotsThree size={22} />}
                      aria-label={
                        th
                          ? `เพิ่มเติม ${vehicleLabel(vehicle)}`
                          : `More ${vehicleLabel(vehicle)}`
                      }
                    />
                  </Dropdown>
                </div>
              </Card>
            ))}
          </div>
          {!vehicles.length ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={th ? "ยังไม่มีรถใน Garage" : "No vehicles yet"}
            />
          ) : null}
          {overview ? (
            <Card title={th ? "บันทึกล่าสุด" : "Recent records"} size="small">
              {summary.recentRecords.length ? (
                summary.recentRecords.slice(0, 5).map((record) => (
                  <div className={styles.document} key={record.id}>
                    <Link
                      href={`/profile?tab=garage&vehicle=${record.vehicleId}&section=history`}
                    >
                      {record.title}
                    </Link>
                    <span className={styles.metadata}>
                      {record.vehicleLabel} · {record.occurredOn}
                    </span>
                  </div>
                ))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={th ? "ยังไม่มีบันทึก" : "No records yet"}
                />
              )}
            </Card>
          ) : null}
        </>
      )}
      {query.vehicle && !selected && !overview ? (
        <Alert
          type="warning"
          title={
            th
              ? "ไม่พบรถที่คุณเป็นเจ้าของ"
              : "This vehicle is not in your garage."
          }
        />
      ) : null}
      {transfers.length ? (
        <Card
          size="small"
          title={th ? "การโอนกรรมสิทธิ์" : "Ownership transfers"}
        >
          {transfers.map((transfer) => (
            <div className={styles.document} key={transfer.id}>
              <div>
                <strong>{transfer.vehicleLabel}</strong>
                <p className={styles.metadata}>
                  @{transfer.fromUsername} → @{transfer.toUsername}
                </p>
                <p className={styles.metadata}>
                  {th ? "หมดอายุ" : "Expires"}:{" "}
                  {new Date(transfer.expiresAt).toLocaleDateString(
                    th ? "th-TH" : "en",
                  )}
                </p>
              </div>
              <div className={styles.actions}>
                {profile.canWrite
                  ? transferActions(transfer, profile.username ?? "").map(
                      (action) => (
                        <Button
                          key={action}
                          loading={busy === transfer.id}
                          onClick={() => void transferAction(transfer, action)}
                        >
                          {
                            {
                              accept: th ? "รับโอน" : "Accept",
                              reject: th ? "ปฏิเสธ" : "Reject",
                              cancel: th ? "ยกเลิก" : "Cancel",
                            }[action]
                          }
                        </Button>
                      ),
                    )
                  : null}
              </div>
            </div>
          ))}
        </Card>
      ) : null}
      {summary.retainedDocuments?.length ? (
        <Card
          size="small"
          title={th ? "เอกสารที่เก็บไว้หลังโอน" : "Retained documents"}
        >
          {summary.retainedDocuments.map((document) => (
            <div className={styles.document} key={document.id}>
              <a
                href={`/api/bff/vehicle-documents/${document.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {document.filename}
              </a>
              {profile.canWrite ? (
                <Popconfirm
                  title={th ? "ลบเอกสารนี้?" : "Delete document?"}
                  onConfirm={async () => {
                    setBusy(document.id);
                    setActionError(false);
                    try {
                      await browserApiMutation(
                        `/vehicle-documents/${document.id}`,
                        "DELETE",
                      );
                      refresh();
                    } catch {
                      setActionError(true);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Button danger loading={busy === document.id}>
                    {th ? "ลบ" : "Delete"}
                  </Button>
                </Popconfirm>
              ) : null}
            </div>
          ))}
        </Card>
      ) : null}
      <Modal
        open={!overview && query.modal === "create-vehicle" && profile.canWrite}
        onCancel={() => router.push("/profile?tab=garage", { scroll: false })}
        footer={null}
        title={th ? "เพิ่มรถ" : "Add vehicle"}
        destroyOnHidden
      >
        <GarageVehicleForm
          locale={locale}
          initial={null}
          onSaved={(id) => {
            refresh();
            router.push(`/profile?tab=garage&vehicle=${id}`, { scroll: false });
          }}
        />
      </Modal>
    </section>
  );
}
