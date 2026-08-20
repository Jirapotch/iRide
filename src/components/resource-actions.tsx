"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deletePostAction, deleteVehicleAction } from "@/app/actions";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Locale } from "@/lib/types";

export function ResourceActions({ kind, id, editHref, locale, redirectAfterDelete }: {
  kind: "post" | "vehicle";
  id: string;
  editHref: string;
  locale: Locale;
  redirectAfterDelete?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const thai = locale === "th";
  const noun = kind === "post" ? (thai ? "โพสต์" : "post") : (thai ? "รถ" : "vehicle");
  const anchor = kind === "post" ? `post-${id}` : `vehicle-${id}`;
  const managedEditHref = `${editHref}?returnTo=${encodeURIComponent(`${pathname}#${anchor}`)}`;

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = kind === "post" ? await deletePostAction(id) : await deleteVehicleAction(id);
      if (!result.ok) return setError(result.message ?? (thai ? "ลบไม่สำเร็จ" : "Unable to delete"));
      setOpen(false);
      if (redirectAfterDelete) router.replace(redirectAfterDelete);
      else router.refresh();
    });
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-lg" className="rounded-full" aria-label={thai ? `จัดการ${noun}` : `Manage ${noun}`}><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem asChild className="min-h-10"><Link prefetch={false} href={managedEditHref}><Pencil />{thai ? "แก้ไข" : "Edit"}</Link></DropdownMenuItem>
        <DropdownMenuItem variant="destructive" className="min-h-10" onSelect={() => setOpen(true)}><Trash2 />{thai ? "ลบ" : "Delete"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{thai ? `ลบ${noun}นี้หรือไม่?` : `Delete this ${noun}?`}</AlertDialogTitle>
          <AlertDialogDescription>{thai ? "การลบนี้ย้อนกลับไม่ได้ กรุณาตรวจสอบก่อนยืนยัน" : "This cannot be undone. Please confirm before deleting."}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{thai ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} aria-busy={pending} onClick={remove}>
            {pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? (thai ? "กำลังลบ…" : "Deleting…") : (thai ? "ยืนยันการลบ" : "Delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
