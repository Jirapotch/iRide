"use client";

import {
  Bicycle,
  Car,
  Crosshair,
  LinkSimple,
  MapPin,
  Motorcycle,
  X,
} from "@phosphor-icons/react";
import type {
  EventDto,
  CommunityCategory,
  MarkerTagInput,
  PostDto,
  VehicleKind,
} from "@iride/types";
import * as maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { TripFields } from "./trip-fields";
import { useTheme } from "@/app/_components/theme-provider";
import { mapStyle } from "@/lib/app-navigation-domain";
import type { Locale } from "@/lib/locale";
import { applyMapPalette } from "@/lib/map-palette";
import {
  parseGoogleMapsCoordinates,
  type Coordinates,
} from "@/lib/google-maps-domain";
import { synchronizeMapLocation } from "@/lib/map-location-sync";
import {
  applyMarkerMention,
  findMarkerMentionQuery,
  toggleMarkerTag,
  type MarkerMentionQuery,
} from "@/lib/marker-mention-domain";
import {
  resolveGoogleMapsLocation,
  saveContent,
} from "@/app/(main)/create/actions";
import { ActionSubmitButton } from "@/features/content/components/action-submit-button";
import { googleMapsImportErrorMessage } from "../google-maps-import-domain";
import { type MarkerOption } from "../create-marker-options-context";

