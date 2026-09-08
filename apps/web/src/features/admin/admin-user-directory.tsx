"use client";

import { Table, Tag, type TableColumnsType } from "antd";
import { useEffect } from "react";

import type { AdminUserDto } from "@/lib/admin-users-api";
import { adminUserDetailHref } from "@/lib/app-navigation-domain";
import type { Locale } from "@/lib/locale";
import { PendingLink } from "@/features/navigation/components/pending-link";

export function AdminUserDirectory({
  locale,
  returnHref,
  users,
}: {
  readonly locale: Locale;
  readonly returnHref: string;
  readonly users: readonly AdminUserDto[];
}) {
  useEffect(() => {
    const value = window.sessionStorage.getItem(
      `iride:admin-users-scroll:${returnHref}`,
    );
    if (!value) return;
    window.sessionStorage.removeItem(`iride:admin-users-scroll:${returnHref}`);
    const top = Number(value);
    if (!Number.isFinite(top)) return;
    const timeout = window.setTimeout(() => window.scrollTo(0, top), 80);
    return () => window.clearTimeout(timeout);
  }, [returnHref]);

  const columns: TableColumnsType<AdminUserDto> = [
    {
      title: locale === "th" ? "ผู้ใช้" : "User",
      key: "user",
      render: (_, user) => (
        <PendingLink
          href={adminUserDetailHref(user.id, returnHref)}
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.altKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey
            ) {
              window.sessionStorage.setItem(
                "iride:admin-users-origin",
                returnHref,
              );
              window.sessionStorage.setItem(
                `iride:admin-users-scroll:${returnHref}`,
                String(window.scrollY),
              );
            }
          }}
        >
          <strong>
            {user.displayName ?? (locale === "th" ? "ยังไม่มีชื่อ" : "No name")}
          </strong>
          <small className="admin-table-secondary">
            @{user.username ?? "-"}
          </small>
        </PendingLink>
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
        <Tag
          color={
            value === "active"
              ? "success"
              : value === "locked"
                ? "warning"
                : "error"
          }
        >
          {value}
        </Tag>
      ),
    },
  ];

  return (
    <div className="admin-user-table">
      <Table
        columns={columns}
        dataSource={[...users]}
        pagination={false}
        rowKey="id"
      />
    </div>
  );
}
