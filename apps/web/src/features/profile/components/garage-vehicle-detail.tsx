"use client";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Tag,
  Timeline,
} from "antd";
import { ArrowLeft, FileText, Plus, Printer } from "@phosphor-icons/react";
import type {
  OwnProfileDto,
  OwnerVehicleDto,
  UpdateGarageVehicleInput,
  VehicleDocumentDto,
  VehicleRecordDto,
} from "@iride/types";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { mediaVariantUrl } from "@/lib/content-api";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locale";
import type { ProfileQuery } from "../profile-routing";
import { browserApiGet, browserApiMutation } from "@/services/browser-api";
import { GarageVehicleForm } from "./garage-vehicle-form";
import { GarageRecordForm } from "./garage-record-form";
import { GarageReport } from "./garage-report";
import { GarageDocumentUploader } from "./garage-document-uploader";
import { selectedDocuments, vehicleLabel } from "./garage-domain";
import styles from "./owner-garage.module.css";

export function GarageVehicleDetail({
  vehicle,
  profile,
  locale,
  query,
  revision,
  onChanged,
}: {
  readonly vehicle: OwnerVehicleDto;
  readonly profile: OwnProfileDto;
  readonly locale: Locale;
  readonly query: ProfileQuery;
  readonly revision: number;
  readonly onChanged: () => void;
}) {
  const th = locale === "th";
  const router = useRouter();
  const [data, setData] = useState<{
    records: VehicleRecordDto[];
    documents: VehicleDocumentDto[];
    revision: number;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [recordId, setRecordId] = useState<string | undefined>();
  const canEdit =
    profile.canWrite && !vehicle.archivedAt && !vehicle.pendingTransfer;
  const base = `/profile?tab=garage&vehicle=${vehicle.id}`;
  const section =
    query.section === "documents" ||
    query.section === "modifications" ||
    query.section === "details"
      ? query.section
      : "history";
  const close = () =>
    router.push(`${base}&section=${section}`, { scroll: false });
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      browserApiGet<VehicleRecordDto[]>(
        `/vehicles/${vehicle.id}/records`,
        controller.signal,
      ),
      browserApiGet<VehicleDocumentDto[]>(
        `/vehicles/${vehicle.id}/documents`,
        controller.signal,
      ),
    ])
      .then(([records, documents]) => {
        setData({ records, documents, revision });
        setLoadError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [vehicle.id, revision, retry]);
  async function mutate(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    input?: unknown,
  ) {
    setBusy(true);
    setError(false);
    try {
      await browserApiMutation(path, method, input);
      onChanged();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (loadError)
    return (
      <Alert
        type="error"
        title={th ? "โหลดประวัติไม่ได้" : "Could not load vehicle history."}
        action={
          <Button
            onClick={() => {
              setLoadError(false);
              setRetry((value) => value + 1);
            }}
          >
            {th ? "ลองอีกครั้ง" : "Retry"}
          </Button>
        }
      />
    );
  if (!data || data.revision !== revision) return <Skeleton active />;
  const { records, documents } = data;
  const record = records.find((item) => item.id === query.record) ?? null;
  const filteredRecords =
    section === "modifications"
      ? records.filter((item) => item.kind === "modification")
      : records;
  const selection = (
    <Checkbox.Group
      value={documentIds}
      options={documents.map((document) => ({
        value: document.id,
        label: document.filename,
      }))}
      onChange={(ids) => setDocumentIds(ids.map(String))}
      style={{ display: "grid", gap: 12, marginBottom: 16 }}
    />
  );
  return (
    <div className={styles.panel}>
      <div className={styles.heading}>
        <Button href="/profile?tab=garage" icon={<ArrowLeft size={18} />}>
          {th ? "Garage ของฉัน" : "My garage"}
        </Button>
        <Button
          href={`${base}&section=${section}&modal=report`}
          icon={<Printer size={18} />}
        >
          {th ? "รายงาน" : "Report"}
        </Button>
      </div>
      <Card size="small">
        {vehicle.mediaIds.length ? (
          <div className={styles.photos}>
            {vehicle.mediaIds.map((id, index) => (
              <a
                key={id}
                href={mediaVariantUrl(id, "preview")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${vehicleLabel(vehicle)} ${index + 1}`}
              >
                <Image
                  src={mediaVariantUrl(id, "thumbnail")}
                  alt={`${vehicleLabel(vehicle)} ${index + 1}`}
                  width={100}
                  height={72}
                  unoptimized
                />
              </a>
            ))}
          </div>
        ) : null}
        <div className={styles.heading}>
          <div>
            <h2>{vehicleLabel(vehicle)}</h2>
            <p className={styles.metadata}>
              {vehicle.brand} {vehicle.model} · {vehicle.year ?? vehicle.kind}
            </p>
          </div>
          <div>
            {vehicle.archivedAt ? (
              <Tag>{th ? "เก็บถาวร" : "Archived"}</Tag>
            ) : null}
            {vehicle.pendingTransfer ? (
              <Tag color="orange">{th ? "รอโอน" : "Transfer pending"}</Tag>
            ) : null}
          </div>
        </div>
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 3 }}
          items={[
            {
              key: "mileage",
              label: th ? "ระยะทาง" : "Mileage",
              children:
                vehicle.mileageKm === null
                  ? "—"
                  : `${vehicle.mileageKm.toLocaleString()} km`,
            },
            {
              key: "service",
              label: th ? "บำรุงรักษาที่" : "Service at",
              children:
                vehicle.nextServiceKm === null
                  ? "—"
                  : `${vehicle.nextServiceKm.toLocaleString()} km`,
            },
            {
              key: "date",
              label: th ? "วันที่นัด" : "Service date",
              children: vehicle.nextServiceDate ?? "—",
            },
          ]}
        />
        <div className={styles.actions}>
          {canEdit ? (
            <>
              <Button href={`${base}&modal=edit`}>
                {th ? "แก้ไขรถ" : "Edit vehicle"}
              </Button>
              <Button
                href={`${base}&modal=add-record`}
                icon={<Plus size={17} />}
              >
                {th ? "เพิ่มบันทึก" : "Add record"}
              </Button>
              <Button href={`${base}&modal=transfer`}>
                {th ? "โอนกรรมสิทธิ์" : "Transfer"}
              </Button>
            </>
          ) : null}
          {profile.canWrite && !vehicle.pendingTransfer ? (
            <Popconfirm
              title={
                vehicle.archivedAt
                  ? th
                    ? "นำรถกลับมา?"
                    : "Restore vehicle?"
                  : th
                    ? "เก็บรถนี้ถาวร?"
                    : "Archive vehicle?"
              }
              onConfirm={() =>
                mutate(`/vehicles/${vehicle.id}/archive`, "POST", {
                  archived: !vehicle.archivedAt,
                })
              }
            >
              <Button loading={busy}>
                {vehicle.archivedAt
                  ? th
                    ? "นำกลับมา"
                    : "Restore"
                  : th
                    ? "เก็บถาวร"
                    : "Archive"}
              </Button>
            </Popconfirm>
          ) : null}
        </div>
      </Card>
      {error ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          title={
            th ? "ดำเนินการไม่ได้ กรุณาลองใหม่" : "Action failed. Please retry."
          }
        />
      ) : null}
      <nav
        aria-label={th ? "ส่วนของรถ" : "Vehicle sections"}
        className={styles.actions}
      >
        {(["history", "modifications", "documents", "details"] as const).map(
          (key) => (
            <Link
              key={key}
              href={`${base}&section=${key}`}
              aria-current={section === key ? "page" : undefined}
              style={{
                padding: "10px 12px",
                borderBottom:
                  section === key
                    ? "2px solid var(--primary)"
                    : "2px solid transparent",
              }}
            >
              {
                {
                  history: th ? "ประวัติ" : "History",
                  modifications: th ? "การแต่งรถ" : "Modifications",
                  documents: th ? "เอกสาร" : "Documents",
                  details: th ? "ระยะทาง / นัดหมาย" : "Mileage / service",
                }[key]
              }
            </Link>
          ),
        )}
      </nav>
      <div
        className={
          section === "history" || section === "modifications"
            ? styles.detailColumns
            : undefined
        }
      >
        {section === "documents" ? (
          <Card size="small">
            {documents.map((document) => (
              <div className={styles.document} key={document.id}>
                <a
                  href={`/api/bff/vehicle-documents/${document.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText size={18} />
                  <span>
                    {document.filename}
                    <small className={styles.metadata}>
                      {" "}
                      · {Math.ceil(document.bytes / 1024)} KB
                      {document.recordId
                        ? ` · ${records.find((item) => item.id === document.recordId)?.title ?? ""}`
                        : ""}
                    </small>
                  </span>
                </a>
                {canEdit ? (
                  <Popconfirm
                    title={th ? "ลบเอกสารนี้?" : "Delete document?"}
                    onConfirm={() =>
                      mutate(
                        `/vehicles/${vehicle.id}/documents/${document.id}`,
                        "DELETE",
                      )
                    }
                  >
                    <Button danger loading={busy}>
                      {th ? "ลบ" : "Delete"}
                    </Button>
                  </Popconfirm>
                ) : null}
              </div>
            ))}
            {!documents.length ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={th ? "ยังไม่มีเอกสาร" : "No documents yet"}
              />
            ) : null}
            {canEdit ? (
              <div className={styles.panel}>
                <Select
                  value={recordId}
                  allowClear
                  placeholder={
                    th
                      ? "แนบกับบันทึก (ไม่บังคับ)"
                      : "Link to a record (optional)"
                  }
                  options={records.map((item) => ({
                    value: item.id,
                    label: item.title,
                  }))}
                  onChange={setRecordId}
                />
                <GarageDocumentUploader
                  vehicleId={vehicle.id}
                  locale={locale}
                  recordId={recordId}
                  onSaved={onChanged}
                />
              </div>
            ) : null}
          </Card>
        ) : section === "details" ? (
          <Card size="small">
            <Form<UpdateGarageVehicleInput>
              layout="vertical"
              key={vehicle.updatedAt}
              initialValues={{
                mileageKm: vehicle.mileageKm,
                nextServiceKm: vehicle.nextServiceKm,
                nextServiceDate: vehicle.nextServiceDate,
              }}
              onFinish={(values) =>
                void mutate(`/profile/me/garage/${vehicle.id}`, "PATCH", {
                  ...values,
                  mileageKm: values.mileageKm ?? null,
                  nextServiceKm: values.nextServiceKm ?? null,
                  nextServiceDate: values.nextServiceDate || null,
                })
              }
              disabled={!canEdit}
            >
              <div className={styles.fields}>
                <Form.Item
                  name="mileageKm"
                  label={th ? "ระยะทางปัจจุบัน (km)" : "Current mileage (km)"}
                >
                  <InputNumber
                    min={0}
                    max={10000000}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item
                  name="nextServiceKm"
                  label={th ? "ระยะบำรุงรักษา (km)" : "Next service (km)"}
                >
                  <InputNumber
                    min={0}
                    max={10000000}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </div>
              <Form.Item
                name="nextServiceDate"
                label={th ? "วันที่บำรุงรักษา" : "Next service date"}
              >
                <Input type="date" />
              </Form.Item>
              {canEdit ? (
                <Button htmlType="submit" type="primary" loading={busy}>
                  {th ? "บันทึก" : "Save"}
                </Button>
              ) : null}
            </Form>
          </Card>
        ) : filteredRecords.length ? (
          <Timeline
            items={filteredRecords.map((item) => ({
              key: item.id,
              content: (
                <div className={styles.record}>
                  <time className={styles.metadata}>
                    {item.occurredOn} ·{" "}
                    {item.mileageKm === null
                      ? "—"
                      : `${item.mileageKm.toLocaleString()} km`}
                  </time>
                  <h3>
                    {item.title}{" "}
                    <Tag>
                      {item.kind === "service"
                        ? th
                          ? "บำรุงรักษา"
                          : "Service"
                        : th
                          ? "การแต่งรถ"
                          : "Modification"}
                    </Tag>
                  </h3>
                  {item.workshopName ? (
                    <p className={styles.metadata}>{item.workshopName}</p>
                  ) : null}
                  {item.description ? <p>{item.description}</p> : null}
                  <div className={styles.actions}>
                    {item.documentIds.map((id) => {
                      const document = documents.find(
                        (entry) => entry.id === id,
                      );
                      return document ? (
                        <a
                          key={id}
                          href={`/api/bff/vehicle-documents/${id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {document.filename}
                        </a>
                      ) : null;
                    })}
                    {canEdit ? (
                      <>
                        <Button
                          href={`${base}&section=${section}&modal=edit-record&record=${item.id}`}
                        >
                          {th ? "แก้ไข" : "Edit"}
                        </Button>
                        <Popconfirm
                          title={th ? "ลบบันทึกนี้?" : "Delete record?"}
                          onConfirm={() =>
                            mutate(
                              `/vehicles/${vehicle.id}/records/${item.id}`,
                              "DELETE",
                            )
                          }
                        >
                          <Button danger loading={busy}>
                            {th ? "ลบ" : "Delete"}
                          </Button>
                        </Popconfirm>
                      </>
                    ) : null}
                  </div>
                </div>
              ),
            }))}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={th ? "ยังไม่มีบันทึก" : "No records yet"}
          />
        )}
        {section === "history" || section === "modifications" ? (
          <Card
            size="small"
            title={th ? "เอกสาร" : "Documents"}
            extra={
              <Link href={`${base}&section=documents`}>
                {th ? "ดูทั้งหมด" : "View all"}
              </Link>
            }
          >
            {documents.length ? (
              documents.slice(0, 4).map((document) => (
                <div className={styles.document} key={document.id}>
                  <a
                    href={`/api/bff/vehicle-documents/${document.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {document.filename}
                  </a>
                </div>
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={th ? "ยังไม่มีเอกสาร" : "No documents yet"}
              />
            )}
          </Card>
        ) : null}
      </div>
      <Modal
        open={canEdit && query.modal === "edit"}
        onCancel={close}
        title={th ? "แก้ไขรถ" : "Edit vehicle"}
        footer={null}
        destroyOnHidden
      >
        <GarageVehicleForm
          initial={vehicle}
          locale={locale}
          onSaved={() => {
            onChanged();
            close();
          }}
        />
      </Modal>
      <Modal
        open={
          canEdit &&
          (query.modal === "add-record" ||
            (query.modal === "edit-record" && Boolean(record)))
        }
        onCancel={close}
        title={th ? "บันทึกประวัติ" : "Vehicle record"}
        footer={null}
        destroyOnHidden
      >
        <GarageRecordForm
          key={record?.id ?? "new"}
          vehicleId={vehicle.id}
          initial={query.modal === "edit-record" ? record : null}
          locale={locale}
          onSaved={() => {
            onChanged();
            close();
          }}
        />
      </Modal>
      <Modal
        open={canEdit && query.modal === "transfer"}
        onCancel={close}
        title={th ? "โอนกรรมสิทธิ์" : "Transfer ownership"}
        footer={null}
        destroyOnHidden
      >
        <Form<{ toUsername: string }>
          layout="vertical"
          onFinish={async (values) => {
            const ok = await mutate("/vehicle-transfers", "POST", {
              vehicleId: vehicle.id,
              toUsername: values.toUsername.trim(),
              documentIds: selectedDocuments(documents, documentIds).map(
                (document) => document.id,
              ),
            });
            if (ok) {
              setDocumentIds([]);
              close();
            }
          }}
        >
          {error ? (
            <Alert
              role="alert"
              type="error"
              title={
                th
                  ? "โอนไม่ได้ ตรวจสอบชื่อผู้ใช้และลองใหม่"
                  : "Could not transfer. Check the username and retry."
              }
            />
          ) : null}
          <Form.Item
            label={th ? "ชื่อผู้รับ" : "Recipient username"}
            name="toUsername"
            rules={[
              { required: true, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_]{2,29}$/ },
            ]}
          >
            <Input prefix="@" maxLength={30} />
          </Form.Item>
          <p>
            {th
              ? "เลือกเอกสารที่จะส่งให้เจ้าของใหม่"
              : "Choose documents for the new owner."}
          </p>
          {selection}
          <Button htmlType="submit" type="primary" loading={busy}>
            {th ? "ส่งคำขอโอน" : "Send transfer"}
          </Button>
        </Form>
      </Modal>
      <Modal
        open={query.modal === "report"}
        onCancel={close}
        title={th ? "รายงานรถ" : "Vehicle report"}
        width={800}
        footer={
          <Button
            type="primary"
            icon={<Printer size={18} />}
            onClick={() => window.print()}
          >
            {th ? "พิมพ์ / บันทึก PDF" : "Print / Save PDF"}
          </Button>
        }
        destroyOnHidden
      >
        <p>{th ? "เลือกเอกสารแนบ" : "Choose attachments"}</p>
        {selection}
        <GarageReport
          profile={profile}
          vehicle={vehicle}
          records={records}
          documents={documents}
          documentIds={documentIds}
          locale={locale}
        />
      </Modal>
    </div>
  );
}