type CreateType = "post" | "activity" | "trip";
export type InitialContent = PostDto | EventDto | null;
export function BackendForm({
  locale,
  type,
  initial,
  markerOptions = [],
  defaultCommunityCategory = "groups",
}: {
  readonly locale: Locale;
  readonly type: CreateType;
  readonly initial: InitialContent;
  readonly markerOptions?: readonly MarkerOption[];
  readonly defaultCommunityCategory?: CommunityCategory;
}) {
  const event = initial && "organizer" in initial ? initial : null;
  const post = initial && "body" in initial ? initial : null;
  const [coordinates, setCoordinates] = useState({
    latitude: event?.latitude ?? 13.7563,
    longitude: event?.longitude ?? 100.5018,
  });
  const isTrip = type === "trip";
  const hasLocation = type === "activity";
  return (
    <form action={saveContent} className="form-stack">
      <input name="type" type="hidden" value={type} />
      {initial ? (
        <input name="editId" type="hidden" value={initial.id} />
      ) : null}
      <input name="timezone" type="hidden" value="Asia/Bangkok" />
      {type === "post" ? (
        <PostFields
          initial={post}
          locale={locale}
          markerOptions={markerOptions}
          defaultCommunityCategory={defaultCommunityCategory}
        />
      ) : null}
      {type === "activity" ? (
        <Field label={locale === "th" ? "ประเภท" : "Kind"}>
          <select
            defaultValue={event?.kind === "event" ? "event" : "meeting"}
            name="kind"
          >
            <option value="meeting">Meeting</option>
            <option value="event">Event</option>
          </select>
        </Field>
      ) : null}
      {hasLocation ? (
        <>
          <Field label={locale === "th" ? "ชื่อ" : "Title"}>
            <input defaultValue={event?.title ?? ""} name="title" required />
          </Field>
          <Field label={locale === "th" ? "รายละเอียด" : "Description"}>
            <textarea
              defaultValue={event?.description ?? ""}
              name="description"
            />
          </Field>
          <Field label={locale === "th" ? "ชื่อสถานที่" : "Location name"}>
            <input
              defaultValue={event?.locationLabel ?? ""}
              name="locationLabel"
              required
            />
          </Field>
          <CoordinatePicker
            coordinates={coordinates}
            locale={locale}
            onChange={setCoordinates}
          />
          <input name="latitude" type="hidden" value={coordinates.latitude} />
          <input name="longitude" type="hidden" value={coordinates.longitude} />
          <Field label={locale === "th" ? "เริ่ม" : "Starts"}>
            <div className="datetime-input-shell">
              <input
                defaultValue={dateInput(event?.startsAt)}
                name="startsAt"
                required
                type="datetime-local"
              />
            </div>
          </Field>
          <Field label={locale === "th" ? "สิ้นสุด" : "Ends"}>
            <div className="datetime-input-shell">
              <input
                defaultValue={dateInput(event?.endsAt)}
                name="endsAt"
                required
                type="datetime-local"
              />
            </div>
          </Field>
        </>
      ) : null}
      {isTrip ? <TripFields event={event} locale={locale} /> : null}
      {type === "activity" || type === "trip" ? (
        <fieldset>
          <legend>
            {locale === "th" ? "Vehicle ที่รองรับ" : "Compatible vehicles"}
          </legend>
          <div className="vehicle-checks">
            {(["car", "motorcycle", "bicycle"] as VehicleKind[]).map((kind) => (
              <label key={kind}>
                <input
                  defaultChecked={event?.vehicleKinds.includes(kind) ?? true}
                  name="vehicleKinds"
                  type="checkbox"
                  value={kind}
                />
                {vehicleIcon(kind)}
                {kind}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <ActionSubmitButton
        pendingLabel={locale === "th" ? "กำลังบันทึก…" : "Saving…"}
      >
        {initial
          ? locale === "th"
            ? "บันทึกการแก้ไข"
            : "Save changes"
          : locale === "th"
            ? "เผยแพร่"
            : "Publish"}
      </ActionSubmitButton>
    </form>
  );
}

function PostFields({
  initial,
  locale,
  markerOptions,
  defaultCommunityCategory,
}: {
  readonly initial: PostDto | null;
  readonly locale: Locale;
  readonly markerOptions: readonly MarkerOption[];
  readonly defaultCommunityCategory: CommunityCategory;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(initial?.body ?? "");
  const [tags, setTags] = useState<MarkerTagInput[]>(
    () => initial?.markerTags.map(({ kind, id }) => ({ kind, id })) ?? [],
  );
  const [mention, setMention] = useState<MarkerMentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => {
    const needle = mention?.query.trim().toLocaleLowerCase() ?? "";
    return markerOptions
      .filter(
        (option) =>
          !needle ||
          `${option.title} ${option.subtitle}`
            .toLocaleLowerCase()
            .includes(needle),
      )
      .slice(0, 8);
  }, [markerOptions, mention]);
  const open = Boolean(mention && markerOptions.length);
  function syncMention(value = body) {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    setMention(findMarkerMentionQuery(value, cursor));
    setActiveIndex(0);
  }
  function choose(option: MarkerOption) {
    if (!mention) return;
    const result = applyMarkerMention(body, mention, option.title);
    setBody(result.body);
    if (
      !tags.some((tag) => tag.kind === option.kind && tag.id === option.id) &&
      tags.length < 5
    )
      setTags((current) => [...current, { kind: option.kind, id: option.id }]);
    setMention(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(result.cursor, result.cursor);
    });
  }
  function keyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((value) =>
        Math.min(value + 1, Math.max(0, filtered.length - 1)),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((value) => Math.max(0, value - 1));
    } else if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMention(null);
    }
  }
  return (
    <>
      <Field label={locale === "th" ? "เลือกชุมชน" : "Community category"}>
        <select
          defaultValue={initial?.communityCategory ?? defaultCommunityCategory}
          name="communityCategory"
          required
        >
          <option value="car">{locale === "th" ? "รถยนต์" : "Cars"}</option>
          <option value="motorcycle">
            {locale === "th" ? "มอเตอร์ไซค์" : "Motorcycles"}
          </option>
          <option value="bicycle">
            {locale === "th" ? "จักรยาน" : "Bicycles"}
          </option>
          <option value="groups">{locale === "th" ? "กลุ่ม" : "Groups"}</option>
        </select>
      </Field>
      <Field label={locale === "th" ? "ข้อความ" : "Post text"}>
        <div className="marker-mention-composer">
          <textarea
            aria-autocomplete="list"
            aria-controls="marker-mention-options"
            aria-expanded={open}
            maxLength={2000}
            name="body"
            onChange={(event) => {
              setBody(event.target.value);
              syncMention(event.target.value);
            }}
            onClick={() => syncMention()}
            onKeyDown={keyDown}
            onKeyUp={(event) => {
              if (
                !["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)
              )
                syncMention();
            }}
            placeholder={
              locale === "th"
                ? "เขียนโพสต์ และพิมพ์ @ เพื่อแนบ Marker"
                : "Write a post and type @ to attach a marker"
            }
            ref={textareaRef}
            required
            role="combobox"
            value={body}
          />
          {open ? (
            <div
              className="marker-mention-dropdown"
              id="marker-mention-options"
              role="listbox"
            >
              {filtered.length ? (
                filtered.map((option, index) => (
                  <button
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? "is-active" : undefined}
                    key={`${option.kind}:${option.id}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                    role="option"
                    type="button"
                  >
                    <MapPin size={17} />
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.subtitle}</small>
                    </span>
                  </button>
                ))
              ) : (
                <p>{locale === "th" ? "ไม่พบ Marker" : "No markers found"}</p>
              )}
            </div>
          ) : null}
        </div>
      </Field>
      {tags.map((tag) => (
        <input
          key={`${tag.kind}:${tag.id}`}
          name="markerTags"
          type="hidden"
          value={`${tag.kind}:${tag.id}`}
        />
      ))}
      {tags.length ? (
        <fieldset>
          <legend>
            {locale === "th" ? "Marker ที่แนบ" : "Attached markers"}
          </legend>
          <div className="selected-marker-tags">
            {tags.map((tag) => {
              const option = markerOptions.find(
                (item) => item.kind === tag.kind && item.id === tag.id,
              );
              return (
                <button
                  aria-label={`${locale === "th" ? "นำออก" : "Remove"} ${option?.title ?? "marker"}`}
                  key={`${tag.kind}:${tag.id}`}
                  onClick={() =>
                    setTags((current) => toggleMarkerTag(current, tag))
                  }
                  type="button"
                >
                  <MapPin size={15} />
                  {option?.title ??
                    (locale === "th"
                      ? "Marker ที่ไม่พร้อมใช้งาน"
                      : "Unavailable marker")}
                  <X size={14} />
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {tags.length >= 5 ? (
        <small className="form-hint">
          {locale === "th"
            ? "แนบ Marker ได้สูงสุด 5 รายการ"
            : "You can attach up to five markers"}
        </small>
      ) : null}
    </>
  );
}

export function CoordinatePicker({
  coordinates,
  locale,
  onChange,
  onImportName,
  selected = true,
  points = [],
}: {
  readonly onImportName?: (name: string) => void;
  readonly selected?: boolean;
  readonly points?: readonly MapPoint[];
  readonly coordinates: { latitude: number; longitude: number };
  readonly locale: Locale;
  readonly onChange: (value: { latitude: number; longitude: number }) => void;
}) {
  const [importOpen, setImportOpen] = useState(false),
    [mapsUrl, setMapsUrl] = useState(""),
    [importError, setImportError] = useState<string | null>(null),
    [preview, setPreview] = useState<Coordinates | null>(null),
    [message, setMessage] = useState<string | null>(null),
    [pending, setPending] = useState(false);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const closeImport = useCallback(() => {
    setImportOpen(false);
    setMapsUrl("");
    setImportError(null);
    setPreview(null);
    window.requestAnimationFrame(() => importButtonRef.current?.focus());
  }, []);
  function locate() {
    if (!navigator.geolocation) {
      setMessage(
        locale === "th"
          ? "อุปกรณ์นี้ไม่รองรับตำแหน่งปัจจุบัน"
          : "Location is not supported on this device",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({ latitude: coords.latitude, longitude: coords.longitude });
        setMessage(null);
      },
      () =>
        setMessage(
          locale === "th"
            ? "ไม่สามารถเข้าถึงตำแหน่งปัจจุบันได้"
            : "Could not access your current location",
        ),
    );
  }
  async function checkLocation() {
    setPending(true);
    setImportError(null);
    try {
      const direct = parseGoogleMapsCoordinates(mapsUrl);
      const result = direct
        ? ({ ok: true, location: direct } as const)
        : await resolveGoogleMapsLocation(mapsUrl);
      if (!result.ok) {
        setImportError(googleMapsImportErrorMessage(result.code, locale));
        return;
      }
      setPreview(result.location);
    } catch {
      setImportError(
        locale === "th"
          ? "นำเข้าไม่ได้ กรุณาลองอีกครั้ง หรือแชร์สถานที่ทีละจุด"
          : "Import failed. Retry or share one place at a time.",
      );
    } finally {
      setPending(false);
    }
  }
  function applyLocation() {
    if (!preview) return;
    onChange(preview);
    if (preview.name) onImportName?.(preview.name);
    setMessage(
      locale === "th"
        ? "นำเข้าตำแหน่งแล้ว คุณยังลาก Marker เพื่อปรับได้"
        : "Location imported. You can still drag the marker.",
    );
    closeImport();
  }
  return (
    <div className="coordinate-picker">
      <MiniMap
        coordinates={coordinates}
        locale={locale}
        onChange={onChange}
        selected={selected}
        points={points}
      />
      <div className="location-action-row">
        <button className="secondary-action" onClick={locate} type="button">
          <Crosshair size={17} />
          {locale === "th" ? "ใช้ตำแหน่งฉัน" : "Locate me"}
        </button>
        <button
          aria-haspopup="dialog"
          aria-expanded={importOpen}
          className="secondary-action"
          onClick={() => {
            setImportError(null);
            setImportOpen(true);
          }}
          ref={importButtonRef}
          type="button"
        >
          <LinkSimple size={17} />
          {locale === "th"
            ? "นำเข้าจาก Google Maps"
            : "Import from Google Maps"}
        </button>
      </div>
      {importOpen ? (
        <GoogleMapsImportModal
          error={importError}
          locale={locale}
          mapsUrl={mapsUrl}
          onChange={(value) => {
            setMapsUrl(value);
            setPreview(null);
            setImportError(null);
          }}
          onClose={() => {
            if (!pending) closeImport();
          }}
          onApply={applyLocation}
          onCheck={() => void checkLocation()}
          onPreviewChange={setPreview}
          pending={pending}
          preview={preview}
        />
      ) : null}
      {message ? (
        <p aria-live="polite" className="form-hint">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function GoogleMapsImportModal({
  error,
  locale,
  mapsUrl,
  onChange,
  onClose,
  onApply,
  onCheck,
  onPreviewChange,
  pending,
  preview,
}: {
  readonly error: string | null;
  readonly locale: Locale;
  readonly mapsUrl: string;
  readonly onChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onApply: () => void;
  readonly onCheck: () => void;
  readonly onPreviewChange: (value: Coordinates) => void;
  readonly pending: boolean;
  readonly preview: Coordinates | null;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, []);
  if (typeof document === "undefined") return null;
  const title =
    locale === "th" ? "นำเข้าจาก Google Maps" : "Import from Google Maps";
  return createPortal(
    <div
      className="maps-import-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby="google-maps-import-title"
        aria-modal="true"
        className="maps-import-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <h2 id="google-maps-import-title">{title}</h2>
          <button
            aria-label={locale === "th" ? "ปิด" : "Close"}
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>
        <div className="maps-import-modal-body">
          <label className="form-field">
            <span>
              {locale === "th"
                ? "วางลิงก์ Google Maps"
                : "Paste a Google Maps link"}
            </span>
            <input
              aria-describedby={error ? "google-maps-import-error" : undefined}
              aria-invalid={error ? true : undefined}
              disabled={pending}
              inputMode="url"
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && mapsUrl.trim() && !pending) {
                  event.preventDefault();
                  if (preview) onApply();
                  else onCheck();
                }
              }}
              placeholder="https://maps.app.goo.gl/…"
              ref={inputRef}
              type="url"
              value={mapsUrl}
            />
          </label>
          {error ? (
            <p
              className="field-error"
              id="google-maps-import-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {pending ? (
            <p aria-live="polite" className="form-hint" role="status">
              {locale === "th" ? "กำลังตรวจสอบลิงก์…" : "Resolving link…"}
            </p>
          ) : null}
          {preview ? (
            <div className="maps-import-preview">
              <MiniMap
                coordinates={preview}
                locale={locale}
                onChange={onPreviewChange}
              />
              <div>
                <strong>
                  {preview.name ??
                    (locale === "th" ? "ตำแหน่งที่พบ" : "Resolved location")}
                </strong>
                <span>
                  {preview.latitude.toFixed(6)}, {preview.longitude.toFixed(6)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
        <footer>
          <button
            className="secondary-action"
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            {locale === "th" ? "ยกเลิก" : "Cancel"}
          </button>
          <button
            className="primary-action"
            disabled={pending || !mapsUrl.trim()}
            onClick={preview ? onApply : onCheck}
            type="button"
          >
            {pending
              ? locale === "th"
                ? "กำลังตรวจสอบ…"
                : "Checking…"
              : preview
                ? locale === "th"
                  ? "ใช้ตำแหน่งนี้"
                  : "Use this location"
                : locale === "th"
                  ? "ตรวจสอบลิงก์"
                  : "Check link"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

type MapPoint = {
  latitude: number;
  longitude: number;
  label: string;
  name: string;
  destination: boolean;
  active: boolean;
};

function MiniMap({
  coordinates,
  locale,
  onChange,
  selected = true,
  points = [],
}: {
  readonly selected?: boolean;
  readonly points?: readonly MapPoint[];
  readonly coordinates: { latitude: number; longitude: number };
  readonly locale: Locale;
  readonly onChange: (value: { latitude: number; longitude: number }) => void;
}) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const pointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const onChangeRef = useRef(onChange);
  const coordinatesRef = useRef(coordinates);
  const themeRef = useRef(theme);
  const synchronizeLocation = useCallback(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const container = containerRef.current;
    if (!map || !marker || !container) return;

    const { latitude, longitude } = coordinatesRef.current;
    const location = `${longitude},${latitude}`;
    synchronizeMapLocation(map, marker, { latitude, longitude });
    marker.getElement().dataset.location = location;
    container.dataset.cameraCenter = location;
  }, []);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    themeRef.current = theme;
    const map = mapRef.current;
    if (map?.isStyleLoaded()) applyMapPalette(map, theme);
  }, [theme]);
  useEffect(() => {
    if (!containerRef.current) return;
    const initialCoordinates = coordinatesRef.current;
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle(process.env.NEXT_PUBLIC_MAPTILER_KEY),
        center: [initialCoordinates.longitude, initialCoordinates.latitude],
        zoom: 12,
        attributionControl: false,
      });
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-left",
      );
      const markerElement = document.createElement("div");
      markerElement.className = "coordinate-marker";
      markerElement.setAttribute("role", "img");
      markerElement.setAttribute(
        "aria-label",
        locale === "th" ? "ตำแหน่งที่เลือก" : "Selected location",
      );
      const marker = new maplibregl.Marker({
        draggable: true,
        element: markerElement,
      })
        .setLngLat([initialCoordinates.longitude, initialCoordinates.latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const point = marker.getLngLat();
        onChangeRef.current({ latitude: point.lat, longitude: point.lng });
      });
      map.on("click", (event) =>
        onChangeRef.current({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
        }),
      );
      mapRef.current = map;
      markerRef.current = marker;
      map.once("load", () => {
        applyMapPalette(map, themeRef.current);
        synchronizeLocation();
      });
      const observer = new ResizeObserver(() => map.resize());
      observer.observe(containerRef.current);
      return () => {
        observer.disconnect();
        marker.remove();
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
      };
    } catch {
      return;
    }
  }, [locale, synchronizeLocation]);
  useEffect(() => {
    coordinatesRef.current = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
    synchronizeLocation();
  }, [coordinates.latitude, coordinates.longitude, synchronizeLocation]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const marker = markerRef.current;
    if (marker) {
      const element = marker.getElement();
      const activePoint = points.find((point) => point.active);
      element.style.visibility = selected ? "visible" : "hidden";
      element.textContent = activePoint?.label ?? "";
      element.className =
        "coordinate-marker" +
        (activePoint ? " trip-point-marker" : "") +
        (activePoint?.destination ? " is-destination" : "");
    }
    pointMarkersRef.current.forEach((point) => point.remove());
    pointMarkersRef.current = points
      .filter((point) => !point.active)
      .map((point) => {
        const element = document.createElement("div");
        element.className =
          "trip-point-marker" + (point.destination ? " is-destination" : "");
        element.textContent = point.label;
        element.title = point.name;
        return new maplibregl.Marker({ element })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map);
      });
    return () => {
      pointMarkersRef.current.forEach((point) => point.remove());
      pointMarkersRef.current = [];
    };
  }, [points, selected]);
  return (
    <div
      className="mini-map-preview on-map"
      aria-label={
        locale === "th"
          ? "เลือกตำแหน่งบนแผนที่"
          : "Choose a location on the map"
      }
      ref={containerRef}
    />
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function vehicleIcon(kind: VehicleKind) {
  if (kind === "car") return <Car size={17} />;
  if (kind === "motorcycle") return <Motorcycle size={17} />;
  if (kind === "bicycle") return <Bicycle size={17} />;
  return <MapPin size={17} />;
}
function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
