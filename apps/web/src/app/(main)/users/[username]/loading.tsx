import { ProfileSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function UserProfileLoading() {
  const locale = await getRequestLocale();
  return <ProfileSkeleton locale={locale} />;
}
