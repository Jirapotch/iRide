import { AdminListSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminUsersLoading() {
  const locale = await getRequestLocale();
  return <AdminListSkeleton locale={locale} />;
}
