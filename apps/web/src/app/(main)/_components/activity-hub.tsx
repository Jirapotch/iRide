"use client";

import { CalendarBlank, Camera, Car, Crosshair, List, MapTrifold, MapPin, Path, UsersThree, WarningCircle, X } from "@phosphor-icons/react";
import * as maplibregl from "maplibre-gl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BANGKOK_CENTER, filterActivities, type ActivityFilter, type ActivityItem } from "@/lib/activity-domain";
import { activities as fixtureActivities } from "@/lib/mock-content";
import type { Locale } from "@/lib/locale";
import { useMockApp } from "./mock-app-provider";

const filterMeta = {
  all: { en: "All", th: "ทั้งหมด", icon: MapTrifold },
  meeting: { en: "Meeting", th: "นัดพบ", icon: UsersThree },
  event: { en: "Event", th: "กิจกรรม", icon: CalendarBlank },
  trip: { en: "Trip", th: "ทริป", icon: Path },
  photographerSpot: { en: "Photographer", th: "ช่างภาพ", icon: Camera },
} as const;

const markerColors: Record<ActivityItem["kind"], string> = { meeting: "#168cff", event: "#9b7cff", trip: "#22c99a", photographerSpot: "#ffb44d" };

export function ActivityHub({ locale }: { readonly locale: Locale }) {
  const { state, dispatch } = useMockApp();
  const searchParams = useSearchParams();
  const allActivities = useMemo(() => [...state.createdActivities, ...fixtureActivities], [state.createdActivities]);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("activity"));
  const [mapError, setMapError] = useState(false);
  const visible = useMemo(
    () => filterActivities(allActivities, filter),
    [allActivities, filter],
  );
  const selected = allActivities.find((item) => item.id === selectedId) ?? null;

  const setView = (viewMode: "map" | "list") => dispatch({ type: "set-view-mode", viewMode });

  return <section className="activity-hub" aria-label={locale === "th" ? "ค้นหากิจกรรม" : "Discover activities"}>
    <div className="activity-toolbar">
      <div>
        <p className="premium-kicker">{locale === "th" ? "ใกล้กรุงเทพฯ" : "Around Bangkok"}</p>
        <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{locale === "th" ? "ออกไปเจอกัน" : "Find your next move"}</h1>
      </div>
      <div className="view-switch" aria-label={locale === "th" ? "รูปแบบมุมมอง" : "View mode"} role="group">
        <button aria-pressed={state.viewMode === "map"} onClick={() => setView("map")} type="button"><MapTrifold size={17}/>{locale === "th" ? "แผนที่" : "Map"}</button>
        <button aria-pressed={state.viewMode === "list"} onClick={() => setView("list")} type="button"><List size={17}/>{locale === "th" ? "รายการ" : "List"}</button>
      </div>
    </div>

    <div className="filter-rail" aria-label={locale === "th" ? "ตัวกรองกิจกรรม" : "Activity filters"}>
      {(Object.keys(filterMeta) as ActivityFilter[]).map((key) => { const meta = filterMeta[key]; const Icon = meta.icon; return <button aria-pressed={filter === key} key={key} onClick={() => setFilter(key)} type="button"><Icon size={16}/>{meta[locale]}</button>; })}
    </div>

    <div className={`activity-workspace ${state.viewMode === "list" ? "show-list" : "show-map"}`}>
      <div className="map-pane">
        <ActivityMap activities={visible} mapError={mapError} onError={setMapError} onSelect={setSelectedId} selectedId={selectedId} locale={locale}/>
      </div>
      <ActivityList activities={visible} joined={state.joinedActivityIds} locale={locale} onSelect={setSelectedId}/>
    </div>

    {selected ? <ActivitySheet activity={selected} joined={state.joinedActivityIds.includes(selected.id)} locale={locale} onClose={() => setSelectedId(null)} onJoin={() => dispatch({ type: "toggle-activity", activityId: selected.id })}/> : null}
  </section>;
}

