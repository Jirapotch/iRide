"use client";

import { useEffect, useRef, useState } from "react";
import type { EventDto } from "@iride/types";
import type { Locale } from "@/lib/locale";
import { CoordinatePicker } from "./content-editor-form";

type Point = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};
const emptyPoint = (id: string): Point => ({
  id,
  name: "",
  latitude: null,
  longitude: null,
});
const complete = (point: Point) =>
  point.latitude !== null && point.longitude !== null;

export function TripFields({
  event,
  locale,
}: {
  event: EventDto | null;
  locale: Locale;
}) {
  const th = locale === "th";
  const [title, setTitle] = useState(event?.title ?? "");
  const [destination, setDestination] = useState<Point>(() => ({
    id: "destination",
    name: event?.destinationLabel ?? "",
    latitude: event?.destinationLatitude ?? null,
    longitude: event?.destinationLongitude ?? null,
  }));
  const [origin, setOrigin] = useState<Point | null>(() =>
    event?.latitude != null && event?.longitude != null
      ? {
          id: "origin",
          name: event.locationLabel ?? "",
          latitude: event.latitude,
          longitude: event.longitude,
        }
      : null,
  );
  const [stops, setStops] = useState<Point[]>(() =>
    (event?.stops ?? []).map((point, index) => ({
      ...point,
      id: `stop-${index}`,
    })),
  );
  const nextId = useRef(stops.length);
  const [activeId, setActiveId] = useState("destination");
  const active =
    [destination, origin, ...stops].find((point) => point?.id === activeId) ??
    destination;
  const ordered = [...(origin ? [origin] : []), ...stops, destination];
  const mapPoints = ordered.filter(complete).map((point) => ({
    latitude: point.latitude!,
    longitude: point.longitude!,
    label:
      point.id === "destination" ? "⚑" : String(ordered.indexOf(point) + 1),
    name: point.name,
    destination: point.id === "destination",
    active: point.id === active.id,
  }));
  function update(id: string, changes: Partial<Point>) {
    if (id === "destination")
      setDestination((point) => ({ ...point, ...changes }));
    else if (id === "origin")
      setOrigin((point) => (point ? { ...point, ...changes } : point));
    else
      setStops((points) =>
        points.map((point) =>
          point.id === id ? { ...point, ...changes } : point,
        ),
      );
  }
  function move(index: number, delta: number) {
    setStops((points) => {
      const next = [...points];
      [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
      return next;
    });
  }
  const card = (point: Point, label: string, actions?: React.ReactNode) => (
    <div
      className={`trip-place-card ${active.id === point.id ? "is-active" : ""}`}
      key={point.id}
    >
      <div className="trip-place-heading">
        <strong>{label}</strong>
        {actions}
      </div>
      <PointName
        point={point}
        locale={locale}
        label={label}
        onChange={(name) => update(point.id, { name })}
        onInvalid={() => setActiveId(point.id)}
      />
      <button
        type="button"
        className="trip-select-place"
        aria-pressed={active.id === point.id}
        onClick={() => setActiveId(point.id)}
      >
        {complete(point)
          ? th
            ? "✓ เลือกพิกัดแล้ว · ปรับบนแผนที่"
            : "✓ Location selected · Adjust on map"
          : th
            ? "เลือกบนแผนที่ / นำเข้า Google Maps"
            : "Choose on map / Import Google Maps"}
      </button>
    </div>
  );
  return (
    <div className="trip-composer">
      <label className="form-field">
        <span>{th ? "ชื่อทริป" : "Trip name"} *</span>
        <input
          name="title"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={th ? "ทริปนี้จะไปไหนกัน" : "Where are we going?"}
        />
      </label>
      <div className="trip-section-heading">
        <h2>{th ? "จุดหมายของทริป" : "Your destination"}</h2>
        <p>
          {th
            ? "เลือกที่ที่อยากไป แล้วค่อยเพิ่มจุดเริ่มต้นและที่แวะ"
            : "Choose where to go, then add a start and stops."}
        </p>
      </div>
      {card(destination, th ? "⚑ จุดหมาย *" : "⚑ Destination *")}
      {origin ? (
        card(
          origin,
          th ? "1 จุดเริ่มต้น" : "1 Start",
          <button
            type="button"
            onClick={() => {
              setOrigin(null);
              setActiveId("destination");
            }}
          >
            {th ? "นำออก" : "Remove"}
          </button>,
        )
      ) : (
        <button
          className="secondary-action"
          type="button"
          onClick={() => {
            setOrigin(emptyPoint("origin"));
            setActiveId("origin");
          }}
        >
          + {th ? "เพิ่มจุดเริ่มต้น" : "Add a start"}
        </button>
      )}
      {stops.map((point, index) =>
        card(
          point,
          `${index + (origin ? 2 : 1)} ${th ? "จุดแวะ" : "Stop"}`,
          <div className="trip-stop-actions">
            <button
              type="button"
              aria-label={th ? "เลื่อนขึ้น" : "Move up"}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={th ? "เลื่อนลง" : "Move down"}
              disabled={index === stops.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => {
                setStops((points) =>
                  points.filter((item) => item.id !== point.id),
                );
                setActiveId("destination");
              }}
            >
              {th ? "นำออก" : "Remove"}
            </button>
          </div>,
        ),
      )}
      <button
        className="secondary-action"
        type="button"
        disabled={stops.length >= 20}
        onClick={() => {
          const point = emptyPoint(`stop-${nextId.current++}`);
          setStops((points) => [...points, point]);
          setActiveId(point.id);
        }}
      >
        + {th ? "เพิ่มจุดแวะ" : "Add a stop"} ({stops.length}/20)
      </button>
      <section
        className="trip-map-editor"
        aria-label={th ? "เลือกสถานที่" : "Choose a place"}
      >
        <p className="form-hint">
          {th ? "กำลังเลือก: " : "Editing: "}
          {active.name ||
            (active.id === "destination"
              ? th
                ? "จุดหมาย"
                : "Destination"
              : active.id === "origin"
                ? th
                  ? "จุดเริ่มต้น"
                  : "Start"
                : th
                  ? "จุดแวะ"
                  : "Stop")}
        </p>
        <CoordinatePicker
          locale={locale}
          selected={complete(active)}
          points={mapPoints}
          coordinates={{
            latitude: active.latitude ?? destination.latitude ?? 13.7563,
            longitude: active.longitude ?? destination.longitude ?? 100.5018,
          }}
          onChange={(point) => update(active.id, point)}
          onImportName={(name) => {
            update(active.id, { name });
            if (active.id === "destination")
              setTitle((value) => (value.trim() ? value : name.slice(0, 120)));
          }}
        />
      </section>
      <input type="hidden" name="destinationLabel" value={destination.name} />
      <input
        type="hidden"
        name="destinationLatitude"
        value={destination.latitude ?? ""}
      />
      <input
        type="hidden"
        name="destinationLongitude"
        value={destination.longitude ?? ""}
      />
      <input type="hidden" name="locationLabel" value={origin?.name ?? ""} />
      <input type="hidden" name="latitude" value={origin?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={origin?.longitude ?? ""} />
      <input
        type="hidden"
        name="stops"
        value={JSON.stringify(
          stops.map(({ name, latitude, longitude }) => ({
            name,
            latitude,
            longitude,
          })),
        )}
      />
      <details
        className="trip-options"
        open={Boolean(event?.description || event?.startsAt || event?.endsAt)}
      >
        <summary>
          {th
            ? "รายละเอียดและกำหนดการ (ไม่บังคับ)"
            : "Details and schedule (optional)"}
        </summary>
        <label className="form-field">
          <span>{th ? "รายละเอียด" : "Description"}</span>
          <textarea
            name="description"
            defaultValue={event?.description ?? ""}
            maxLength={2000}
          />
        </label>
        <label className="form-field">
          <span>{th ? "เริ่ม" : "Starts"}</span>
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={localDate(event?.startsAt)}
          />
        </label>
        <label className="form-field">
          <span>{th ? "สิ้นสุด" : "Ends"}</span>
          <input
            type="datetime-local"
            name="endsAt"
            defaultValue={localDate(event?.endsAt)}
          />
        </label>
      </details>
    </div>
  );
}

function PointName({
  point,
  locale,
  label,
  onChange,
  onInvalid,
}: {
  point: Point;
  locale: Locale;
  label: string;
  onChange: (name: string) => void;
  onInvalid: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.setCustomValidity(
      complete(point)
        ? ""
        : locale === "th"
          ? "กรุณาเลือกพิกัดบนแผนที่หรือนำเข้าลิงก์สถานที่"
          : "Choose coordinates on the map or import a place link",
    );
  }, [point, locale]);
  return (
    <input
      ref={ref}
      aria-label={label}
      required
      maxLength={160}
      value={point.name}
      placeholder={locale === "th" ? "ชื่อสถานที่" : "Place name"}
      onChange={(e) => onChange(e.target.value)}
      onInvalid={onInvalid}
    />
  );
}

function localDate(value?: string | null) {
  if (!value) return "";
  // The form submits Asia/Bangkok wall time, independent of browser timezone.
  return new Date(new Date(value).getTime() + 7 * 3600_000)
    .toISOString()
    .slice(0, 16);
}
