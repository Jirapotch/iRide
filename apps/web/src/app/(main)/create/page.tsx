import { getRequestLocale } from "@/lib/request-locale";

import { CreateActivityScreen } from "../_components/create-activity-screen";

export default async function CreatePage() {
  return <CreateActivityScreen locale={await getRequestLocale()} />;
}
