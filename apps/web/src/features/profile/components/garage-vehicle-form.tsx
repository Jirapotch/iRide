"use client";

import type { CreateVehicleInput, VehicleDto } from "@iride/types";
import { Alert, Button, Form, Input, InputNumber, Select } from "antd";
import { useState } from "react";
import Image from "next/image";
import type { Locale } from "@/lib/locale";
import { browserApiMutation } from "@/services/browser-api";
import { MediaUploader } from "./media-uploader";
import { mediaVariantUrl } from "@/lib/content-api";
import styles from "./owner-garage.module.css";

export function GarageVehicleForm({
  locale,
  initial,
  onSaved,
}: {
  readonly locale: Locale;
  readonly initial: VehicleDto | null;
  readonly onSaved: (id: string) => void;
}) {
  const th = locale === "th";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [mediaIds, setMediaIds] = useState<string[]>([
    ...(initial?.mediaIds ?? []),
  ]);
  return (
    <Form<CreateVehicleInput>
      layout="vertical"
      initialValues={initial ?? { kind: "car", visibility: "public" }}
      onFinish={async (values) => {
        setBusy(true);
        setError(false);
        try {
          const result = await browserApiMutation<VehicleDto>(
            initial ? `/vehicles/${initial.id}` : "/vehicles",
            initial ? "PATCH" : "POST",
            {
              ...values,
              year: values.year ?? null,
              nickname: values.nickname?.trim() || null,
              description: values.description?.trim() || null,
              mediaIds,
            },
          );
          onSaved(result.id);
        } catch {
          setError(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? (
        <Alert
          role="alert"
          type="error"
          title={
            th ? "บันทึกไม่ได้ กรุณาลองใหม่" : "Could not save. Please retry."
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <div className={styles.fields}>
        <Form.Item
          name="kind"
          label={th ? "ประเภท" : "Kind"}
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { value: "car", label: th ? "รถยนต์" : "Car" },
              { value: "motorcycle", label: th ? "มอเตอร์ไซค์" : "Motorcycle" },
              { value: "bicycle", label: th ? "จักรยาน" : "Bicycle" },
            ]}
          />
        </Form.Item>
        <Form.Item name="year" label={th ? "ปี" : "Year"}>
          <InputNumber
            min={1886}
            max={2100}
            precision={0}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Form.Item
          name="brand"
          label={th ? "ยี่ห้อ" : "Brand"}
          rules={[{ required: true, whitespace: true }]}
        >
          <Input maxLength={80} />
        </Form.Item>
        <Form.Item
          name="model"
          label={th ? "รุ่น" : "Model"}
          rules={[{ required: true, whitespace: true }]}
        >
          <Input maxLength={120} />
        </Form.Item>
      </div>
      <Form.Item name="nickname" label={th ? "ชื่อเล่น" : "Nickname"}>
        <Input maxLength={80} />
      </Form.Item>
      <Form.Item name="description" label={th ? "รายละเอียด" : "Description"}>
        <Input.TextArea rows={3} maxLength={2000} />
      </Form.Item>
      <Form.Item name="visibility" label={th ? "การมองเห็น" : "Visibility"}>
        <Select
          options={[
            { value: "public", label: th ? "สาธารณะ" : "Public" },
            { value: "private", label: th ? "ส่วนตัว" : "Private" },
          ]}
        />
      </Form.Item>
      <div className={styles.actions}>
        {mediaIds.map((id) => (
          <Button
            key={id}
            onClick={() =>
              setMediaIds((items) => items.filter((item) => item !== id))
            }
            aria-label={th ? "นำรูปออก" : "Remove photo"}
          >
            <Image
              src={mediaVariantUrl(id, "thumbnail")}
              alt=""
              width={44}
              height={32}
              unoptimized
            />{" "}
            ×
          </Button>
        ))}
      </div>
      {mediaIds.length < 8 ? (
        <MediaUploader
          locale={locale}
          purpose="vehicle"
          onReady={(id) => setMediaIds((items) => [...items, id])}
        />
      ) : null}
      <Button
        style={{ minHeight: 44, marginTop: 12 }}
        aria-label={th ? "บันทึก" : "Save"}
        aria-busy={busy}
        type="primary"
        htmlType="submit"
        loading={busy}
      >
        {th ? "บันทึก" : "Save"}
      </Button>
    </Form>
  );
}
