"use client";

import { Camera, Storefront, UsersThree } from "@phosphor-icons/react";
import type { PhotographerSpotDto, PostDto } from "@iride/types";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { communityRooms, type CommunityRoomId } from "@/lib/app-navigation-domain";
import type { Locale } from "@/lib/locale";
import { products } from "@/lib/mock-content";

import { useMockApp } from "./mock-app-provider";

export function CommunityScreen({
  locale,
  posts,
  spots,
}: {
  readonly locale: Locale;
  readonly posts: readonly PostDto[];
  readonly spots: readonly PhotographerSpotDto[];
}) {
  const params = useSearchParams();
  const requested = params.get("room");
  const room: CommunityRoomId = communityRooms.some((item) => item.id === requested)
    ? (requested as CommunityRoomId)
    : "talk";

  return (
    <div className="community-page">
      <header className="community-heading">
        <p className="premium-kicker">iRide Community</p>
        <h1>{locale === "th" ? "ชุมชนของคนรักการเดินทาง" : "A community built around movement"}</h1>
      </header>
      <nav className="community-rooms" aria-label={locale === "th" ? "ห้องชุมชน" : "Community rooms"}>
        {communityRooms.map((item) => (
          <Link aria-current={item.id === room ? "page" : undefined} href={`/community?room=${item.id}`} key={item.id}>
            {item.label[locale]}
          </Link>
        ))}
      </nav>
      {room === "talk" ? <TalkRoom locale={locale} posts={posts} /> : null}
      {room === "market" ? <MarketRoom locale={locale} /> : null}
      {room === "photographers" ? <PhotographerRoom locale={locale} spots={spots} /> : null}
      {room === "groups" ? <GroupsRoom locale={locale} /> : null}
    </div>
  );
}

function TalkRoom({ locale, posts }: { readonly locale: Locale; readonly posts: readonly PostDto[] }) {
  return <section className="community-feed">
    <Link className="community-create-link" href="/create?type=post">+ {locale === "th" ? "เขียนโพสต์" : "Write a post"}</Link>
    {posts.length ? posts.map((post) => <article className="premium-card community-post" id={`post-${post.id}`} key={post.id}>
      <header><Link href={`/users/${post.author.username}`}>{post.author.displayName}</Link><span>@{post.author.username}</span></header>
      <p>{post.body}</p>
      <footer><time dateTime={post.createdAt}>{new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.createdAt))}</time>{post.canEdit ? <Link href={`/create?type=post&edit=${post.id}`}>{locale === "th" ? "แก้ไข" : "Edit"}</Link> : null}</footer>
    </article>) : <Empty text={locale === "th" ? "ยังไม่มีโพสต์ เริ่มบทสนทนาแรกได้เลย" : "No posts yet. Start the first conversation."} />}
  </section>;
}

function MarketRoom({ locale }: { readonly locale: Locale }) {
  const { state, dispatch } = useMockApp();
  const params = useSearchParams();
  const allProducts = [...state.createdProducts, ...products];
  return <section>
    <div className="room-action-row"><p>{locale === "th" ? "สินค้าเดโมจะถูกเก็บไว้ในเบราว์เซอร์นี้" : "Demo products are stored in this browser."}</p><Link href="/create?type=market">+ {locale === "th" ? "ลงขายสินค้า" : "Sell an item"}</Link></div>
    <div className="product-grid">{allProducts.map((product) => { const selected = state.selectedProductIds.includes(product.id) || params.get("product") === product.id; return <article className={`product-card ${selected ? "is-selected" : ""}`} id={`product-${product.id}`} key={product.id}><div className="product-media"><Image alt="" height={480} src={product.image} width={480}/><span>{product.category}</span></div><div className="p-3"><h2>{product.name}</h2><p>{product.price}</p><button aria-pressed={selected} onClick={() => dispatch({ type: "toggle-product", productId: product.id })} type="button"><Storefront size={17}/>{selected ? (locale === "th" ? "เลือกแล้ว" : "Selected") : (locale === "th" ? "เลือกสินค้า" : "Select")}</button></div></article>; })}</div>
  </section>;
}

function PhotographerRoom({ locale, spots }: { readonly locale: Locale; readonly spots: readonly PhotographerSpotDto[] }) {
  const photographers = Array.from(new Map(spots.map((spot) => [spot.photographer.username, spot.photographer])).values());
  return <section className="room-card-grid">{photographers.length ? photographers.map((person) => <Link className="premium-card room-person-card" href={`/users/${person.username}`} key={person.username}><Camera size={24}/><strong>{person.displayName}</strong><span>@{person.username}</span></Link>) : <Empty text={locale === "th" ? "ยังไม่มีช่างภาพที่ลง landmark" : "No photographers have published a landmark yet."} />}</section>;
}

function GroupsRoom({ locale }: { readonly locale: Locale }) {
  const groups = ["Bangkok Weekend Riders", "Classic Car Thailand", "City Bicycle Crew"];
  return <section className="room-card-grid">{groups.map((name) => <article className="premium-card room-person-card" key={name}><UsersThree size={24}/><strong>{name}</strong><span>{locale === "th" ? "กลุ่มเดโม" : "Demo group"}</span></article>)}</section>;
}

function Empty({ text }: { readonly text: string }) { return <div className="empty-state"><strong>{text}</strong></div>; }
