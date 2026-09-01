import { CommunityFeedPage } from "../../_components/community-feed-page";
export default function GroupsPage({ searchParams }: { readonly searchParams: Promise<{ readonly modal?: string; readonly post?: string }> }) { return <CommunityFeedPage category="groups" heading={{ th: "กลุ่ม", en: "Groups" }} room="groups" searchParams={searchParams} />; }