function ActivityMap({ activities, mapError, onError, onSelect, selectedId, locale }: { activities: ActivityItem[]; mapError: boolean; onError: (value: boolean) => void; onSelect: (id: string) => void; selectedId: string | null; locale: Locale }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const [retryKey, setRetryKey] = useState(0);
  const [moved, setMoved] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;
    if (!cancelled && containerRef.current) {
      const map = new maplibregl.Map({ container: containerRef.current, style: "https://tiles.openfreemap.org/styles/liberty", center: BANGKOK_CENTER, zoom: 10.3, attributionControl: false });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
      markerRefs.current = activities.map((activity) => {
        const button = document.createElement("button");
        button.className = "activity-marker";
        button.style.setProperty("--marker-color", markerColors[activity.kind]);
        button.type = "button";
        button.setAttribute("aria-label", `${activity.title}, ${activity.locationLabel}`);
        button.addEventListener("click", () => onSelect(activity.id));
        return new maplibregl.Marker({ element: button }).setLngLat(activity.coordinate).addTo(map);
      });
      map.once("load", () => {
        onError(false);
        map.addSource("activity-clusters", {
          type: "geojson",
          cluster: true,
          clusterMaxZoom: 9,
          clusterRadius: 54,
          data: {
            type: "FeatureCollection",
            features: activities.map((activity) => ({
              type: "Feature",
              properties: { id: activity.id, title: activity.title },
              geometry: { type: "Point", coordinates: activity.coordinate },
            })),
          },
        });
        map.addLayer({
          id: "activity-cluster-circles",
          type: "circle",
          source: "activity-clusters",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#168cff",
            "circle-radius": ["step", ["get", "point_count"], 20, 4, 26],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        });
        map.addLayer({
          id: "activity-cluster-count",
          type: "symbol",
          source: "activity-clusters",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
          paint: { "text-color": "#ffffff" },
        });
        const syncClusterVisibility = () => {
          const clustered = map.getZoom() < 9;
          markerRefs.current.forEach((marker) => {
            marker.getElement().style.display = clustered ? "none" : "";
          });
        };
        map.on("zoom", syncClusterVisibility);
        syncClusterVisibility();
        setMapReady(true);
      });
      map.on("error", () => onError(true));
      map.on("moveend", () => setMoved(true));
      mapRef.current = map;
    }
    return () => { cancelled = true; setMapReady(false); markerRefs.current.forEach((marker) => marker.remove()); markerRefs.current = []; mapRef.current?.remove(); mapRef.current = null; };
  }, [activities, retryKey, onError, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = activities.map((activity) => {
      const button = document.createElement("button");
      button.className = `activity-marker ${selectedId === activity.id ? "is-selected" : ""}`;
      button.style.setProperty("--marker-color", markerColors[activity.kind]);
      button.type = "button";
      button.setAttribute("aria-label", `${activity.title}, ${activity.locationLabel}`);
      button.addEventListener("click", () => onSelect(activity.id));
      return new maplibregl.Marker({ element: button }).setLngLat(activity.coordinate).addTo(map);
    });
    const trip = activities.find((activity) => activity.id === selectedId && activity.route);
    const source = map.getSource("selected-route") as maplibregl.GeoJSONSource | undefined;
    const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: trip?.route ?? [] } };
    if (source) source.setData(data);
    else if (map.isStyleLoaded()) { map.addSource("selected-route", { type: "geojson", data }); map.addLayer({ id: "selected-route-line", type: "line", source: "selected-route", paint: { "line-color": "#168cff", "line-width": 5, "line-opacity": 0.88 } }); }
  }, [activities, mapReady, onSelect, selectedId]);

  function locate() {
    if (!navigator.geolocation) { setLocationStatus(locale === "th" ? "อุปกรณ์นี้ไม่รองรับตำแหน่ง" : "Location is unavailable"); return; }
    setLocationStatus(locale === "th" ? "กำลังค้นหาตำแหน่ง…" : "Locating…");
    navigator.geolocation.getCurrentPosition(({ coords }) => { mapRef.current?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 13 }); setLocationStatus(locale === "th" ? "พบตำแหน่งของคุณแล้ว" : "Location found"); }, () => { mapRef.current?.flyTo({ center: BANGKOK_CENTER, zoom: 10.3 }); setLocationStatus(locale === "th" ? "ใช้ตำแหน่งกรุงเทพฯ แทน" : "Using Bangkok instead"); });
  }

  return <div className="map-canvas-wrap">
    <div className="map-canvas" ref={containerRef}/>
    {mapError ? <div className="map-fallback" role="alert"><WarningCircle size={30}/><strong>{locale === "th" ? "โหลดแผนที่ไม่สำเร็จ" : "Map could not load"}</strong><span>{locale === "th" ? "ลองใหม่ หรือใช้มุมมองรายการ" : "Retry or continue in List view."}</span><button onClick={() => { onError(false); setRetryKey((key) => key + 1); }} type="button">{locale === "th" ? "ลองอีกครั้ง" : "Retry map"}</button></div> : null}
    <button className="map-action map-locate" onClick={locate} type="button"><Crosshair size={18}/>{locale === "th" ? "ตำแหน่งฉัน" : "Locate me"}</button>
    {moved ? <button className="map-action map-search-area" onClick={() => setMoved(false)} type="button">{locale === "th" ? "ค้นหาบริเวณนี้" : "Search this area"}</button> : null}
    {locationStatus ? <div className="map-status" role="status">{locationStatus}</div> : null}
  </div>;
}

