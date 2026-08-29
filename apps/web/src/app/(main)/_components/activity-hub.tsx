"use client";

import { CalendarBlank, Camera, Crosshair, Funnel, Path, Trash, UsersThree, WarningCircle, X } from "@phosphor-icons/react";
import type { EventDto,ExploreFeatureDto, ExploreFeatureKind,PhotographerSpotDto } from "@iride/types";
import * as maplibregl from "maplibre-gl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "@/app/_components/theme-provider";
import { mapStyle } from "@/lib/app-navigation-domain";
import { getExploreContent } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";
import { applyMapPalette, contentKindColors } from "@/lib/map-palette";
import { removeContent } from "../create/actions";
import { BackendForm } from "./create-content-screen";
import { EditModal } from "./edit-modal";

const center: [number, number] = [100.5018, 13.7563];
const kinds: ExploreFeatureKind[] = ["meeting", "event", "trip", "photographerSpot"];

export function ActivityHub({ locale,initialEdit=null,editDenied=false }: { readonly locale: Locale;readonly initialEdit?:EventDto|PhotographerSpotDto|null;readonly editDenied?:boolean }) {
  const { theme } = useTheme();
  const params = useSearchParams();
  const [features, setFeatures] = useState<ExploreFeatureDto[]>([]);
  const [enabled, setEnabled] = useState<ExploreFeatureKind[]>(kinds);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("marker"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const themeRef = useRef(theme);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { themeRef.current = theme; const map = mapRef.current; if (map?.isStyleLoaded()) applyMapPalette(map, theme); }, [theme]);

  const loadViewport = useCallback(async (map: maplibregl.Map) => {
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    const bounds = map.getBounds(); setLoading(true);
    try {
      const active = enabledRef.current;
      const layers = Array.from(new Set(active.map((kind) => kind === "trip" ? "trips" : kind === "photographerSpot" ? "photographer-spots" : "events")));
      const data = await getExploreContent([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()], layers, controller.signal);
      setFeatures(data); setError(false);
    } catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const map = new maplibregl.Map({ container: containerRef.current, style: mapStyle(process.env.NEXT_PUBLIC_MAPTILER_KEY), center, zoom: 10, attributionControl: false });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
      mapRef.current = map;
      const resizeObserver = new ResizeObserver(() => map.resize()); resizeObserver.observe(containerRef.current);
      map.once("load", () => { applyMapPalette(map, themeRef.current); void loadViewport(map); });
      map.on("moveend", () => { if (timerRef.current) window.clearTimeout(timerRef.current); timerRef.current = window.setTimeout(() => void loadViewport(map), 300); });
      return () => { resizeObserver.disconnect(); requestRef.current?.abort(); if (timerRef.current) window.clearTimeout(timerRef.current); markerRefs.current.forEach((marker) => marker.remove()); map.remove(); mapRef.current = null; };
    } catch { window.setTimeout(() => { setError(true); setLoading(false); }, 0); }
  }, [loadViewport]);

  useEffect(() => { const map = mapRef.current; if (map?.loaded()) void loadViewport(map); }, [enabled, loadViewport]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = features.filter((feature) => enabled.includes(feature.kind)).map((feature) => {
      const button = document.createElement("button"); button.type = "button"; button.className = `activity-marker ${feature.id === selectedId ? "is-selected" : ""}`; button.style.setProperty("--marker-color", contentKindColors[feature.kind]); button.setAttribute("aria-label", feature.title); button.addEventListener("click", () => setSelectedId(feature.id));
      return new maplibregl.Marker({ element: button }).setLngLat([feature.longitude, feature.latitude]).addTo(map);
    });
  }, [enabled, features, selectedId]);

  const selected = useMemo(() => features.find((feature) => feature.id === selectedId) ?? null, [features, selectedId]);
  function toggle(kind: ExploreFeatureKind) { setEnabled((current) => current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind]); }
  function locate() { navigator.geolocation?.getCurrentPosition(({ coords }) => mapRef.current?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 13 })); }

  return <section className="discover-map on-map" aria-label={locale === "th" ? "แผนที่ค้นพบ" : "Discover map"}>
    <div className="map-canvas" ref={containerRef}/>
    {loading ? <div className="map-loading" role="status">{locale === "th" ? "กำลังโหลดพื้นที่…" : "Loading area…"}</div> : null}
    {error ? <div className="map-error-banner" role="alert"><WarningCircle size={18}/>{locale === "th" ? "โหลดข้อมูล marker ไม่สำเร็จ แผนที่ยังใช้งานได้" : "Markers could not load. The map is still available."}</div> : null}
    <button aria-expanded={filtersOpen} aria-label={locale === "th" ? "กรอง marker" : "Filter markers"} className="map-filter-fab" onClick={() => setFiltersOpen((value) => !value)} type="button"><Funnel size={22}/></button>
    <button aria-label={locale === "th" ? "ตำแหน่งฉัน" : "Locate me"} className="map-locate-fab" onClick={locate} type="button"><Crosshair size={20}/></button>
    {filtersOpen ? <div className="map-filter-menu">{kinds.map((kind) => { const Icon = kind === "meeting" ? UsersThree : kind === "event" ? CalendarBlank : kind === "trip" ? Path : Camera; return <label key={kind} style={{ "--marker-color": contentKindColors[kind] } as CSSProperties}><input checked={enabled.includes(kind)} onChange={() => toggle(kind)} type="checkbox"/><Icon size={17}/>{label(kind, locale)}</label>; })}</div> : null}
    {selected ? <FeatureSheet feature={selected} locale={locale} onClose={() => setSelectedId(null)}/> : null}
    {initialEdit?<EditModal closeUrl={`/?marker=${initialEdit.id}`} title={locale==="th"?"แก้ไขข้อมูล":"Edit details"}><BackendForm initial={initialEdit} locale={locale} type={"photographer" in initialEdit?"photographer-spot":initialEdit.kind==="trip"?"trip":"activity"}/></EditModal>:null}
    {editDenied?<div className="permission-toast" role="alert">{locale==="th"?"คุณไม่มีสิทธิ์แก้ไข marker นี้":"You do not have permission to edit this marker."}</div>:null}
  </section>;
}

