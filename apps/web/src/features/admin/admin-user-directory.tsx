"use client";

import { Table, Tag, type TableColumnsType } from "antd";
import Link from "next/link";

import type { AdminUserDto } from "@/lib/admin-users-api";
import type { Locale } from "@/lib/locale";

export function AdminUserDirectory({
  locale,
  users,
}: {
  readonly locale: Locale;
  readonly users: readonly AdminUserDto[];
}) {
  const columns: TableColumnsType<AdminUserDto> = [
    {
      title: locale === "th" ? "ผู้ใช้" : "User",
      key: "user",
      render: (_, user) => (
        <Link href={`/settings/users/${user.id}`}>
          <strong>{user.displayName ?? (locale === "th" ? "ยังไม่มีชื่อ" : "No name")}</strong>
          <small className="admin-table-secondary">@{user.username ?? "-"}</small>
        </Link>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: locale === "th" ? "สิทธิ์" : "Role",
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: locale === "th" ? "สถานะ" : "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: string) => (
        <Tag color={value === "active" ? "success" : value === "locked" ? "warning" : "error"}>
          {value}
        </Tag>
      ),
    },
  ];

  return (
    <div className="admin-user-table">
      <Table columns={columns} dataSource={[...users]} pagination={false} rowKey="id" />
    </div>
  );
}
