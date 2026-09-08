import { AdminDetailSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function AdminUserLoading() {
  const locale = await getRequestLocale();
  return <AdminDetailSkeleton locale={locale} />;
}