function FeatureSheet({ feature, locale, onClose }: { readonly feature: ExploreFeatureDto; readonly locale: Locale; readonly onClose: () => void }) {
  const domain = feature.kind === "photographerSpot" ? "photographer-spots" : "events";
  return <aside className="activity-sheet" aria-label={feature.title} role="dialog"><button aria-label="Close" className="sheet-close" onClick={onClose} type="button"><X size={18}/></button><div className="activity-sheet-body"><span className="kind-badge" style={{ "--marker-color": contentKindColors[feature.kind] } as CSSProperties}>{label(feature.kind, locale)}</span><h2>{feature.title}</h2><p>{feature.subtitle}</p><p><Link href={`/users/${feature.author.username}`}>{feature.author.displayName}</Link> · <time dateTime={feature.startsAt}>{new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(feature.startsAt))}</time></p>{feature.canEdit ? <div className="owner-actions"><Link href={`/?marker=${feature.id}&modal=edit`}>{locale === "th" ? "แก้ไข" : "Edit"}</Link><form action={removeContent}><input name="domain" type="hidden" value={domain}/><input name="id" type="hidden" value={feature.id}/><button type="submit"><Trash size={16}/>{locale === "th" ? "ลบ" : "Delete"}</button></form></div> : null}</div></aside>;
}

function label(kind: ExploreFeatureKind, locale: Locale) { const labels = locale === "th" ? { meeting: "นัดพบ", event: "กิจกรรม", trip: "ทริป", photographerSpot: "จุดช่างภาพ" } : { meeting: "Meeting", event: "Event", trip: "Trip", photographerSpot: "Photographer spot" }; return labels[kind]; }
