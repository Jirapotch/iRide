import { CommunityFeedPage } from "../../_components/community-feed-page";
export default function PhotographersPage({ searchParams }: { readonly searchParams: Promise<{ readonly modal?: string; readonly post?: string }> }) { return <CommunityFeedPage category="photographers" heading={{ th: "ช่างภาพ", en: "Photographers" }} room="photographers" searchParams={searchParams} />; }
