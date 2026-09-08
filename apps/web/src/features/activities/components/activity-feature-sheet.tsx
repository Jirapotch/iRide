"use client";

import { ArrowSquareOut, Trash, X } from "@phosphor-icons/react";
import type { EventDto, ExploreFeatureDto } from "@iride/types";
import { createPortal } from "react-dom";
import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { removeContent } from "@/app/(main)/create/actions";
import { ActionSubmitButton } from "@/features/content/components/action-submit-button";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { googleMapsSearchUrl } from "@/lib/google-maps-domain";
import type { Locale } from "@/lib/locale";
import { contentKindColors } from "@/lib/map-palette";

import { getActivityKindLabel } from "../activity-kind-label";
import type { ActivityRoutePoint } from "../activity-presentation-domain";
import { RouteStops } from "./route-stops";

const subscribeToHydration = () => () => {};

export function ActivityFeatureSheet({
  feature,
  locale,
  onClose,
  trip = null,
  tripFailed = false,
  onRetryTrip,
  onSelectRoutePoint,
  selectedRoutePointIndex = null,
}: {
  readonly trip?: EventDto | null;
  readonly tripFailed?: boolean;
  readonly onRetryTrip?: () => void;
  readonly onSelectRoutePoint?: (
    point: ActivityRoutePoint,
    index: number,
  ) => void;
  readonly selectedRoutePointIndex?: number | null;
  readonly feature: ExploreFeatureDto;
  readonly locale: Locale;
  readonly onClose: () => void;
}) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const domain = "events";
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const focusableElements = () =>
      Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (desktop || event.key !== "Tab") return;
      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === first || !sheetRef.current?.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !sheetRef.current?.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    if (!desktop) document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [desktop, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      className="activity-sheet-backdrop on-map"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        aria-label={feature.title}
        aria-modal={desktop ? undefined : "true"}
        className="activity-sheet"
        data-feature-sheet={feature.id}
        data-route-focus={selectedRoutePointIndex ?? undefined}
        ref={sheetRef}
        role="dialog"
      >
        <header className="activity-sheet-header">
          <div>
            <span
              className="kind-badge"
              style={
                {
                  "--marker-color": contentKindColors[feature.kind],
                } as CSSProperties
              }
            >
              {getActivityKindLabel(feature.kind, locale)}
            </span>
            <h2>{feature.title}</h2>
          </div>
          <PendingLink
            className="sheet-detail-link"
            href={`/activities/${encodeURIComponent(feature.id)}`}
          >
            {locale === "th" ? "รายละเอียด" : "Details"}
          </PendingLink>
          <button
            aria-label="Close"
            className="sheet-close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="activity-sheet-body">
          <p>{feature.subtitle}</p>
          <p>
            <PendingLink href={`/users/${feature.author.username}`}>
              {feature.author.displayName}
            </PendingLink>{" "}
            ·{" "}
            {feature.startsAt ? (
              <time dateTime={feature.startsAt}>
                {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(feature.startsAt))}
              </time>
            ) : (
              <span>
                {locale === "th" ? "ยังไม่กำหนดวันเวลา" : "Date not set"}
              </span>
            )}
          </p>
          {feature.kind === "trip" ? (
            <div className="trip-sheet-itinerary">
              <h3>
                {locale === "th" ? "จุดหมายและที่แวะ" : "Destination and stops"}
              </h3>
              {trip ? (
                <RouteStops
                  event={trip}
                  locale={locale}
                  selectedIndex={selectedRoutePointIndex}
                  {...(onSelectRoutePoint
                    ? { onSelectPoint: onSelectRoutePoint }
                    : {})}
                />
              ) : tripFailed ? (
                <button type="button" onClick={onRetryTrip}>
                  {locale === "th"
                    ? "โหลดจุดแวะไม่ได้ · ลองอีกครั้ง"
                    : "Stops unavailable · Retry"}
                </button>
              ) : (
                <p role="status">
                  {locale === "th" ? "กำลังโหลดจุดแวะ…" : "Loading stops…"}
                </p>
              )}
            </div>
          ) : null}
          {feature.kind !== "trip" ? (
            <a
              className="google-maps-action"
              href={googleMapsSearchUrl({
                latitude: feature.latitude,
                longitude: feature.longitude,
              })}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ArrowSquareOut size={17} />
              {locale === "th"
                ? "นำทางด้วย Google Maps"
                : "Open in Google Maps"}
            </a>
          ) : null}
          {feature.canEdit ? (
            <div className="owner-actions">
              <PendingLink href={`/maps?marker=${feature.id}&modal=edit`}>
                {locale === "th" ? "แก้ไข" : "Edit"}
              </PendingLink>
              <form action={removeContent}>
                <input name="domain" type="hidden" value={domain} />
                <input name="id" type="hidden" value={feature.id} />
                <ActionSubmitButton
                  ariaLabel={locale === "th" ? "ลบ" : "Delete"}
                  className=""
                  pendingLabel={locale === "th" ? "กำลังลบ…" : "Deleting…"}
                >
                  <Trash size={16} />
                  {locale === "th" ? "ลบ" : "Delete"}
                </ActionSubmitButton>
              </form>
            </div>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
