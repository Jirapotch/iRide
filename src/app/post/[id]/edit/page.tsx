import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { PostEditForm } from "@/components/post-edit-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyVehicles, getOwnedPost } from "@/lib/data";
import { getLocale } from "@/lib/i18n-server";
import { safeNextPath } from "@/lib/auth-redirect";

export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [locale, post, vehicles] = await Promise.all([getLocale(), getOwnedPost(id), getMyVehicles()]);
  if (!post) notFound();
  const returnTo = query.returnTo ? safeNextPath(query.returnTo) : `/post/${id}`;
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8"><BackButton fallbackHref={returnTo} label={locale === "th" ? "กลับไปที่โพสต์" : "Back to post"} /><Card className="surface-shadow mt-2 border-white/70"><CardHeader><CardTitle>{locale === "th" ? "แก้ไขโพสต์" : "Edit post"}</CardTitle><CardDescription>{locale === "th" ? "อัปเดตเรื่องราว Vehicle หรือรูปภาพ" : "Update the story, vehicle, or photo."}</CardDescription></CardHeader><CardContent><PostEditForm post={post} vehicles={vehicles} locale={locale} returnTo={returnTo} /></CardContent></Card></main></>;
}
