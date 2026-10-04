"use client";
import { Alert, Button, Form, Input, InputNumber, Select } from "antd";
import type { VehicleRecordDto, VehicleRecordInput } from "@iride/types";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import { browserApiMutation } from "@/services/browser-api";
import styles from "./owner-garage.module.css";

export function GarageRecordForm({
  vehicleId,
  initial,
  locale,
  onSaved,
}: {
  readonly vehicleId: string;
  readonly initial: VehicleRecordDto | null;
  readonly locale: Locale;
  readonly onSaved: () => void;
}) {
  const th = locale === "th";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const defaults = initial
    ? {
        kind: initial.kind,
        title: initial.title,
        occurredOn: initial.occurredOn,
        mileageKm: initial.mileageKm,
        description: initial.description,
        workshopName: initial.workshopName,
      }
    : { kind: "service", occurredOn: new Date().toLocaleDateString("en-CA") };
  return (
    <Form<VehicleRecordInput>
      layout="vertical"
      initialValues={defaults}
      onFinish={async (values) => {
        setBusy(true);
        setError(false);
        try {
          await browserApiMutation(
            `/vehicles/${vehicleId}/records${initial ? `/${initial.id}` : ""}`,
            initial ? "PATCH" : "POST",
            {
              ...values,
              mileageKm: values.mileageKm ?? null,
              description: values.description?.trim() || null,
              workshopName: values.workshopName?.trim() || null,
            },
          );
          onSaved();
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
      <Form.Item
        name="kind"
        label={th ? "ประเภท" : "Type"}
        rules={[{ required: true }]}
      >
        <Select
          options={[
            { value: "service", label: th ? "บำรุงรักษา" : "Service" },
            { value: "modification", label: th ? "การแต่งรถ" : "Modification" },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="title"
        label={th ? "หัวข้อ" : "Title"}
        rules={[{ required: true, whitespace: true }]}
      >
        <Input maxLength={160} />
      </Form.Item>
      <div className={styles.fields}>
        <Form.Item
          name="occurredOn"
          label={th ? "วันที่" : "Date"}
          rules={[{ required: true }]}
        >
          <Input type="date" />
        </Form.Item>
        <Form.Item
          name="mileageKm"
          label={th ? "ระยะทาง (km)" : "Mileage (km)"}
        >
          <InputNumber min={0} max={10000000} style={{ width: "100%" }} />
        </Form.Item>
      </div>
      <Form.Item
        name="workshopName"
        label={th ? "ร้าน / ผู้ให้บริการ" : "Shop / provider"}
      >
        <Input maxLength={160} />
      </Form.Item>
      <Form.Item name="description" label={th ? "รายละเอียด" : "Description"}>
        <Input.TextArea rows={3} maxLength={5000} />
      </Form.Item>
      <Button
        aria-label={th ? "บันทึก" : "Save"}
        aria-busy={busy}
        type="primary"
        htmlType="submit"
        loading={busy}
        style={{ minHeight: 44 }}
      >
        {th ? "บันทึก" : "Save"}
      </Button>
    </Form>
  );
}
