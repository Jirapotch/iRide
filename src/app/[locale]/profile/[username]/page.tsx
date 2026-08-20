import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Pencil, Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { FollowButton } from "@/components/follow-button";
import { VehicleCard } from "@/components/vehicle-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicProfile } from "@/lib/data";
import { assertLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> { const { username } = await params; return { title: `@${username}` }; }

export default async function ProfilePage({ params }: { params: Promise<{ locale: string; username: string }> }) {
  const { locale: localeParam, username } = await params; const locale = assertLocale(localeParam); const result = await getPublicProfile(username); if (!result) notFound(); const { profile, vehicles } = result;
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6"><Card className="surface-shadow overflow-hidden border-white/70 bg-card/95"><div className="h-32 bg-[radial-gradient(circle_at_20%_20%,oklch(0.78_0.13_235),transparent_35%),linear-gradient(120deg,oklch(0.57_0.19_257),oklch(0.68_0.15_230))] sm:h-44" /><CardContent className="relative px-5 pb-6 sm:px-8"><Avatar className="-mt-12 size-24 border-4 border-card sm:-mt-16 sm:size-32"><AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.displayName} /><AvatarFallback className="text-2xl">{profile.displayName.slice(0,2).toUpperCase()}</AvatarFallback></Avatar><div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row"><div><h1 className="text-2xl font-bold">{profile.displayName}</h1><p className="text-sm text-muted-foreground">@{profile.username}</p>{profile.bio && <p className="mt-4 max-w-xl leading-7">{profile.bio}</p>}{profile.location && <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" />{profile.location}</p>}<div className="mt-4 flex gap-5 text-sm"><span><strong>{profile.followersCount.toLocaleString()}</strong> <span className="text-muted-foreground">followers</span></span><span><strong>{profile.followingCount.toLocaleString()}</strong> <span className="text-muted-foreground">following</span></span></div></div><div className="flex items-start gap-2"><FollowButton locale={locale} profileId={profile.id} /><Button asChild size="icon" variant="outline" className="rounded-full"><Link href={`/${locale}/settings/profile`} aria-label="Edit profile"><Pencil className="size-4" /></Link></Button></div></div></CardContent></Card><section className="mt-10"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">My garage</p><h2 className="mt-1 text-2xl font-bold">Cars with a story</h2></div><Button asChild variant="outline" className="gap-2"><Link href={`/${locale}/garage/new`}><Plus className="size-4" />Add a car</Link></Button></div>{vehicles.length ? <div className="grid gap-5 sm:grid-cols-2">{vehicles.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}</div> : <Card className="border-dashed"><CardContent className="grid place-items-center gap-3 p-12 text-center"><p className="font-semibold">Garage is waiting for its first car.</p><Button asChild size="sm"><Link href={`/${locale}/garage/new`}>Add a car</Link></Button></CardContent></Card>}</section></main></>;
}
