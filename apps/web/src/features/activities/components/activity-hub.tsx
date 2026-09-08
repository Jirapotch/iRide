"use client";

import {
  CalendarBlank,
  Crosshair,
  Funnel,
  Path,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  EventDto,
  ExploreFeatureDto,
  ExploreFeatureKind,
} from "@iride/types";
import { gsap } from "gsap";
import * as maplibregl from "maplibre-gl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useTheme } from "@/app/_components/theme-provider";
import {
  isActivityMapOriginActive,
  mapStateHref,
  mapStyle,
  parseMapKinds,
} from "@/lib/app-navigation-domain";
import { getExploreContent } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";
import { applyMapPalette, contentKindColors } from "@/lib/map-palette";
import { mapSelectionCamera } from "@/lib/map-motion";
import { motionTokens } from "@/shared/theme/tokens";
import { BackendForm } from "@/features/content/components/content-editor-form";
import { EditModal } from "@/features/content/components/edit-modal";
import { getActivityKindLabel } from "../activity-kind-label";
import { ActivityFeatureSheet } from "./activity-feature-sheet";

const center: [number, number] = [100.5018, 13.7563];
const kinds: ExploreFeatureKind[] = ["meeting", "event", "trip"];
const markerColors = contentKindColors;

function focusMarkerWhenSheetCloses(
  markerId: string,
  fallback: HTMLButtonElement | null,
) {
  const focus = () => {
    if (document.querySelector("[data-feature-sheet]")) return false;
    const marker = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".activity-marker"),
    ).find((button) => button.dataset.featureId === markerId);
    (marker ?? fallback)?.focus();
    return document.activeElement === (marker ?? fallback);
  };

  window.setTimeout(() => {
    if (focus()) return;
    const observer = new MutationObserver(() => {
      if (focus()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, 0);
}

export function ActivityHub({
  locale,
  initialFeature = null,
  initialEdit = null,
  initialTrip = null,
  editDenied = false,
  selectedFeatureUnavailable = false,
  breadcrumbs = null,
  activityBreadcrumbMarkerId = null,
}: {
  readonly locale: Locale;
  readonly initialFeature?: ExploreFeatureDto | null;
  readonly initialEdit?: EventDto | null;
  readonly initialTrip?: EventDto | null;
  readonly editDenied?: boolean;
  readonly selectedFeatureUnavailable?: boolean;
  readonly breadcrumbs?: ReactNode;
  readonly activityBreadcrumbMarkerId?: string | null;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useSearchParams();
  const [features, setFeatures] = useState<ExploreFeatureDto[]>(
    initialFeature ? [initialFeature] : [],
  );
  const [enabled, setEnabled] = useState<ExploreFeatureKind[]>(() =>
    parseMapKinds(params.get("layers")),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    params.get("marker"),
  );
  const [activityOriginActive, setActivityOriginActive] = useState(() =>
    isActivityMapOriginActive(
      params.get("from"),
      activityBreadcrumbMarkerId,
      params.get("marker"),
    ),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tripDetails, setTripDetails] = useState<{
    id: string;
    event: EventDto | null;
    failed: boolean;
  } | null>(null);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [cameraDuration, setCameraDuration] = useState<number | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const themeRef = useRef(theme);
  const markerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusMarkerIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  const pushedMarkerRef = useRef(false);
  const initialFeatureRef = useRef(initialFeature);
  const [lastInitialFeature, setLastInitialFeature] = useState(initialFeature);
  if (initialFeature !== lastInitialFeature) {
    setLastInitialFeature(initialFeature);
    if (initialFeature) {
      setFeatures((current) => [
        initialFeature,
        ...current.filter((item) => item.id !== initialFeature.id),
      ]);
      setSelectedId(initialFeature.id);
    }
  }
  useEffect(() => {
    initialFeatureRef.current = initialFeature;
  }, [initialFeature]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    const restore = () => {
      const query = new URL(window.location.href).searchParams;
      const restoredKinds = parseMapKinds(query.get("layers"));
      enabledRef.current = restoredKinds;
      selectedIdRef.current = query.get("marker");
      setActivityOriginActive(
        isActivityMapOriginActive(
          query.get("from"),
          activityBreadcrumbMarkerId,
          selectedIdRef.current,
        ),
      );
      pushedMarkerRef.current = false;
      setEnabled(restoredKinds);
      setSelectedId(selectedIdRef.current);
      const markerId = returnFocusMarkerIdRef.current;
      if (markerId) {
        returnFocusMarkerIdRef.current = null;
        focusMarkerWhenSheetCloses(markerId, markerTriggerRef.current);
      }
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [activityBreadcrumbMarkerId]);
  useEffect(() => {
    themeRef.current = theme;
    const map = mapRef.current;
    if (map?.isStyleLoaded()) applyMapPalette(map, theme);
  }, [theme]);

  const loadViewport = useCallback(async (map: maplibregl.Map) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const bounds = map.getBounds();
    setLoading(true);
    try {
      const active = enabledRef.current;
      const layers = Array.from(
        new Set(active.map((kind) => (kind === "trip" ? "trips" : "events"))),
      );
      const data = await getExploreContent(
        [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ],
        layers,
        controller.signal,
      );
      if (controller.signal.aborted || requestRef.current !== controller)
        return;
      setFeatures((current) => {
        const retained =
          current.find((item) => item.id === selectedIdRef.current) ??
          initialFeatureRef.current;
        return retained && !data.some((item) => item.id === retained.id)
          ? [retained, ...data]
          : data;
      });
      setError(false);
    } catch (caught) {
      if (
        !controller.signal.aborted &&
        requestRef.current === controller &&
        !(caught instanceof DOMException && caught.name === "AbortError")
      )
        setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const initialFeature = initialFeatureRef.current;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle(process.env.NEXT_PUBLIC_MAPTILER_KEY),
        center: initialFeature
          ? [initialFeature.longitude, initialFeature.latitude]
          : center,
        zoom: initialFeature ? 13 : 10,
        attributionControl: false,
      });
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          visualizePitch: true,
        }),
        "top-right",
      );
      map.addControl(new maplibregl.FullscreenControl(), "top-right");
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-left",
      );
      mapRef.current = map;
      const resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
      map.once("load", () => {
        applyMapPalette(map, themeRef.current);
        void loadViewport(map);
      });
      map.on("moveend", () => {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => void loadViewport(map), 300);
      });
      return () => {
        resizeObserver.disconnect();
        requestRef.current?.abort();
        if (timerRef.current) window.clearTimeout(timerRef.current);
        markerRefs.current.forEach((marker) => marker.remove());
        userLocationMarkerRef.current?.remove();
        userLocationMarkerRef.current = null;
        map.remove();
        mapRef.current = null;
      };
    } catch {
      window.setTimeout(() => {
        setError(true);
        setLoading(false);
      }, 0);
    }
  }, [loadViewport]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.loaded()) void loadViewport(map);
  }, [enabled, loadViewport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const focusedMarkerId =
      document.activeElement instanceof HTMLButtonElement &&
      document.activeElement.matches(".activity-marker")
        ? document.activeElement.dataset.featureId
        : null;
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = features
      .filter((feature) => enabled.includes(feature.kind))
      .map((feature) => {
        const anchor = document.createElement("div");
        anchor.className = "activity-marker-anchor";
        const button = document.createElement("button");
        button.type = "button";
        button.className = `activity-marker marker-${feature.kind} ${feature.id === selectedIdRef.current ? "is-selected" : ""}`;
        button.style.setProperty("--marker-color", markerColors[feature.kind]);
        button.setAttribute("aria-label", feature.title);
        button.textContent =
          feature.kind === "meeting"
            ? "M"
            : feature.kind === "event"
              ? "E"
              : feature.kind === "trip"
                ? "T"
                : "C";
        button.dataset.featureId = feature.id;
        button.addEventListener("click", () => {
          if (selectedIdRef.current === feature.id) return;
          setActivityOriginActive(false);
          markerTriggerRef.current = button;
          selectedIdRef.current = feature.id;
          window.history.pushState(
            null,
            "",
            mapStateHref({
              kinds: enabledRef.current,
              marker: feature.id,
            }),
          );
          pushedMarkerRef.current = true;
          setSelectedId(feature.id);
        });
        anchor.append(button);
        return new maplibregl.Marker({ element: anchor, anchor: "bottom" })
          .setLngLat([feature.longitude, feature.latitude])
          .addTo(map);
      });
    if (focusedMarkerId) {
      rootRef.current
        ?.querySelector<HTMLButtonElement>(
          `.activity-marker[data-feature-id="${CSS.escape(focusedMarkerId)}"]`,
        )
        ?.focus();
    }
  }, [enabled, features]);

  useEffect(() => {
    rootRef.current
      ?.querySelectorAll<HTMLButtonElement>(".activity-marker")
      .forEach((button) => {
        button.classList.toggle(
          "is-selected",
          button.dataset.featureId === selectedId,
        );
      });
  }, [selectedId]);

  const selected = useMemo(
    () => features.find((feature) => feature.id === selectedId) ?? null,
    [features, selectedId],
  );
  const tripId = selected?.kind === "trip" ? selected.id : null;
  useEffect(() => {
    if (!tripId || initialTrip?.id === tripId) return;
    const controller = new AbortController();
    void fetch("/api/bff/events/" + encodeURIComponent(tripId), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("trip_unavailable");
        return response.json() as Promise<{ data: EventDto }>;
      })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setTripDetails({ id: tripId, event: data, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setTripDetails({ id: tripId, event: null, failed: true });
      });
    return () => controller.abort();
  }, [tripId, detailAttempt, initialTrip]);
  const detail = useMemo(
    () =>
      initialTrip?.id === tripId
        ? { id: tripId, event: initialTrip, failed: false }
        : tripDetails?.id === tripId
          ? tripDetails
          : null,
    [initialTrip, tripDetails, tripId],
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !detail?.event) return;
    const event = detail.event;
    const points = [
      ...(event.latitude != null && event.longitude != null
        ? [
            {
              name: event.locationLabel ?? "",
              latitude: event.latitude,
              longitude: event.longitude,
            },
          ]
        : []),
      ...(event.stops ?? []),
    ];
    const markers = points.map((point, index) => {
      const element = document.createElement("div");
      element.className = "trip-point-marker";
      element.textContent = String(index + 1);
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", point.name);
      return new maplibregl.Marker({ element })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [detail]);
  const visibleFeatureCount = useMemo(
    () => features.filter((feature) => enabled.includes(feature.kind)).length,
    [enabled, features],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;

    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(
          ".map-canvas",
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: motionTokens.slow },
        )
        .fromTo(
          ".map-actions-stack",
          { autoAlpha: 0, y: motionTokens.offsetMedium },
          { autoAlpha: 1, y: 0, duration: motionTokens.base },
          "-=0.2",
        )
        .fromTo(
          ".map-result-status",
          { autoAlpha: 0, y: -motionTokens.offsetSmall },
          { autoAlpha: 1, y: 0, duration: motionTokens.base },
          "-=0.12",
        );
    }, root);

    return () => context.revert();
  }, []);

  const cameraId = selected?.id;
  const cameraLatitude = selected?.latitude;
  const cameraLongitude = selected?.longitude;
  const cameraTarget = useMemo(
    () =>
      cameraId && cameraLatitude != null && cameraLongitude != null
        ? { id: cameraId, latitude: cameraLatitude, longitude: cameraLongitude }
        : null,
    [cameraId, cameraLatitude, cameraLongitude],
  );
  const cameraItinerary = detail?.event ?? null;
  useEffect(() => {
    const map = mapRef.current;
    const selected = cameraTarget;
    if (!map || !selected) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const camera = mapSelectionCamera(
      selected,
      { width: window.innerWidth, height: window.innerHeight },
      reducedMotion,
    );
    setCameraDuration(camera.duration);
    const points = [
      ...(cameraItinerary?.latitude != null && cameraItinerary.longitude != null
        ? [
            {
              latitude: cameraItinerary.latitude,
              longitude: cameraItinerary.longitude,
            },
          ]
        : []),
      ...(cameraItinerary?.stops ?? []),
    ];
    if (points.length) {
      const end: [number, number] = [selected.longitude, selected.latitude];
      const bounds = new maplibregl.LngLatBounds(end, end);
      points.forEach((point) =>
        bounds.extend([point.longitude, point.latitude]),
      );
      map.fitBounds(bounds, {
        padding: camera.padding,
        duration: camera.duration,
        maxZoom: 13,
      });
    } else {
      map.easeTo(camera);
    }

    let context: gsap.Context | undefined;
    const frame = window.requestAnimationFrame(() => {
      const marker = Array.from(
        document.querySelectorAll<HTMLButtonElement>(".activity-marker"),
      ).find((button) => button.dataset.featureId === selected.id);
      const sheet = Array.from(
        document.querySelectorAll<HTMLElement>("[data-feature-sheet]"),
      ).find((element) => element.dataset.featureSheet === selected.id);
      if (!marker || !sheet) return;

      context = gsap.context(() => {
        if (reducedMotion) {
          gsap.set(marker, { scale: 1.08 });
          gsap.set(sheet, { opacity: 1 });
          return;
        }

        const desktop = window.innerWidth >= 1024;
        gsap
          .timeline({ defaults: { overwrite: "auto" } })
          .to(marker, {
            scale: 1.08,
            duration: motionTokens.fast,
            ease: "power2.out",
          })
          .fromTo(
            sheet,
            {
              opacity: 0,
              x: desktop ? motionTokens.offsetLarge : 0,
            },
            {
              opacity: 1,
              x: 0,
              duration: 0.36,
              ease: "power3.out",
            },
            "-=0.08",
          )
          .fromTo(
            sheet.querySelectorAll(".activity-sheet-body > *"),
            { opacity: 0, y: motionTokens.offsetSmall },
            {
              opacity: 1,
              y: 0,
              duration: motionTokens.base,
              stagger: 0.05,
              ease: "power2.out",
            },
            "-=0.2",
          );
      }, sheet);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      context?.revert();
    };
  }, [cameraTarget, cameraItinerary]);
  const closeFeatureSheet = useCallback(() => {
    const markerId = selectedId;
    returnFocusMarkerIdRef.current = markerId;
    if (pushedMarkerRef.current) {
      pushedMarkerRef.current = false;
      window.history.back();
    } else {
      setActivityOriginActive(false);
      setSelectedId(null);
      selectedIdRef.current = null;
      window.history.replaceState(
        null,
        "",
        mapStateHref({ kinds: enabledRef.current }),
      );
      if (markerId) {
        returnFocusMarkerIdRef.current = null;
        focusMarkerWhenSheetCloses(markerId, markerTriggerRef.current);
      }
    }
  }, [selectedId]);
  function toggle(kind: ExploreFeatureKind) {
    setEnabled((current) => {
      const next = current.includes(kind)
        ? current.filter((value) => value !== kind)
        : [...current, kind];
      enabledRef.current = next;
      window.history.replaceState(
        null,
        "",
        mapStateHref({
          kinds: next,
          marker: selectedIdRef.current,
          from: isActivityMapOriginActive(
            activityOriginActive ? "activities" : null,
            activityBreadcrumbMarkerId,
            selectedIdRef.current,
          )
            ? "activities"
            : null,
        }),
      );
      return next;
    });
  }
  function locate() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) {
      setLocationError(
        locale === "th"
          ? "อุปกรณ์นี้ไม่รองรับตำแหน่งปัจจุบัน"
          : "Location is not supported on this device",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!userLocationMarkerRef.current) {
          const element = document.createElement("div");
          element.className = "user-location-marker";
          element.setAttribute("role", "img");
          element.setAttribute(
            "aria-label",
            locale === "th" ? "ตำแหน่งปัจจุบันของฉัน" : "My current location",
          );
          userLocationMarkerRef.current = new maplibregl.Marker({ element })
            .setLngLat([coords.longitude, coords.latitude])
            .addTo(map);
        } else
          userLocationMarkerRef.current.setLngLat([
            coords.longitude,
            coords.latitude,
          ]);
        map.flyTo({ center: [coords.longitude, coords.latitude], zoom: 13 });
        setLocationError(null);
      },
      () =>
        setLocationError(
          locale === "th"
            ? "ไม่สามารถเข้าถึงตำแหน่งของคุณได้ กรุณาตรวจสิทธิ์ Location"
            : "Could not access your location. Check location permission.",
        ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <section
      className="discover-map on-map"
      aria-label={locale === "th" ? "แผนที่ค้นพบ" : "Discover map"}
      data-camera-duration={cameraDuration ?? undefined}
      ref={rootRef}
    >
      <h1 className="sr-only" data-route-heading tabIndex={-1}>
        {locale === "th" ? "แผนที่" : "Maps"}
      </h1>
      {breadcrumbs && activityOriginActive ? (
        <div className="map-breadcrumbs">{breadcrumbs}</div>
      ) : null}
      <div className="map-canvas" ref={containerRef} />
      <div
        aria-label={locale === "th" ? "ผลลัพธ์บนแผนที่" : "Map results"}
        className="map-result-status"
        role="status"
      >
        {loading
          ? locale === "th"
            ? "กำลังอัปเดตพื้นที่"
            : "Updating area"
          : locale === "th"
            ? `${visibleFeatureCount} สถานที่`
            : `${visibleFeatureCount} ${visibleFeatureCount === 1 ? "place" : "places"}`}
      </div>
      {error ? (
        <div className="map-error-banner" role="alert">
          <WarningCircle size={18} />
          <span>
            {locale === "th"
              ? "โหลดข้อมูล marker ไม่สำเร็จ แผนที่ยังใช้งานได้"
              : "Markers could not load. The map is still available."}
          </span>
          <button
            disabled={loading}
            onClick={() => {
              const map = mapRef.current;
              if (map) void loadViewport(map);
            }}
            type="button"
          >
            {locale === "th" ? "ลองโหลด marker อีกครั้ง" : "Retry markers"}
          </button>
        </div>
      ) : null}
      {selectedFeatureUnavailable ? (
        <div className="map-error-banner map-selected-error" role="alert">
          <WarningCircle size={18} />
          <span>
            {locale === "th"
              ? "โหลดสถานที่ที่เลือกไม่สำเร็จ แผนที่ยังใช้งานได้"
              : "The selected place could not load. The map is still available."}
          </span>
          <button onClick={() => router.refresh()} type="button">
            {locale === "th" ? "ลองอีกครั้ง" : "Retry"}
          </button>
        </div>
      ) : null}
      <div className="map-actions-stack">
        <button
          aria-expanded={filtersOpen}
          aria-label={locale === "th" ? "กรอง marker" : "Filter markers"}
          aria-pressed={filtersOpen}
          className="map-filter-fab"
          onClick={() => setFiltersOpen((value) => !value)}
          type="button"
        >
          <Funnel size={22} />
        </button>
        <button
          aria-label={locale === "th" ? "ตำแหน่งฉัน" : "Locate me"}
          className="map-locate-fab"
          onClick={locate}
          type="button"
        >
          <Crosshair size={20} />
        </button>
      </div>
      {filtersOpen ? (
        <div className="map-filter-menu">
          {kinds.map((kind) => {
            const Icon =
              kind === "meeting"
                ? UsersThree
                : kind === "event"
                  ? CalendarBlank
                  : Path;
            return (
              <label
                key={kind}
                style={
                  { "--marker-color": contentKindColors[kind] } as CSSProperties
                }
              >
                <input
                  checked={enabled.includes(kind)}
                  onChange={() => toggle(kind)}
                  type="checkbox"
                />
                <Icon size={17} />
                {getActivityKindLabel(kind, locale)}
              </label>
            );
          })}
        </div>
      ) : null}
      {locationError ? (
        <div className="map-location-error" role="alert">
          {locationError}
        </div>
      ) : null}
      {selected && !initialEdit ? (
        <ActivityFeatureSheet
          feature={selected}
          trip={detail?.event ?? null}
          tripFailed={detail?.failed ?? false}
          onRetryTrip={() => setDetailAttempt((value) => value + 1)}
          locale={locale}
          onClose={closeFeatureSheet}
        />
      ) : null}
      {initialEdit ? (
        <EditModal
          closeUrl={mapStateHref({ kinds: enabled, marker: initialEdit.id })}
          title={locale === "th" ? "แก้ไขข้อมูล" : "Edit details"}
        >
          <BackendForm
            initial={initialEdit}
            locale={locale}
            type={initialEdit.kind === "trip" ? "trip" : "activity"}
          />
        </EditModal>
      ) : null}
      {editDenied ? (
        <div className="permission-toast" role="alert">
          {locale === "th"
            ? "คุณไม่มีสิทธิ์แก้ไข marker นี้"
            : "You do not have permission to edit this marker."}
        </div>
      ) : null}
    </section>
  );
}
