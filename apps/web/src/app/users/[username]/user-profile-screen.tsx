"use client";

import { buttonVariants } from "@iride/ui/button";
import type { OwnProfileDto, PublicProfileDto } from "@iride/types";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { Locale } from "@/lib/locale";
import { editProfile } from "../../profile/actions";
import { ProfileForm } from "../../profile/profile-form";

export function UserProfileScreen({
  locale,
  ownerProfile,
  profile,
}: {
  readonly locale: Locale;
  readonly ownerProfile: OwnProfileDto | null;
  readonly profile: PublicProfileDto;
}) {
  const [editing, setEditing] = useState(false);
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const text = locale === "th"
    ? { profile:"โปรไฟล์ผู้ขับขี่",location:"พื้นที่",edit:"แก้ไขโปรไฟล์",cancel:"ยกเลิก",home:"กลับหน้าหลัก",emptyBio:"ยังไม่ได้เขียนคำแนะนำตัว" }
    : { profile:"Rider profile",location:"Location",edit:"Edit profile",cancel:"Cancel",home:"Back home",emptyBio:"No bio yet." };

  return <article className="user-profile-shell">
    <div className="profile-cover-media"><Image alt="Adventure rider profile cover" className="object-cover" fill priority sizes="960px" src="/media/hero-road.webp"/><div aria-hidden="true"/></div>
    <div className="user-profile-body">
      <div className="user-profile-avatar">{initials}</div>
      {editing && ownerProfile ? <section className="profile-inline-editor"><div className="section-heading"><div><p className="premium-kicker">{text.profile}</p><h1>{text.edit}</h1></div><button onClick={()=>setEditing(false)} type="button">{text.cancel}</button></div><ProfileForm action={editProfile} initialProfile={ownerProfile} locale={locale}/></section> : <>
        <div className="space-y-2"><p className="premium-kicker">{text.profile}</p><h1 className="text-4xl font-black tracking-[-0.05em]">{profile.displayName}</h1><p className="font-mono text-sm text-muted-foreground">@{profile.username}</p></div>
        <p className="leading-7 text-muted-foreground">{profile.bio??text.emptyBio}</p>
        {profile.locationName?<dl className="rounded-2xl border border-border bg-background/25 p-4 text-sm"><dt className="text-muted-foreground">{text.location}</dt><dd className="mt-1 font-medium">{profile.locationName}</dd></dl>:null}
        <div className="flex flex-col gap-3 sm:flex-row"><Link className={buttonVariants({variant:"outline"})} href="/">{text.home}</Link>{ownerProfile?<button className={buttonVariants()} onClick={()=>setEditing(true)} type="button">{text.edit}</button>:null}</div>
      </>}
    </div>
  </article>;
}