function ActivityList({ activities, joined, locale, onSelect }: { activities: ActivityItem[]; joined: string[]; locale: Locale; onSelect: (id: string) => void }) {
  return <div className="activity-list premium-scrollbar" aria-live="polite">{activities.length ? activities.map((activity) => <button className="activity-list-card" key={activity.id} onClick={() => onSelect(activity.id)} type="button">
    <img alt="" src={activity.image}/><div><div className="flex items-center justify-between gap-2"><span className={`kind-badge kind-${activity.kind}`}>{filterMeta[activity.kind][locale]}</span>{joined.includes(activity.id) ? <span className="joined-chip">{locale === "th" ? "เข้าร่วมแล้ว" : "Joined"}</span> : null}</div><strong>{activity.title}</strong><span><MapPin size={14}/>{activity.locationLabel}</span><span><CalendarBlank size={14}/>{formatDate(activity.startsAt, locale)}</span></div>
  </button>) : <div className="empty-state"><MapTrifold size={32}/><strong>{locale === "th" ? "ไม่พบกิจกรรม" : "No activities here"}</strong></div>}</div>;
}

function ActivitySheet({ activity, joined, locale, onClose, onJoin }: { activity: ActivityItem; joined: boolean; locale: Locale; onClose: () => void; onJoin: () => void }) {
  return <div className="activity-sheet" role="dialog" aria-modal="true" aria-label={activity.title}>
    <div className="sheet-handle"/><button className="sheet-close" aria-label={locale === "th" ? "ปิด" : "Close"} onClick={onClose} type="button"><X size={18}/></button>
    <div className="activity-sheet-media"><img alt="" src={activity.image}/><span className={`kind-badge kind-${activity.kind}`}>{filterMeta[activity.kind][locale]}</span></div>
    <div className="activity-sheet-body"><p className="premium-kicker">{activity.host}</p><h2>{activity.title}</h2><p>{activity.summary}</p><div className="activity-meta"><span><MapPin size={16}/>{activity.locationLabel}</span><span><CalendarBlank size={16}/>{formatDate(activity.startsAt, locale)}</span><span><Car size={16}/>{activity.vehicleKinds.join(" · ")}</span></div><button className="primary-action" onClick={onJoin} type="button">{joined ? (locale === "th" ? "ยกเลิกการเข้าร่วม" : "Leave activity") : (locale === "th" ? "เข้าร่วมกิจกรรม" : "Join activity")}</button></div>
  </div>;
}

function formatDate(value: string, locale: Locale) { return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
