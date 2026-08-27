import { getRequestLocale } from "@/lib/request-locale";
import { CommunityScreen } from "../_components/demo-screens";
export default async function CommunityPage() { return <CommunityScreen locale={await getRequestLocale()} />; }
