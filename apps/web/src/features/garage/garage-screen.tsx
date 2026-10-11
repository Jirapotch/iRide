"use client";
import {
  App,
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Upload,
} from "antd";
import {
  Car,
  Plus,
  Wrench,
  ImageSquare,
  UploadSimple,
  PencilSimple,
  Trash,
  ArrowUpRight,
  Check,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/locale";
import type {
  ServiceInput,
  ServiceRecord,
  Vehicle,
  VehicleDetail,
  VehicleInput,
} from "./types";
import { MAX_IMAGE_BYTES } from "./validation";
import styles from "./garage.module.css";
const emptyVehicle: VehicleInput = {
  name: "",
  brand: null,
  model: null,
  year: null,
  plate: null,
  mileageKm: null,
};
const blankService = (): ServiceInput => {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return {
    title: "",
    occurredOn: date,
    mileageKm: null,
    workshop: null,
    cost: null,
    notes: null,
  };
};
const photoUrl = (id: string) => "/api/garage/photos/" + id + "/content";
async function api<T>(
  path: string,
  method = "GET",
  value?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/garage/" + path, {
    method,
    ...(signal ? { signal } : {}),
    ...(value !== undefined
      ? value instanceof FormData
        ? { body: value }
        : {
            body: JSON.stringify(value),
            headers: { "Content-Type": "application/json" },
          }
      : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.code ?? "SERVICE_UNAVAILABLE");
  return result as T;
}
interface UploadItem {
  id: string;
  file: File;
  vehicleId: string;
  state: "queued" | "uploading" | "done" | "error";
  error?: string;
}
export function GarageScreen({ locale }: { locale: Locale }) {
  const th = locale === "th",
    { message } = App.useApp();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<VehicleDetail | null>(null),
    [error, setError] = useState<string | null>(null),
    [detailError, setDetailError] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(1);
  const [vehicleModal, setVehicleModal] = useState<{
      id: string | null;
    } | null>(null),
    [serviceModal, setServiceModal] = useState<{ id: string | null } | null>(
      null,
    ),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [uploads, setUploads] = useState<UploadItem[]>([]);
  const [vehicleForm] = Form.useForm<VehicleInput>(),
    [serviceForm] = Form.useForm<ServiceInput>();
  const queue = useRef(Promise.resolve());
  const refresh = () => setRevision((r) => r + 1);
  const explain = (code: string) => {
    const messages: Record<string, [string, string]> = {
      DATABASE_NOT_CONFIGURED: [
        "Garage ยังไม่ได้เชื่อมฐานข้อมูล กรุณาตั้งค่าเซิร์ฟเวอร์",
        "The Garage database is not configured.",
      ],
      DATABASE_NOT_READY: [
        "Garage กำลังเตรียมฐานข้อมูล กรุณาลองอีกครั้งภายหลัง",
        "The Garage database is being prepared. Please try again later.",
      ],
      DATABASE_UNAVAILABLE: [
        "เชื่อมฐานข้อมูลไม่ได้ กรุณาลองอีกครั้ง",
        "The database is unavailable. Please retry.",
      ],
      DRIVE_NOT_CONFIGURED: [
        "ยังไม่ได้ตั้งค่าการเชื่อม Google Drive",
        "Google Drive has not been connected.",
      ],
      DRIVE_RECONNECT_REQUIRED: [
        "เจ้าของต้องเชื่อม Google Drive ใหม่",
        "The owner needs to reconnect Google Drive.",
      ],
      DRIVE_PERMISSION_OR_QUOTA: [
        "ตรวจสิทธิ์และพื้นที่ว่างใน Google Drive",
        "Check Drive permissions and available storage.",
      ],
      UPLOAD_IN_PROGRESS: [
        "มีรูปกำลังอัปโหลด กรุณารอให้เสร็จก่อนลบรถ",
        "Wait for the pending photo upload before deleting this vehicle.",
      ],
      VEHICLE_DELETING: [
        "รถกำลังรอลบไฟล์ กรุณาลองลบต่ออีกครั้ง",
        "Vehicle cleanup is pending. Retry deletion.",
      ],
      UPLOAD_RECONCILE_REQUIRED: [
        "ต้องตรวจสถานะรูปบนเซิร์ฟเวอร์ก่อนลองใหม่",
        "This upload needs server reconciliation before retrying.",
      ],
    };
    return (
      messages[code]?.[th ? 0 : 1] ??
      (th
        ? "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง"
        : "Could not complete the request. Please retry.")
    );
  };
  useEffect(() => {
    const controller = new AbortController();
    api<Vehicle[]>("vehicles", "GET", undefined, controller.signal)
      .then((data) => {
        setVehicles(data);
        setError(null);
        setSelected((current) =>
          current && data.some((v) => v.id === current)
            ? current
            : (data[0]?.id ?? null),
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    api<VehicleDetail>(
      "vehicles/" + selected + "?page=" + page,
      "GET",
      undefined,
      controller.signal,
    )
      .then((data) => {
        setDetail(data);
        setDetailError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setDetailError((e as Error).message);
      });
    return () => controller.abort();
  }, [selected, page, revision]);
  function choose(id: string) {
    setSelected(id);
    setPage(1);
    setDetail(null);
    setDetailError(null);
  }
  function openVehicle(vehicle?: Vehicle) {
    vehicleForm.resetFields();
    vehicleForm.setFieldsValue(vehicle ?? emptyVehicle);
    setVehicleModal({ id: vehicle?.id ?? null });
  }
  function openService(record?: ServiceRecord) {
    serviceForm.resetFields();
    serviceForm.setFieldsValue(record ?? blankService());
    setServiceModal({ id: record?.id ?? null });
  }
  async function saveVehicle() {
    let values: VehicleInput;
    try {
      values = await vehicleForm.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const id = vehicleModal?.id;
      const vehicle = await api<Vehicle>(
        "vehicles" + (id ? "/" + id : ""),
        id ? "PATCH" : "POST",
        values,
      );
      setVehicleModal(null);
      setSelected(vehicle.id);
      setPage(1);
      refresh();
      void message.success(th ? "บันทึกข้อมูลรถแล้ว" : "Vehicle saved");
    } catch (e) {
      void message.error(explain((e as Error).message));
    } finally {
      setSaving(false);
    }
  }
  async function saveService() {
    if (!selected) return;
    let values: ServiceInput;
    try {
      values = await serviceForm.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const id = serviceModal?.id;
      await api(
        "vehicles/" + selected + "/services" + (id ? "/" + id : ""),
        id ? "PATCH" : "POST",
        values,
      );
      setServiceModal(null);
      setPage(1);
      refresh();
      void message.success(th ? "บันทึก service แล้ว" : "Service saved");
    } catch (e) {
      void message.error(explain((e as Error).message));
    } finally {
      setSaving(false);
    }
  }
  async function mutate(path: string, method = "DELETE", value?: unknown) {
    setBusy(true);
    try {
      await api(path, method, value);
      refresh();
    } catch (e) {
      void message.error(explain((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  function enqueue(item: UploadItem) {
    setUploads((items) =>
      items.some((i) => i.id === item.id)
        ? items.map((i) =>
            i.id === item.id ? { ...i, state: "queued" as const } : i,
          )
        : [...items, item],
    );
    queue.current = queue.current.then(async () => {
      setUploads((items) =>
        items.map((i) =>
          i.id === item.id ? { ...i, state: "uploading" as const } : i,
        ),
      );
      const body = new FormData();
      body.append("file", item.file);
      try {
        await api("vehicles/" + item.vehicleId + "/photos", "POST", body);
        setUploads((items) =>
          items.map((i) =>
            i.id === item.id ? { ...i, state: "done" as const } : i,
          ),
        );
        refresh();
      } catch (e) {
        setUploads((items) =>
          items.map((i) =>
            i.id === item.id
              ? { ...i, state: "error" as const, error: (e as Error).message }
              : i,
          ),
        );
      }
    });
  }
  const current = detail?.vehicle.id === selected ? detail : null;
  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">01 / YOUR PERSONAL GARAGE</p>
          <h1>
            {th
              ? "รถของคุณ ทุกเรื่องราวการดูแล"
              : "Your rides, well cared for."}
          </h1>
          <p>
            {th
              ? "เก็บประวัติ service และภาพพาหนะของคุณไว้ด้วยกัน"
              : "A home for your vehicles, photos and service history."}
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={18} />}
          onClick={() => openVehicle()}
        >
          {th ? "เพิ่มรถ" : "Add vehicle"}
        </Button>
      </div>
      {error ? (
        <Alert
          type="warning"
          showIcon
          title={explain(error)}
          action={
            <Button onClick={refresh}>{th ? "ลองอีกครั้ง" : "Retry"}</Button>
          }
        />
      ) : vehicles === null ? (
        <Skeleton active />
      ) : vehicles.length === 0 ? (
        <div className={styles.empty}>
          <Car size={58} weight="light" />
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              th
                ? "Garage ว่างอยู่ เริ่มจากรถคันแรกของคุณ"
                : "Your Garage is ready for your first ride."
            }
          />
          <Button type="primary" onClick={() => openVehicle()}>
            {th ? "เพิ่มรถคันแรก" : "Add your first ride"}
          </Button>
        </div>
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.vehicleList}>
            <div className={styles.listHeading}>
              <span>{th ? "พาหนะของคุณ" : "YOUR VEHICLES"}</span>
              <Tag>{vehicles.length}</Tag>
            </div>
            {vehicles.map((v) => (
              <button
                className={styles.vehicleCard}
                data-selected={v.id === selected}
                key={v.id}
                onClick={() => choose(v.id)}
              >
                <span className={styles.vehicleThumb}>
                  {v.coverPhotoId ? (
                    <Image
                      src={photoUrl(v.coverPhotoId)}
                      alt={v.name}
                      preview={false}
                    />
                  ) : (
                    <Car size={36} weight="light" />
                  )}
                </span>
                <span>
                  <strong>{v.name}</strong>
                  <small>
                    {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                  </small>
                  <span className={styles.mileage}>
                    {v.mileageKm?.toLocaleString() ?? "—"} km
                  </span>
                </span>
                {v.id === selected && <span className={styles.selectionDot} />}
              </button>
            ))}
          </aside>
          <section className={styles.vehiclePanel}>
            {detailError ? (
              <Alert
                showIcon
                type="error"
                title={explain(detailError)}
                action={
                  <Button onClick={refresh}>
                    {th ? "ลองอีกครั้ง" : "Retry"}
                  </Button>
                }
              />
            ) : !current ? (
              <Skeleton active />
            ) : (
              <>
                {current.vehicle.deleting && (
                  <Alert
                    type="warning"
                    title={
                      th
                        ? "การลบยังไม่เสร็จ กดลบรถอีกครั้งเพื่อทำต่อ"
                        : "Cleanup is pending. Retry vehicle deletion to continue."
                    }
                  />
                )}
                <div className={styles.vehicleTitle}>
                  <div>
                    <p className="eyebrow">VEHICLE / SERVICE JOURNAL</p>
                    <h2>{current.vehicle.name}</h2>
                    <p>
                      {[
                        current.vehicle.brand,
                        current.vehicle.model,
                        current.vehicle.year,
                        current.vehicle.plate,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <Space>
                    <Button
                      aria-label={th ? "แก้ไขรถ" : "Edit vehicle"}
                      icon={<PencilSimple size={18} />}
                      disabled={current.vehicle.deleting}
                      onClick={() => openVehicle(current.vehicle)}
                    />
                    <Popconfirm
                      title={
                        th
                          ? "ลบรถพร้อมรูปและประวัติ service ทั้งหมด?"
                          : "Delete this vehicle, its photos and all services?"
                      }
                      onConfirm={() => mutate("vehicles/" + selected)}
                      okText={th ? "ลบรถ" : "Delete"}
                      cancelText={th ? "ยกเลิก" : "Cancel"}
                    >
                      <Button
                        danger
                        aria-label={th ? "ลบรถ" : "Delete vehicle"}
                        loading={busy}
                        icon={<Trash size={18} />}
                      />
                    </Popconfirm>
                  </Space>
                </div>
                <div className={styles.stats}>
                  <Statistic
                    title={th ? "เลขไมล์ปัจจุบัน" : "Current mileage"}
                    value={current.vehicle.mileageKm ?? "—"}
                    suffix="km"
                  />
                  <Statistic
                    title={th ? "บันทึก service" : "Service records"}
                    value={current.services.total}
                  />
                  <Statistic
                    title={th ? "ค่า service รวม" : "Total service cost"}
                    value={current.totalCost}
                    precision={2}
                    prefix="฿"
                  />
                </div>
                <div className={styles.sectionTitle}>
                  <h3>
                    <ImageSquare size={20} />
                    {th ? "ภาพรถ" : "Vehicle photos"}
                  </h3>
                  <Upload
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    showUploadList={false}
                    disabled={current.vehicle.deleting}
                    beforeUpload={(file) => {
                      if (
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          file.type,
                        ) ||
                        file.size > MAX_IMAGE_BYTES
                      ) {
                        void message.error(
                          th
                            ? "ใช้ JPEG, PNG หรือ WebP ไม่เกิน 4 MB"
                            : "Use JPEG, PNG or WebP up to 4 MB",
                        );
                        return false;
                      }
                      enqueue({
                        id: crypto.randomUUID(),
                        file,
                        vehicleId: selected!,
                        state: "queued",
                      });
                      return false;
                    }}
                  >
                    <Button icon={<UploadSimple size={17} />}>
                      {th ? "เพิ่มรูป" : "Upload photos"}
                    </Button>
                  </Upload>
                </div>
                {current.photos.length ? (
                  <Image.PreviewGroup>
                    <div className={styles.photos}>
                      {current.photos.map((photo) => (
                        <div className={styles.photo} key={photo.id}>
                          <Image src={photoUrl(photo.id)} alt={photo.name} />
                          <div className={styles.photoActions}>
                            <Button
                              size="small"
                              type={
                                current.vehicle.coverPhotoId === photo.id
                                  ? "primary"
                                  : "default"
                              }
                              icon={
                                current.vehicle.coverPhotoId === photo.id ? (
                                  <Check size={12} />
                                ) : undefined
                              }
                              disabled={busy || current.vehicle.deleting}
                              onClick={() =>
                                mutate("vehicles/" + selected, "PATCH", {
                                  coverPhotoId: photo.id,
                                })
                              }
                            >
                              {th ? "ภาพปก" : "Cover"}
                            </Button>
                            <Popconfirm
                              title={
                                th
                                  ? "ย้ายรูปนี้ไปถังขยะ Drive?"
                                  : "Move this photo to Drive trash?"
                              }
                              onConfirm={() =>
                                mutate(
                                  "vehicles/" +
                                    selected +
                                    "/photos/" +
                                    photo.id,
                                )
                              }
                            >
                              <Button
                                size="small"
                                danger
                                disabled={busy}
                                aria-label={th ? "ลบรูป" : "Delete photo"}
                                icon={<Trash size={13} />}
                              />
                            </Popconfirm>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Image.PreviewGroup>
                ) : (
                  <div className={styles.photoEmpty}>
                    <ImageSquare size={25} />
                    <span>
                      {th
                        ? "เพิ่มรูปแรกของรถ รูปจะเก็บใน Google Drive"
                        : "Add your first photo. Images are stored in Google Drive."}
                    </span>
                  </div>
                )}
                {uploads
                  .filter((i) => i.vehicleId === selected)
                  .map((item) => (
                    <div className={styles.uploadRow} key={item.id}>
                      <span>{item.file.name}</span>
                      <Tag
                        color={
                          item.state === "error"
                            ? "red"
                            : item.state === "done"
                              ? "green"
                              : "gold"
                        }
                      >
                        {item.state === "done"
                          ? th
                            ? "บันทึกแล้ว"
                            : "Saved"
                          : item.state === "error"
                            ? th
                              ? "ไม่สำเร็จ"
                              : "Failed"
                            : item.state === "queued"
                              ? th
                                ? "รออัปโหลด"
                                : "Queued"
                              : th
                                ? "กำลังอัปโหลด"
                                : "Uploading"}
                      </Tag>
                      {item.state === "error" && (
                        <>
                          <small>{explain(item.error ?? "")}</small>
                          {item.error !== "UPLOAD_RECONCILE_REQUIRED" && (
                            <Button size="small" onClick={() => enqueue(item)}>
                              {th ? "ลองอีกครั้ง" : "Retry"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                <div className={styles.sectionTitle}>
                  <h3>
                    <Wrench size={20} />
                    {th ? "ประวัติ service" : "Service history"}
                  </h3>
                  <Button
                    type="primary"
                    disabled={current.vehicle.deleting}
                    icon={<Plus size={16} />}
                    onClick={() => openService()}
                  >
                    {th ? "เพิ่ม service" : "Add service"}
                  </Button>
                </div>
                <Table<ServiceRecord>
                  rowKey="id"
                  dataSource={current.services.items}
                  pagination={false}
                  scroll={{ x: 650 }}
                  locale={{
                    emptyText: th
                      ? "ยังไม่มีประวัติ service"
                      : "No service records yet",
                  }}
                  columns={[
                    {
                      title: th ? "วันที่" : "Date",
                      dataIndex: "occurredOn",
                      width: 110,
                    },
                    {
                      title: th ? "รายการ" : "Service",
                      dataIndex: "title",
                      render: (_, r) => (
                        <div>
                          <strong>{r.title}</strong>
                          <small className={styles.recordNote}>
                            {[r.workshop, r.notes].filter(Boolean).join(" · ")}
                          </small>
                        </div>
                      ),
                    },
                    {
                      title: th ? "เลขไมล์" : "Mileage",
                      dataIndex: "mileageKm",
                      render: (v) =>
                        v == null ? "—" : Number(v).toLocaleString() + " km",
                      width: 110,
                    },
                    {
                      title: th ? "ค่าใช้จ่าย" : "Cost",
                      dataIndex: "cost",
                      render: (v) =>
                        v == null
                          ? "—"
                          : "฿" +
                            Number(v).toLocaleString(locale, {
                              minimumFractionDigits: 2,
                            }),
                      width: 110,
                    },
                    {
                      title: "",
                      width: 95,
                      render: (_, r) => (
                        <Space>
                          <Button
                            type="text"
                            size="small"
                            aria-label={th ? "แก้ไข service" : "Edit service"}
                            disabled={current.vehicle.deleting}
                            icon={<PencilSimple size={16} />}
                            onClick={() => openService(r)}
                          />
                          <Popconfirm
                            title={
                              th
                                ? "ลบรายการ service นี้?"
                                : "Delete this service record?"
                            }
                            onConfirm={() =>
                              mutate(
                                "vehicles/" + selected + "/services/" + r.id,
                              )
                            }
                          >
                            <Button
                              type="text"
                              size="small"
                              danger
                              aria-label={th ? "ลบ service" : "Delete service"}
                              icon={<Trash size={16} />}
                              disabled={busy}
                            />
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                />
                <Pagination
                  className={styles.pagination ?? ""}
                  current={page}
                  pageSize={8}
                  total={current.services.total}
                  showSizeChanger={false}
                  onChange={setPage}
                />
              </>
            )}
          </section>
        </div>
      )}
      <section className={styles.sampleSection}>
        <div className={styles.sectionTitle}>
          <div>
            <p className="eyebrow">FROM YOUR DRIVE</p>
            <h3>{th ? "ภาพจาก iRide image" : "From iRide image"}</h3>
          </div>
          <a
            className="section-note"
            href="https://drive.google.com/drive/u/0/folders/1O04FZl_7gmtzQPZ2BLhr33taQDCC3JAy"
            target="_blank"
            rel="noreferrer"
          >
            GOOGLE DRIVE <ArrowUpRight size={13} />
          </a>
        </div>
        <Image.PreviewGroup>
          <div className={styles.samples}>
            <Card
              cover={
                <Image
                  src="/samples/car-01.jpg"
                  alt={
                    th
                      ? "รูปพาหนะตัวอย่างจาก Google Drive ภาพที่ 1"
                      : "Vehicle photo supplied from Google Drive, image 1"
                  }
                />
              }
            >
              01 / iRide image
            </Card>
            <Card
              cover={
                <Image
                  src="/samples/car-02.jpg"
                  alt={
                    th
                      ? "รูปพาหนะตัวอย่างจาก Google Drive ภาพที่ 2"
                      : "Vehicle photo supplied from Google Drive, image 2"
                  }
                />
              }
            >
              02 / iRide image
            </Card>
          </div>
        </Image.PreviewGroup>
      </section>
      <Modal
        open={vehicleModal !== null}
        title={th ? "ข้อมูลรถ" : "Vehicle details"}
        onCancel={() => {
          if (!saving) setVehicleModal(null);
        }}
        onOk={saveVehicle}
        confirmLoading={saving}
        okButtonProps={{ "aria-label": th ? "บันทึก" : "Save" }}
        okText={th ? "บันทึก" : "Save"}
        cancelText={th ? "ยกเลิก" : "Cancel"}
      >
        <Form name="vehicle" form={vehicleForm} layout="vertical">
          <Form.Item
            name="name"
            label={th ? "ชื่อรถ" : "Name"}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input
              maxLength={160}
              placeholder={th ? "เช่น รถคันโปรด" : "e.g. Weekend ride"}
            />
          </Form.Item>
          <div className={styles.formGrid}>
            <Form.Item name="brand" label={th ? "ยี่ห้อ" : "Brand"}>
              <Input maxLength={160} />
            </Form.Item>
            <Form.Item name="model" label={th ? "รุ่น" : "Model"}>
              <Input maxLength={160} />
            </Form.Item>
            <Form.Item name="year" label={th ? "ปี" : "Year"}>
              <InputNumber min={1900} max={2100} precision={0} />
            </Form.Item>
            <Form.Item name="plate" label={th ? "ทะเบียน" : "Plate"}>
              <Input maxLength={40} />
            </Form.Item>
          </div>
          <Form.Item
            name="mileageKm"
            label={th ? "เลขไมล์ปัจจุบัน (km)" : "Current mileage (km)"}
          >
            <InputNumber min={0} max={10000000} precision={0} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={serviceModal !== null}
        title={th ? "บันทึก service" : "Service record"}
        onCancel={() => {
          if (!saving) setServiceModal(null);
        }}
        onOk={saveService}
        confirmLoading={saving}
        okButtonProps={{ "aria-label": th ? "บันทึก" : "Save" }}
        okText={th ? "บันทึก" : "Save"}
        cancelText={th ? "ยกเลิก" : "Cancel"}
      >
        <Form name="service" form={serviceForm} layout="vertical">
          <Form.Item
            name="title"
            label={th ? "รายการ service" : "Service"}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={160} />
          </Form.Item>
          <div className={styles.formGrid}>
            <Form.Item
              name="occurredOn"
              label={th ? "วันที่" : "Date"}
              rules={[{ required: true }]}
            >
              <Input type="date" />
            </Form.Item>
            <Form.Item
              name="mileageKm"
              label={th ? "เลขไมล์ (km)" : "Mileage (km)"}
            >
              <InputNumber min={0} max={10000000} precision={0} />
            </Form.Item>
          </div>
          <Form.Item
            name="workshop"
            label={th ? "อู่ / ศูนย์บริการ" : "Workshop"}
          >
            <Input maxLength={160} />
          </Form.Item>
          <Form.Item name="cost" label={th ? "ค่าใช้จ่าย (บาท)" : "Cost (THB)"}>
            <InputNumber min={0} max={100000000} precision={2} />
          </Form.Item>
          <Form.Item name="notes" label={th ? "หมายเหตุ" : "Notes"}>
            <Input.TextArea maxLength={4000} rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
