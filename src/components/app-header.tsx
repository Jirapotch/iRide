import Link from "next/link";
import { CarFront, LogOut, Plus, Settings, UserRound } from "lucide-react";
import { signOut } from "@/app/actions";
import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getViewerContext } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { initials } from "@/lib/profile-utils";
import type { Locale } from "@/lib/types";

export async function AppHeader({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const viewer = await getViewerContext();
  const profilePath = viewer?.username ? `/profile/${viewer.username}` : "/settings/profile";
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="iRide home"><BrandMark /></Link>
        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          <Link href="/feed" className="text-foreground transition-colors hover:text-primary">{dict.nav.feed}</Link>
          {viewer?.onboardingCompleted && <>
            <Link data-testid="member-garage-link" href={`${profilePath}#garage`} className="text-muted-foreground transition-colors hover:text-primary">{dict.nav.garage}</Link>
            <Link data-testid="member-profile-link" href={profilePath} className="text-muted-foreground transition-colors hover:text-primary">{dict.nav.profile}</Link>
          </>}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          {!viewer && <Button asChild size="sm" variant="outline" className="rounded-full"><Link href="/auth">{dict.nav.signIn}</Link></Button>}
          {viewer?.onboardingCompleted && <Button asChild size="sm" className="hidden gap-2 rounded-full px-4 sm:inline-flex"><Link data-testid="member-new-post-link" href="/post/new"><Plus className="size-4" />{dict.nav.newPost}</Link></Button>}
          {viewer && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button data-testid="account-menu" variant="ghost" size="icon" className="rounded-full" aria-label="Account menu"><Avatar className="size-8"><AvatarImage src={viewer.avatarUrl ?? undefined} alt={viewer.displayName} /><AvatarFallback>{initials(viewer.displayName)}</AvatarFallback></Avatar></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel><span className="block truncate">{viewer.displayName}</span>{viewer.username && <span className="block truncate font-normal text-muted-foreground">@{viewer.username}</span>}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {viewer.onboardingCompleted && <>
                <DropdownMenuItem asChild><Link href={profilePath}><UserRound />{dict.nav.profile}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href={`${profilePath}#garage`}><CarFront />{dict.nav.garage}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/post/new"><Plus />{dict.nav.newPost}</Link></DropdownMenuItem>
              </>}
              <DropdownMenuItem asChild><Link href="/settings"><Settings />{locale === "th" ? "ตั้งค่า" : "Settings"}</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={signOut}><DropdownMenuItem asChild variant="destructive"><button type="submit" className="w-full"><LogOut />{locale === "th" ? "ออกจากระบบ" : "Log out"}</button></DropdownMenuItem></form>
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>
    </header>
  );
}
