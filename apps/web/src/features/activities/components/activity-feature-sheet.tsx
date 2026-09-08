"use client";

import { ArrowSquareOut, Trash, X } from "@phosphor-icons/react";
import type { ExploreFeatureDto } from "@iride/types";
import { createPortal } from "react-dom";
import { type CSSProperties, useEffect, useRef, useState } from "react";

import { removeContent } from "@/app/(main)/create/actions";
import { ActionSubmitButton } from "@/features/content/components/action-submit-button";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { googleMapsSearchUrl } from "@/lib/google-maps-domain";
import type { Locale } from "@/lib/locale";
import { contentKindColors } from "@/lib/map-palette";

import { getActivityKindLabel } from "../activity-kind-label";

export function ActivityFeatureSheet({
  feature,
  locale,
  onClose,
}: {
  readonly feature: ExploreFeatureDto;
  readonly locale: Locale;
  readonly onClose: () => void;
}) {
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
        ref={sheetRef}
        role="dialog"
      >
        <button
          aria-label="Close"
          className="sheet-close"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <X size={18} />
        </button>
        <div className="activity-sheet-body">
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
          <p>{feature.subtitle}</p>
          <p>
            <PendingLink href={`/users/${feature.author.username}`}>
              {feature.author.displayName}
            </PendingLink>{" "}
            ·{" "}
            <time dateTime={feature.startsAt}>
              {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(feature.startsAt))}
            </time>
          </p>
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
            {locale === "th" ? "นำทางด้วย Google Maps" : "Open in Google Maps"}
          </a>
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
