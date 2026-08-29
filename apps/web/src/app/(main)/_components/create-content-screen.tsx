"use client";

import { Bicycle, Car, Crosshair, Motorcycle, Storefront } from "@phosphor-icons/react";
import type { EventDto, PhotographerSpotDto, PostDto, VehicleKind } from "@iride/types";
import * as maplibregl from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useTheme } from "@/app/_components/theme-provider";
import { mapStyle } from "@/lib/app-navigation-domain";
import type { Locale } from "@/lib/locale";
import { applyMapPalette } from "@/lib/map-palette";
import type { MarketProduct } from "@/lib/mock-content";

import { saveContent } from "../create/actions";
import { useMockApp } from "./mock-app-provider";

type CreateType = "post" | "activity" | "trip" | "photographer-spot" | "market";
type InitialContent = PostDto | EventDto | PhotographerSpotDto | null;

export function CreateContentScreen({ locale, type, initial }: { readonly locale: Locale; readonly type: CreateType; readonly initial: InitialContent }) {
  const options: { type: CreateType; label: string }[] = [
    { type: "post", label: locale === "th" ? "โพสต์" : "Post" },
    { type: "activity", label: locale === "th" ? "กิจกรรม" : "Activity" },
    { type: "trip", label: locale === "th" ? "ทริป" : "Trip" },
    { type: "photographer-spot", label: locale === "th" ? "Landmark ช่างภาพ" : "Photographer spot" },
    { type: "market", label: locale === "th" ? "สินค้า Market" : "Market item" },
  ];
  return <main className="create-page"><header className="create-intro"><p className="premium-kicker">iRide Create</p><h1>{locale === "th" ? "สร้างสิ่งใหม่" : "Create something new"}</h1></header><nav className="create-type-tabs">{options.map((option) => <a aria-current={option.type === type ? "page" : undefined} href={`/create?type=${option.type}`} key={option.type}>{option.label}</a>)}</nav><section className="create-card premium-card">{type === "market" ? <MarketForm locale={locale}/> : <BackendForm initial={initial} locale={locale} type={type}/>}</section></main>;
}

function BackendForm({ locale, type, initial }: { readonly locale: Locale; readonly type: Exclude<CreateType, "market">; readonly initial: InitialContent }) {
  const event = initial && "organizer" in initial ? initial : null;
  const spot = initial && "photographer" in initial ? initial : null;
  const post = initial && "body" in initial ? initial : null;
  const [coordinates, setCoordinates] = useState({ latitude: event?.latitude ?? spot?.latitude ?? 13.7563, longitude: event?.longitude ?? spot?.longitude ?? 100.5018 });
  const isTrip = type === "trip";
  const hasLocation = type !== "post";
  return <form action={saveContent} className="form-stack">
    <input name="type" type="hidden" value={type}/>{initial ? <input name="editId" type="hidden" value={initial.id}/> : null}<input name="timezone" type="hidden" value="Asia/Bangkok"/>
    {type === "post" ? <Field label={locale === "th" ? "ข้อความ" : "Post text"}><textarea defaultValue={post?.body ?? ""} maxLength={5000} name="body" required/></Field> : null}
    {type === "activity" ? <Field label={locale === "th" ? "ประเภท" : "Kind"}><select defaultValue={event?.kind === "event" ? "event" : "meeting"} name="kind"><option value="meeting">Meeting</option><option value="event">Event</option></select></Field> : null}
    {hasLocation ? <><Field label={locale === "th" ? "ชื่อ" : "Title"}><input defaultValue={event?.title ?? spot?.title ?? ""} name="title" required/></Field><Field label={locale === "th" ? "รายละเอียด" : "Description"}><textarea defaultValue={event?.description ?? spot?.description ?? ""} name="description"/></Field><Field label={locale === "th" ? "ชื่อสถานที่" : "Location name"}><input defaultValue={event?.locationLabel ?? spot?.locationLabel ?? ""} name="locationLabel" required/></Field><CoordinatePicker coordinates={coordinates} locale={locale} onChange={setCoordinates}/><input name="latitude" type="hidden" value={coordinates.latitude}/><input name="longitude" type="hidden" value={coordinates.longitude}/><Field label={locale === "th" ? "เริ่ม" : "Starts"}><input defaultValue={dateInput(event?.startsAt ?? spot?.startsAt)} name="startsAt" required type="datetime-local"/></Field><Field label={locale === "th" ? "สิ้นสุด" : "Ends"}><input defaultValue={dateInput(event?.endsAt ?? spot?.endsAt)} name="endsAt" required={type === "photographer-spot"} type="datetime-local"/></Field></> : null}
    {isTrip ? <><Field label={locale === "th" ? "จุดหมาย" : "Destination"}><input defaultValue={event?.destinationLabel ?? ""} name="destinationLabel" required/></Field><div className="coordinate-grid"><Field label="Destination latitude"><input defaultValue={event?.destinationLatitude ?? 14.439} name="destinationLatitude" required type="number" step="any"/></Field><Field label="Destination longitude"><input defaultValue={event?.destinationLongitude ?? 101.372} name="destinationLongitude" required type="number" step="any"/></Field></div></> : null}
    {type === "activity" || type === "trip" ? <fieldset><legend>{locale === "th" ? "Vehicle ที่รองรับ" : "Compatible vehicles"}</legend><div className="vehicle-checks">{(["car", "motorcycle", "bicycle"] as VehicleKind[]).map((kind) => <label key={kind}><input defaultChecked={event?.vehicleKinds.includes(kind) ?? true} name="vehicleKinds" type="checkbox" value={kind}/>{vehicleIcon(kind)}{kind}</label>)}</div></fieldset> : null}
    <button className="primary-action" type="submit">{initial ? (locale === "th" ? "บันทึกการแก้ไข" : "Save changes") : (locale === "th" ? "เผยแพร่" : "Publish")}</button>
  </form>;
}

