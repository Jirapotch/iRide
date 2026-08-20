import Link from "next/link";
import { CarFront, ImagePlus, MapPin, PenLine, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PostCard } from "@/components/post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFeed, getViewerContext } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { initials } from "@/lib/profile-utils";

export default async function FeedPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [posts, viewer] = await Promise.all([getFeed(), getViewerContext()]);
  const profilePath = viewer?.username ? `/profile/${viewer.username}` : "/settings/profile";
  return <><AppHeader locale={locale} /><main className={`mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 ${viewer ? "lg:grid-cols-[220px_minmax(0,620px)] xl:grid-cols-[220px_minmax(0,620px)_240px]" : "lg:grid-cols-[minmax(0,680px)_240px] lg:justify-center"}`}>
    {viewer && <aside data-testid="viewer-profile-card" className="hidden lg:block"><Card className="sticky top-22 border-white/70 bg-card/90"><CardContent className="space-y-5 p-5"><Avatar className="size-14"><AvatarImage src={viewer.avatarUrl ?? undefined} /><AvatarFallback>{initials(viewer.displayName)}</AvatarFallback></Avatar><div><p className="font-semibold">{viewer.displayName}</p><p className="text-xs text-muted-foreground">{viewer.username ? `@${viewer.username}` : "Complete your profile"}</p></div><div className="flex gap-5 text-xs"><div><strong className="block text-sm">{viewer.followersCount}</strong>Followers</div><div><strong className="block text-sm">{viewer.vehicleCount}</strong>Vehicles</div></div><Button asChild variant="outline" className="w-full"><Link href={profilePath}>View profile</Link></Button></CardContent></Card></aside>}
    <section className="min-w-0 space-y-4"><div className="mb-2"><h1 className="text-2xl font-bold tracking-tight">{dict.feed.title}</h1><p className="text-sm text-muted-foreground">{dict.feed.subtitle}</p></div>
      {viewer?.onboardingCompleted && <Card data-testid="post-composer" className="surface-shadow border-white/70 bg-card/95"><CardContent className="flex items-center gap-3 p-4"><Avatar className="size-10"><AvatarImage src={viewer.avatarUrl ?? undefined} /><AvatarFallback>{initials(viewer.displayName)}</AvatarFallback></Avatar><Button asChild variant="secondary" className="h-10 flex-1 justify-start rounded-full px-4 font-normal text-muted-foreground"><Link href="/post/new">{dict.feed.composer}</Link></Button><Button asChild size="icon" variant="ghost"><Link href="/post/new" aria-label="Add photo"><ImagePlus className="size-5 text-primary" /></Link></Button></CardContent></Card>}
      {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} locale={locale} canInteract={Boolean(viewer?.onboardingCompleted)} />) : <Card><CardContent className="grid place-items-center gap-3 p-12 text-center"><PenLine className="size-8 text-primary" /><h2 className="font-semibold">No stories yet</h2><p className="text-sm text-muted-foreground">Be the first to share a moment from the road.</p></CardContent></Card>}
    </section>
    <aside className="hidden lg:block"><div className="sticky top-22 space-y-4"><Card className="border-white/70 bg-card/90"><CardHeader><CardTitle className="text-base">Around you</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><CarFront className="size-4" /></div><div><p className="font-medium">Sunday Cars & Coffee</p><p className="text-xs text-muted-foreground">Bangkok · 46 drivers</p></div></div><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><MapPin className="size-4" /></div><div><p className="font-medium">Mae Rim morning run</p><p className="text-xs text-muted-foreground">Chiang Mai · Saturday</p></div></div></CardContent></Card><Card className="border-dashed bg-transparent"><CardContent className="space-y-3 p-5 text-center"><Users className="mx-auto size-6 text-primary" /><p className="text-sm font-medium">The feed gets better with every driver.</p>{!viewer && <Button asChild variant="outline" size="sm"><Link href="/auth">Join iRide</Link></Button>}</CardContent></Card></div></aside>
  </main></>;
}
