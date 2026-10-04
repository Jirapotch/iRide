"use client";

import type { OwnProfileDto } from "@iride/types";
import { Alert, Button, Form, Input, Select } from "antd";
import { useState, useTransition } from "react";
import type { Locale } from "@/lib/locale";
import type { ProfileFormState } from "./profile-form-state";

export function ProfileForm({
  action,
  initialProfile,
  locale,
  onSaved,
}: {
  readonly action: (
    state: ProfileFormState,
    formData: FormData,
  ) => Promise<ProfileFormState>;
  readonly initialProfile: OwnProfileDto;
  readonly locale: Locale;
  readonly onSaved?: () => void;
}) {
  const th = locale === "th";
  const [state, setState] = useState<ProfileFormState>({
    errorCode: null,
    fieldErrors: {},
    values: null,
  });
  const [pending, startTransition] = useTransition();
  const [form] = Form.useForm();
  const errors: Record<string, string> = th
    ? {
        USERNAME_TAKEN: "ชื่อผู้ใช้นี้ถูกใช้แล้ว",
        USERNAME_RESERVED: "ชื่อผู้ใช้นี้สงวนไว้",
        USERNAME_COOLDOWN: "เปลี่ยนชื่อผู้ใช้ได้ทุก 30 วัน",
      }
    : {
        USERNAME_TAKEN: "Username already in use.",
        USERNAME_RESERVED: "Username reserved.",
        USERNAME_COOLDOWN: "Username changes are available every 30 days.",
      };
  return (
    <Form
      validateMessages={{
        required: th ? "กรุณากรอก${label}" : "${label} is required.",
        string: {
          max: th
            ? "${label} ต้องมีไม่เกิน ${max} ตัวอักษร"
            : "${label} must be at most ${max} characters.",
        },
      }}
      form={form}
      layout="vertical"
      initialValues={{
        username: initialProfile.username ?? "",
        displayName: initialProfile.displayName ?? "",
        bio: initialProfile.bio ?? "",
        locationName: initialProfile.locationName ?? "",
        visibility: initialProfile.visibility,
      }}
      onFinish={(values) => {
        const data = new FormData();
        Object.entries(values).forEach(([key, value]) =>
          data.set(key, String(value ?? "")),
        );
        startTransition(async () => {
          try {
            const result = await action(state, data);
            setState(result);
            if (result.saved) onSaved?.();
          } catch (error) {
            if (error instanceof Error && "digest" in error) throw error;
            setState({ ...state, errorCode: "PROFILE_UPDATE_FAILED" });
          }
        });
      }}
    >
      {state.errorCode ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          title={
            errors[state.errorCode] ??
            (th
              ? "บันทึกไม่ได้ กรุณาตรวจสอบและลองใหม่"
              : "Could not save. Check your details and retry.")
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <Form.Item
        name="username"
        label={th ? "ชื่อผู้ใช้" : "Username"}
        rules={[
          { required: true },
          {
            pattern: /^[a-zA-Z0-9][a-zA-Z0-9_]{2,29}$/,
            message: th
              ? "ใช้ a-z, 0-9, _ จำนวน 3–30 ตัว"
              : "Use 3–30 letters, numbers or underscores.",
          },
        ]}
      >
        <Input autoCapitalize="none" autoComplete="username" maxLength={30} />
      </Form.Item>
      <Form.Item
        name="displayName"
        label={th ? "ชื่อที่แสดง" : "Display name"}
        rules={[{ required: true, max: 80 }]}
      >
        <Input maxLength={80} />
      </Form.Item>
      <Form.Item name="bio" label={th ? "แนะนำตัว" : "Bio"}>
        <Input.TextArea rows={3} maxLength={500} />
      </Form.Item>
      <Form.Item
        name="locationName"
        label={th ? "พื้นที่หรือเมือง" : "Area or city"}
      >
        <Input maxLength={120} />
      </Form.Item>
      <Form.Item name="visibility" label={th ? "การมองเห็น" : "Visibility"}>
        <Select
          options={[
            { value: "public", label: th ? "สาธารณะ" : "Public" },
            {
              value: "followers",
              label: th
                ? "ผู้ติดตาม (ขณะนี้สาธารณะ)"
                : "Followers (currently public)",
            },
            { value: "private", label: th ? "ส่วนตัว" : "Private" },
          ]}
        />
      </Form.Item>
      <Button
        aria-label={th ? "บันทึก" : "Save"}
        aria-busy={pending}
        htmlType="submit"
        type="primary"
        loading={pending}
        style={{ minHeight: 44 }}
      >
        {th ? "บันทึก" : "Save"}
      </Button>
    </Form>
  );
}
