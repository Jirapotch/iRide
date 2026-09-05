"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { SearchResultDto } from "@iride/types";
import Link from "next/link";
import { useEffect, useState } from "react";

import { publicSearchResults, searchResultHref } from "@/lib/app-navigation-domain";
import { searchContent } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";

export function SearchScreen({ locale }: { readonly locale: Locale }) {
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
      void searchContent(value).then((data) => { if (current) { setResults(publicSearchResults(data)); setFailed(false); } }).catch(() => { if (current) { setResults([]); setFailed(true); } }).finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query]);

  const visibleResults = query.trim() ? results : [];

  return <main className="search-page">
    <header><p className="premium-kicker">iRide Search</p><h1>{locale === "th" ? "ค้นหาทุกอย่างใน iRide" : "Search across iRide"}</h1></header>
    <label className="search-page-input"><MagnifyingGlass size={22}/><span className="sr-only">Search</span><input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder={locale === "th" ? "ผู้ใช้ โพสต์ กิจกรรม หรือ landmark…" : "People, posts, events or landmarks…"} value={query}/></label>
    <div className="search-page-results" aria-busy={loading} aria-live="polite">
      {!query.trim() ? <p>{locale === "th" ? "พิมพ์คำค้นหาเพื่อเริ่มต้น" : "Type something to begin."}</p> : null}
      {query.trim() && failed ? <p>{locale === "th" ? "ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง" : "Search failed. Please try again."}</p> : null}
      {visibleResults.map((result) => <Link className="search-result-row" href={searchResultHref(result)} key={`${result.kind}-${result.id}`}><span>{labelFor(result.kind, locale)}</span><strong>{result.title}</strong><small>{result.subtitle}</small></Link>)}
      {query.trim() && !loading && !failed && !visibleResults.length ? <p>{locale === "th" ? "ไม่พบผลลัพธ์" : "No results found."}</p> : null}
    </div>
  </main>;
}

function labelFor(kind: SearchResultDto["kind"], locale: Locale) {
  const labels = locale === "th" ? { profile: "ผู้ใช้", post: "โพสต์", event: "กิจกรรม" } : { profile: "Profile", post: "Post", event: "Event" };
  return labels[kind];
}
