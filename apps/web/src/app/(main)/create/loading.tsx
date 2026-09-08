import { CreateFormSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function CreateLoading() {
  const locale = await getRequestLocale();
  return <CreateFormSkeleton locale={locale} />;
}