function CoordinatePicker({ coordinates, locale, onChange }: { readonly coordinates: { latitude: number; longitude: number }; readonly locale: Locale; readonly onChange: (value: { latitude: number; longitude: number }) => void }) {
  function locate() { navigator.geolocation?.getCurrentPosition(({ coords }) => onChange({ latitude: coords.latitude, longitude: coords.longitude })); }
  return <div className="coordinate-picker"><div className="coordinate-grid"><Field label="Latitude"><input onChange={(event) => onChange({ ...coordinates, latitude: Number(event.target.value) })} step="any" type="number" value={coordinates.latitude}/></Field><Field label="Longitude"><input onChange={(event) => onChange({ ...coordinates, longitude: Number(event.target.value) })} step="any" type="number" value={coordinates.longitude}/></Field></div><MiniMap coordinates={coordinates} locale={locale} onChange={onChange}/><button className="secondary-action" onClick={locate} type="button"><Crosshair size={17}/>{locale === "th" ? "ใช้ตำแหน่งฉัน" : "Locate me"}</button></div>;
}

function MiniMap({ coordinates, locale, onChange }: { readonly coordinates: { latitude: number; longitude: number }; readonly locale: Locale; readonly onChange: (value: { latitude: number; longitude: number }) => void }) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null); const mapRef = useRef<maplibregl.Map | null>(null); const markerRef = useRef<maplibregl.Marker | null>(null); const onChangeRef = useRef(onChange);
  const initialCoordinatesRef = useRef(coordinates);
  const themeRef = useRef(theme);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { themeRef.current = theme; const map = mapRef.current; if (map?.isStyleLoaded()) applyMapPalette(map, theme); }, [theme]);
  useEffect(() => { if (!containerRef.current) return; const initialCoordinates = initialCoordinatesRef.current; try { const map = new maplibregl.Map({ container: containerRef.current, style: mapStyle(process.env.NEXT_PUBLIC_MAPTILER_KEY), center: [initialCoordinates.longitude, initialCoordinates.latitude], zoom: 12, attributionControl: false }); const markerElement = document.createElement("div"); markerElement.className = "coordinate-marker"; markerElement.setAttribute("role", "img"); markerElement.setAttribute("aria-label", locale === "th" ? "ตำแหน่งที่เลือก" : "Selected location"); const marker = new maplibregl.Marker({ draggable: true, element: markerElement }).setLngLat([initialCoordinates.longitude, initialCoordinates.latitude]).addTo(map); marker.on("dragend", () => { const point = marker.getLngLat(); onChangeRef.current({ latitude: point.lat, longitude: point.lng }); }); map.on("click", (event) => onChangeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })); map.once("load", () => applyMapPalette(map, themeRef.current)); const observer = new ResizeObserver(() => map.resize()); observer.observe(containerRef.current); mapRef.current = map; markerRef.current = marker; return () => { observer.disconnect(); marker.remove(); map.remove(); mapRef.current = null; markerRef.current = null; }; } catch { return; } }, [locale]);
  useEffect(() => { markerRef.current?.setLngLat([coordinates.longitude, coordinates.latitude]); }, [coordinates]);
  return <div className="mini-map-preview on-map" aria-label={locale === "th" ? "เลือกตำแหน่งบนแผนที่" : "Choose a location on the map"} ref={containerRef}/>;
}

function MarketForm({ locale }: { readonly locale: Locale }) {
  const router = useRouter(); const { dispatch } = useMockApp();
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const id = `market-${Date.now()}`; const product: MarketProduct = { id, name: String(data.get("name")), price: String(data.get("price")), category: String(data.get("category")), image: "/media/market-gear.webp", vehicleKinds: data.getAll("vehicleKinds") as VehicleKind[] }; dispatch({ type: "create-product", product }); router.push(`/community?room=market&product=${id}`); }
  return <form className="form-stack" onSubmit={submit}><Field label={locale === "th" ? "ชื่อสินค้า" : "Product name"}><input name="name" required/></Field><Field label={locale === "th" ? "ราคา" : "Price"}><input name="price" placeholder="฿2,500" required/></Field><Field label={locale === "th" ? "หมวดหมู่" : "Category"}><input name="category" required/></Field><fieldset><legend>Vehicle compatibility</legend><div className="vehicle-checks">{(["car", "motorcycle", "bicycle"] as VehicleKind[]).map((kind) => <label key={kind}><input name="vehicleKinds" type="checkbox" value={kind}/>{vehicleIcon(kind)}{kind}</label>)}</div></fieldset><button className="primary-action" type="submit">{locale === "th" ? "ลงขายสินค้า" : "Publish item"}</button></form>;
}

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) { return <label className="form-field"><span>{label}</span>{children}</label>; }
function vehicleIcon(kind: VehicleKind) { if (kind === "car") return <Car size={17}/>; if (kind === "motorcycle") return <Motorcycle size={17}/>; if (kind === "bicycle") return <Bicycle size={17}/>; return <Storefront size={17}/>; }
function dateInput(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
