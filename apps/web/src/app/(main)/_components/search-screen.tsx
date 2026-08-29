"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { SearchResultDto } from "@iride/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { searchResultHref } from "@/lib/app-navigation-domain";
import { searchContent } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";
import { products } from "@/lib/mock-content";

import { useMockApp } from "./mock-app-provider";

export function SearchScreen({ locale }: { readonly locale: Locale }) {
  const { state } = useMockApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const value = query.trim();
    if (!value) return;
    let current = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchContent(value).then((data) => { if (current) { setResults(data); setFailed(false); } }).catch(() => { if (current) { setResults([]); setFailed(true); } }).finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query]);

  const visibleResults = query.trim() ? results : [];

  const market = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return [];
    return [...state.createdProducts, ...products].filter((product) => `${product.name} ${product.category}`.toLocaleLowerCase().includes(value));
  }, [query, state.createdProducts]);

  return <main className="search-page">
    <header><p className="premium-kicker">iRide Search</p><h1>{locale === "th" ? "ค้นหาทุกอย่างใน iRide" : "Search across iRide"}</h1></header>
    <label className="search-page-input"><MagnifyingGlass size={22}/><span className="sr-only">Search</span><input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder={locale === "th" ? "ผู้ใช้ โพสต์ กิจกรรม หรือสินค้า…" : "People, posts, events or products…"} value={query}/></label>
    <div className="search-page-results" aria-busy={loading} aria-live="polite">
      {!query.trim() ? <p>{locale === "th" ? "พิมพ์คำค้นหาเพื่อเริ่มต้น" : "Type something to begin."}</p> : null}
      {query.trim() && failed ? <p>{locale === "th" ? "ค้นหา backend ไม่สำเร็จ แต่ยังค้นหาสินค้าเดโมได้" : "Backend search is unavailable; demo market results are still shown."}</p> : null}
      {visibleResults.map((result) => <Link className="search-result-row" href={searchResultHref(result)} key={`${result.kind}-${result.id}`}><span>{labelFor(result.kind, locale)}</span><strong>{result.title}</strong><small>{result.subtitle}</small></Link>)}
      {market.map((product) => <Link className="search-result-row" href={`/community?room=market&product=${product.id}`} key={`market-${product.id}`}><span>{locale === "th" ? "สินค้า" : "Market"}</span><strong>{product.name}</strong><small>{product.price} · {product.category}</small></Link>)}
      {query.trim() && !loading && !failed && !visibleResults.length && !market.length ? <p>{locale === "th" ? "ไม่พบผลลัพธ์" : "No results found."}</p> : null}
    </div>
  </main>;
}

function labelFor(kind: SearchResultDto["kind"], locale: Locale) {
  const labels = locale === "th" ? { profile: "ผู้ใช้", post: "โพสต์", event: "กิจกรรม", photographerSpot: "จุดช่างภาพ" } : { profile: "Profile", post: "Post", event: "Event", photographerSpot: "Photographer spot" };
  return labels[kind];
}
