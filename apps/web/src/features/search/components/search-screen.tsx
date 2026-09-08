"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { SearchResultDto } from "@iride/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  publicSearchResults,
  resolveBreadcrumbs,
  searchHref,
  searchResultHref,
} from "@/lib/app-navigation-domain";
import { searchContent } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";
import { Breadcrumbs } from "@/features/navigation/components/breadcrumbs";
import { PendingLink } from "@/features/navigation/components/pending-link";

export function SearchScreen({
  initialQuery,
  locale,
}: {
  readonly initialQuery: string;
  readonly locale: Locale;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const hasQueryHistoryEntry = useRef(Boolean(initialQuery.trim()));

  useEffect(() => {
    const restore = () => {
      setQuery(new URL(window.location.href).searchParams.get("q") ?? "");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      window.history.replaceState(window.history.state, "", "/search");
      hasQueryHistoryEntry.current = false;
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      const href = searchHref(value);
      if (`${window.location.pathname}${window.location.search}` !== href) {
        if (hasQueryHistoryEntry.current) {
          window.history.replaceState(null, "", href);
        } else {
          router.push(href, { scroll: false });
        }
        hasQueryHistoryEntry.current = true;
      }
      setLoading(true);
      void searchContent(value)
        .then((data) => {
          if (current) {
            setResults(publicSearchResults(data));
            setFailed(false);
          }
        })
        .catch(() => {
          if (current) {
            setResults([]);
            setFailed(true);
          }
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query, requestVersion, router]);

  const visibleResults = query.trim() ? results : [];

  return (
    <main className="search-page">
      <Breadcrumbs
        items={resolveBreadcrumbs("/search", { locale })}
        locale={locale}
      />
      <header>
        <p className="premium-kicker">iRide Search</p>
        <h1 data-route-heading tabIndex={-1}>
          {locale === "th" ? "ค้นหาทุกอย่างใน iRide" : "Search across iRide"}
        </h1>
      </header>
      <label className="search-page-input">
        <MagnifyingGlass size={22} />
        <span className="sr-only">Search</span>
        <input
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            locale === "th"
              ? "ผู้ใช้ โพสต์ กิจกรรม หรือ landmark…"
              : "People, posts, events or landmarks…"
          }
          value={query}
        />
      </label>
      <div
        aria-busy={loading}
        aria-live="polite"
        className="search-page-results"
      >
        {!query.trim() ? (
          <p>
            {locale === "th"
              ? "พิมพ์คำค้นหาเพื่อเริ่มต้น"
              : "Type something to begin."}
          </p>
        ) : null}
        {loading
          ? Array.from({ length: 3 }, (_, index) => (
              <div
                aria-hidden="true"
                className="search-result-row search-result-skeleton"
                key={index}
              />
            ))
          : null}
        {query.trim() && failed ? (
          <div className="search-error" role="alert">
            <p>{locale === "th" ? "ค้นหาไม่สำเร็จ" : "Search failed."}</p>
            <button
              onClick={() => setRequestVersion((value) => value + 1)}
              type="button"
            >
              {locale === "th" ? "ลองอีกครั้ง" : "Retry"}
            </button>
          </div>
        ) : null}
        {!loading
          ? visibleResults.map((result) => (
              <PendingLink
                className="search-result-row"
                href={searchResultHref(result)}
                key={`${result.kind}-${result.id}`}
              >
                <span>{labelFor(result.kind, locale)}</span>
                <strong>{result.title}</strong>
                <small>{result.subtitle}</small>
              </PendingLink>
            ))
          : null}
        {query.trim() && !loading && !failed && !visibleResults.length ? (
          <p>{locale === "th" ? "ไม่พบผลลัพธ์" : "No results found."}</p>
        ) : null}
      </div>
    </main>
  );
}

function labelFor(kind: SearchResultDto["kind"], locale: Locale) {
  const labels =
    locale === "th"
      ? { profile: "ผู้ใช้", post: "โพสต์", event: "กิจกรรม" }
      : { profile: "Profile", post: "Post", event: "Event" };
  return labels[kind];
}
