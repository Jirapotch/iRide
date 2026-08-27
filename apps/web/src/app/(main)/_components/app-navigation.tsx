"use client";

import { Bell, Compass, Gear, ListMagnifyingGlass, MagnifyingGlass, MapPin, Plus, ShoppingBagOpen, SignIn, SlidersHorizontal, UserCircle, UsersThree, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { searchApp } from "@/lib/activity-domain";
import type { Locale } from "@/lib/locale";
import { activities, products, searchProfiles } from "@/lib/mock-content";
import { SignOutButton } from "../../auth/sign-out-button";
import { setLocale } from "../../locale-actions";
import { useMockApp } from "./mock-app-provider";

const navigation = [
  { href: "/", key: "discover", icon: Compass },
  { href: "/community", key: "community", icon: UsersThree },
  { href: "/create", key: "create", icon: Plus, create: true },
  { href: "/market", key: "market", icon: ShoppingBagOpen },
  { href: "/profile", key: "profile", icon: UserCircle },
] as const;

const labels = {
  th: { discover: "ค้นพบ", community: "ชุมชน", create: "สร้าง", market: "ตลาด", profile: "โปรไฟล์", search: "ค้นหา", notifications: "แจ้งเตือน", menu: "ตั้งค่า", close: "ปิด", searchTitle: "ค้นหาทุกอย่าง", placeholder: "โปรไฟล์ กิจกรรม หรือสินค้า", settings: "การตั้งค่า", language: "ภาษา", account: "บัญชี", login: "เข้าสู่ระบบ", logout: "ออกจากระบบ", noResults: "ยังไม่พบผลลัพธ์" },
  en: { discover: "Discover", community: "Community", create: "Create", market: "Market", profile: "Profile", search: "Search", notifications: "Notifications", menu: "Settings", close: "Close", searchTitle: "Search iRide", placeholder: "Profiles, activities or products", settings: "Settings", language: "Language", account: "Account", login: "Sign in", logout: "Sign out", noResults: "No results yet" },
} as const;

export function HeaderActions({ authenticated, locale }: { readonly authenticated: boolean; readonly locale: Locale }) {
  const text = labels[locale];
  const pathname = usePathname();
  const { state } = useMockApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const allActivities = useMemo(() => [...state.createdActivities, ...activities], [state.createdActivities]);
  const results = searchApp(query, allActivities, products, searchProfiles);

  useEffect(() => { if (searchOpen) inputRef.current?.focus(); }, [searchOpen]);

  return <>
    <nav className="desktop-nav" aria-label={locale === "th" ? "เมนูหลัก" : "Primary navigation"}>{navigation.map((item) => <NavLink item={item} locale={locale} pathname={pathname} key={item.href}/>)}</nav>
    <div className="header-actions">
      <button aria-label={text.search} className="header-icon" onClick={() => setSearchOpen(true)} type="button"><MagnifyingGlass size={20}/></button>
      <Link aria-label={text.notifications} className="header-icon relative" href="/notifications"><Bell size={20}/><span className="notification-dot"/></Link>
      <button aria-expanded={drawerOpen} aria-label={text.menu} className="header-icon" onClick={() => setDrawerOpen(true)} type="button"><SlidersHorizontal size={20}/></button>
    </div>
    {searchOpen ? <div className="overlay-shell" role="dialog" aria-modal="true" aria-label={text.searchTitle} onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
      <section className="search-panel"><header><div><p className="premium-kicker">iRide Search</p><h2>{text.searchTitle}</h2></div><button aria-label={text.close} className="header-icon" onClick={() => setSearchOpen(false)} type="button"><X size={21}/></button></header>
      <label className="global-search"><MagnifyingGlass size={20}/><span className="sr-only">{text.search}</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.placeholder}/></label>
      <div className="search-results premium-scrollbar">{query ? <>{renderGroup(locale === "th" ? "โปรไฟล์" : "Profiles", results.profiles, () => setSearchOpen(false))}{renderGroup(locale === "th" ? "กิจกรรม" : "Activities", results.activities, () => setSearchOpen(false))}{renderGroup(locale === "th" ? "สินค้า" : "Products", results.products, () => setSearchOpen(false))}{!results.profiles.length && !results.activities.length && !results.products.length ? <div className="empty-state"><ListMagnifyingGlass size={30}/>{text.noResults}</div> : null}</> : <div className="search-prompt"><MagnifyingGlass size={38}/><p>{locale === "th" ? "ค้นหาคน กิจกรรม และอุปกรณ์ในที่เดียว" : "Find people, activities and vehicle gear in one place."}</p></div>}</div></section>
    </div> : null}
    {drawerOpen ? <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}><aside className="settings-drawer" role="dialog" aria-modal="true" aria-label={text.settings}><header><div><p className="premium-kicker">iRide</p><h2>{text.settings}</h2></div><button aria-label={text.close} className="header-icon" onClick={() => setDrawerOpen(false)} type="button"><X size={21}/></button></header>
      <div className="drawer-content"><section><p className="drawer-label">{text.language}</p><form action={setLocale}><input name="locale" type="hidden" value={locale === "th" ? "en" : "th"}/><input name="returnTo" type="hidden" value={pathname}/><button className="drawer-row" type="submit"><span>{locale === "th" ? "ภาษาไทย" : "English"}</span><strong>{locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}</strong></button></form></section>
      <section><p className="drawer-label">{text.account}</p>{authenticated ? <><Link className="drawer-row" href="/account"><span><Gear size={20}/>{locale === "th" ? "ตั้งค่าบัญชี" : "Account settings"}</span></Link><SignOutButton label={text.logout}/></> : <Link className="drawer-row" href="/login"><span><SignIn size={20}/>{text.login}</span></Link>}</section></div>
    </aside></div> : null}
  </>;
}

export function BottomNavigation({ locale }: { readonly locale: Locale }) {
  const pathname = usePathname();
  return <nav className="bottom-nav" aria-label={locale === "th" ? "เมนูหลัก" : "Primary navigation"}>{navigation.map((item) => <NavLink item={item} locale={locale} pathname={pathname} key={item.href}/>)}</nav>;
}

function NavLink({ item, locale, pathname }: { item: typeof navigation[number]; locale: Locale; pathname: string }) {
  const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const isCreate = "create" in item && item.create;
  return <Link aria-current={active ? "page" : undefined} className={`${isCreate ? "create-nav" : "nav-item"} ${active ? "is-active" : ""}`} href={item.href}><span className={isCreate ? "create-orb" : "nav-icon"}><Icon size={isCreate ? 25 : 21} weight={active || isCreate ? "bold" : "regular"}/></span><span>{labels[locale][item.key]}</span></Link>;
}

function renderGroup(title: string, items: ReturnType<typeof searchApp>["profiles"], onNavigate: () => void) {
  if (!items.length) return null;
  return <section className="search-group"><h3>{title}</h3>{items.map((item) => { const href = item.kind === "activity" ? `/?activity=${item.id}` : item.kind === "product" ? `/market?product=${item.id}` : item.id === "maya-velocity" ? "/photographers/maya-velocity" : `/users/${item.id}`; return <Link href={href} key={`${item.kind}-${item.id}`} onClick={onNavigate}><span className="search-result-icon">{item.kind === "profile" ? <UserCircle size={20}/> : item.kind === "activity" ? <MapPinIcon/> : <ShoppingBagOpen size={20}/>}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></Link>; })}</section>;
}

function MapPinIcon() { return <MapPin size={20}/>; }
