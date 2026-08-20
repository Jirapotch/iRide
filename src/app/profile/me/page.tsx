import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/data";

export default async function MyProfilePage() { const viewer = await getViewerContext(); if (!viewer) redirect(`/auth?next=${encodeURIComponent("/profile/me")}`); redirect(viewer.onboardingCompleted && viewer.username ? `/profile/${viewer.username}` : "/settings/profile"); }
