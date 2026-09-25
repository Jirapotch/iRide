"use client";

import type {
  EventDto,
  TripEngagementDto,
  TripParticipationStatus,
  TripStop,
  VehicleDto,
} from "@iride/types";
import { useState } from "react";
import Image from "next/image";
import { MediaUploader } from "@/features/profile/components/media-uploader";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { routePointsForEvent } from "@/features/activities/activity-presentation-domain";
import { mediaVariantUrl } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";
import { browserApiMutation } from "@/services/browser-api";

export function TripEngagementPanel({
  event,
  initial,
  locale,
  vehicles,
  authenticated,
  viewerId,
}: {
  readonly event: EventDto;
  readonly initial: TripEngagementDto | null;
  readonly locale: Locale;
  readonly vehicles: readonly VehicleDto[];
  readonly authenticated: boolean;
  readonly viewerId: string | null;
}) {
  const th = locale === "th";
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownParticipation = initial?.participants.find(
    (item) => item.user.id === viewerId,
  );
  const [vehicleId, setVehicleId] = useState(
    ownParticipation?.vehicle?.id ?? "",
  );
  const [ridingArea, setRidingArea] = useState(
    ownParticipation?.ridingArea ?? "",
  );
  const [announcement, setAnnouncement] = useState("");
  const [review, setReview] = useState("");
  const [stopName, setStopName] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [summary, setSummary] = useState(initial?.recap?.summary ?? "");
  const [routePoints, setRoutePoints] = useState<TripStop[]>(() =>
    initial?.recap?.routePoints.length
      ? [...initial.recap.routePoints]
      : routePointsForEvent(event)
          .filter(
            (point) => point.latitude !== null && point.longitude !== null,
          )
          .map((point) => ({
            name: point.name,
            latitude: point.latitude!,
            longitude: point.longitude!,
          }))
          .slice(0, 20),
  );
  const path = `/events/${encodeURIComponent(event.id)}`;
  async function mutate(
    route: string,
    method: "POST" | "DELETE",
    input?: unknown,
  ) {
    setBusy(true);
    setError(null);
    try {
      const next = await browserApiMutation<TripEngagementDto>(
        `${path}${route}`,
        method,
        input,
      );
      setData(next);
      return true;
    } catch {
      setError(
        th
          ? "บันทึกข้อมูลไม่ได้ กรุณาลองอีกครั้ง"
          : "Could not save. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="trip-engagement" role="alert">
        {th
          ? "โหลดข้อมูลการเข้าร่วมไม่ได้"
          : "Participation details could not load."}
      </section>
    );
  const interested = data.participants.filter(
    (item) => item.status === "interested",
  );
  const going = data.participants.filter((item) => item.status === "going");
  const canEditPlan = data.status === "planned";
  return (
    <div className="trip-engagement">
      <section className="premium-card trip-participation">
        <h2>{th ? "นัดขี่ด้วยกัน" : "Ride together"}</h2>
        {canEditPlan ? (
          authenticated ? (
            <>
              <div className="trip-rider-fields">
                <label>
                  {th ? "รถที่ใช้ (ไม่บังคับ)" : "Your vehicle (optional)"}
                  <select
                    value={vehicleId}
                    onChange={(event) => setVehicleId(event.target.value)}
                  >
                    <option value="">{th ? "ไม่ระบุ" : "Not specified"}</option>
                    {vehicles
                      .filter((vehicle) => vehicle.visibility === "public")
                      .map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.brand} {vehicle.model}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {th
                    ? "พื้นที่ที่สะดวก (ไม่บังคับ)"
                    : "Convenient riding area (optional)"}
                  <input
                    maxLength={120}
                    value={ridingArea}
                    onChange={(event) => setRidingArea(event.target.value)}
                    placeholder={
                      th ? "เช่น เชียงใหม่และใกล้เคียง" : "e.g. Chiang Mai area"
                    }
                  />
                </label>
              </div>
              <p className="form-hint">
                {th
                  ? "ชื่อ รถที่เลือก และพื้นที่ที่กรอกจะแสดงให้ทุกคนเห็นบนหน้าทริป ไม่แสดงพิกัดส่วนตัว"
                  : "Your name, selected vehicle, and area will be public on this trip. Your exact location is never shown."}
              </p>
              <div className="trip-choice-actions">
                {(["interested", "going"] as TripParticipationStatus[]).map(
                  (status) => (
                    <button
                      aria-pressed={data.viewerStatus === status}
                      disabled={busy}
                      key={status}
                      onClick={() =>
                        void mutate("/participation", "POST", {
                          status,
                          vehicleId: vehicleId || null,
                          ridingArea: ridingArea.trim() || null,
                        })
                      }
                      type="button"
                    >
                      {status === "interested"
                        ? th
                          ? "สนใจ"
                          : "Interested"
                        : th
                          ? "เข้าร่วม"
                          : "Going"}
                    </button>
                  ),
                )}
                {data.viewerStatus ? (
                  <button
                    disabled={busy}
                    onClick={() => void mutate("/participation", "DELETE")}
                    type="button"
                  >
                    {th ? "ยกเลิกการตอบรับ" : "Remove response"}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <PendingLink
              href={`/login?next=${encodeURIComponent(`/activities/${event.id}`)}`}
            >
              {th
                ? "เข้าสู่ระบบเพื่อแสดงความสนใจหรือเข้าร่วม"
                : "Sign in to respond"}
            </PendingLink>
          )
        ) : (
          <p>
            {th
              ? "ผู้จัดยืนยันทริปจบแล้ว"
              : "The organizer marked this trip complete."}
          </p>
        )}
        <div className="trip-participant-columns">
          <ParticipantList
            title={th ? "สนใจ" : "Interested"}
            items={interested}
            locale={locale}
          />
          <ParticipantList
            title={th ? "เข้าร่วม" : "Going"}
            items={going}
            locale={locale}
          />
        </div>
      </section>
      <section className="premium-card trip-announcements">
        <h2>{th ? "ประกาศจากผู้จัด" : "Organizer updates"}</h2>
        {data.announcements.length ? (
          <ol>
            {data.announcements.map((item) => (
              <li key={item.id}>
                <p>{item.body}</p>
                <time dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat(th ? "th-TH" : "en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(item.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p>{th ? "ยังไม่มีประกาศ" : "No updates yet."}</p>
        )}
        {data.canOrganize ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void mutate("/announcements", "POST", {
                body: announcement,
              }).then((ok) => {
                if (ok) setAnnouncement("");
              });
            }}
          >
            <label>
              {th ? "แจ้งการเปลี่ยนแปลง" : "Post an update"}
              <textarea
                maxLength={1000}
                required
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
              />
            </label>
            <button disabled={busy} type="submit">
              {th ? "ประกาศ" : "Post update"}
            </button>
          </form>
        ) : null}
      </section>
      {data.canOrganize && canEditPlan ? (
        <section className="trip-completion">
          <button
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  th
                    ? "ยืนยันทริปจบแล้ว? หลังจากนี้จะเริ่มบันทึกเรื่องราวได้"
                    : "Mark this trip complete and open its recap?",
                )
              )
                void mutate("/complete", "POST", {});
            }}
            type="button"
          >
            {th ? "ยืนยันว่าทริปจบแล้ว" : "Mark trip complete"}
          </button>
        </section>
      ) : null}
      {data.status === "completed" ? (
        <section className="premium-card trip-recap-panel">
          <h2>{th ? "เรื่องราวหลังทริป" : "After the ride"}</h2>
          {data.recap?.publishedAt ? (
            <PendingLink href={`/activities/${event.id}/recap`}>
              {th ? "เปิดสรุปทริปที่แชร์ได้" : "Open shareable trip recap"}
            </PendingLink>
          ) : null}
          {data.canContribute ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void mutate("/recap/entries", "POST", {
                  stopName: stopName || null,
                  review,
                  mediaIds,
                }).then((ok) => {
                  if (ok) {
                    setReview("");
                    setStopName("");
                    setMediaIds([]);
                  }
                });
              }}
            >
              <h3>
                {th ? "เพิ่มรูปหรือรีวิวจุดแวะ" : "Add photos or a stop review"}
              </h3>
              <label>
                {th ? "จุดแวะ (ไม่บังคับ)" : "Stop (optional)"}
                <select
                  value={stopName}
                  onChange={(event) => setStopName(event.target.value)}
                >
                  <option value="">{th ? "ทั้งทริป" : "Whole trip"}</option>
                  {routePointsForEvent(event).map((point, index) => (
                    <option key={index} value={point.name}>
                      {point.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {th ? "รีวิว" : "Review"}
                <textarea
                  maxLength={2000}
                  value={review}
                  onChange={(event) => setReview(event.target.value)}
                />
              </label>
              {mediaIds.length < 8 ? (
                <MediaUploader
                  locale={locale}
                  purpose="trip_recap"
                  onReady={(id) => setMediaIds((items) => [...items, id])}
                />
              ) : null}
              <div className="trip-recap-photos">
                {mediaIds.map((id) => (
                  <span key={id}>
                    <Image
                      alt={th ? "รูปทริปที่อัปโหลด" : "Uploaded trip photo"}
                      src={mediaVariantUrl(id, "thumbnail")}
                      width={180}
                      height={135}
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMediaIds((items) =>
                          items.filter((item) => item !== id),
                        )
                      }
                    >
                      {th ? "นำออก" : "Remove"}
                    </button>
                  </span>
                ))}
              </div>
              <button
                disabled={busy || (!review.trim() && !mediaIds.length)}
                type="submit"
              >
                {th ? "เพิ่มเรื่องราว" : "Add story"}
              </button>
            </form>
          ) : null}
          {data.recap?.entries.length ? (
            <div className="trip-recap-entries">
              {data.recap.entries.map((entry) => (
                <article key={entry.id}>
                  <PendingLink
                    href={`/users/${encodeURIComponent(entry.author.username)}`}
                  >
                    {entry.author.displayName}
                  </PendingLink>
                  {entry.stopName ? <small>{entry.stopName}</small> : null}
                  <p>{entry.review}</p>
                  <div className="trip-recap-photos">
                    {entry.mediaIds.map((id) => (
                      <Image
                        alt={entry.stopName ?? (th ? "ภาพทริป" : "Trip photo")}
                        key={id}
                        src={mediaVariantUrl(id, "thumbnail")}
                        width={180}
                        height={135}
                        unoptimized
                      />
                    ))}
                  </div>
                  {data.canOrganize || entry.author.id === viewerId ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            th ? "นำเรื่องราวนี้ออก?" : "Remove this story?",
                          )
                        )
                          void mutate(`/recap/entries/${entry.id}`, "DELETE");
                      }}
                    >
                      {th ? "นำออก" : "Remove"}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
          {data.canOrganize ? (
            <div className="trip-recap-editor">
              <h3>{th ? "สรุปอย่างเป็นทางการ" : "Official recap"}</h3>
              <label>
                {th ? "บันทึกทริป" : "Trip summary"}
                <textarea
                  maxLength={4000}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                />
              </label>
              <p>
                {th
                  ? "หมุดเส้นทางที่บันทึกด้วยมือ"
                  : "Manually saved route points"}
              </p>
              {routePoints.map((point, index) => (
                <div className="trip-recap-route-point" key={index}>
                  <input
                    aria-label={
                      th ? `ชื่อจุด ${index + 1}` : `Point ${index + 1} name`
                    }
                    value={point.name}
                    onChange={(event) =>
                      setRoutePoints((items) =>
                        items.map((item, at) =>
                          at === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={th ? "ละติจูด" : "Latitude"}
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={point.latitude}
                    onChange={(event) =>
                      setRoutePoints((items) =>
                        items.map((item, at) =>
                          at === index
                            ? { ...item, latitude: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={th ? "ลองจิจูด" : "Longitude"}
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={point.longitude}
                    onChange={(event) =>
                      setRoutePoints((items) =>
                        items.map((item, at) =>
                          at === index
                            ? { ...item, longitude: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRoutePoints((items) =>
                        items.filter((_, at) => at !== index),
                      )
                    }
                  >
                    {th ? "ลบจุด" : "Remove point"}
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={routePoints.length >= 20}
                onClick={() =>
                  setRoutePoints((items) => [
                    ...items,
                    { name: "", latitude: 13.7563, longitude: 100.5018 },
                  ])
                }
              >
                {th ? "เพิ่มหมุด" : "Add point"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void mutate("/recap", "POST", { summary, routePoints })
                }
              >
                {th ? "บันทึกสรุป" : "Save recap"}
              </button>
              {!data.recap?.publishedAt ? (
                <button
                  type="button"
                  disabled={busy || !data.recap}
                  onClick={() => {
                    if (
                      window.confirm(
                        th
                          ? "เผยแพร่สรุปทริปให้ทุกคนเห็น?"
                          : "Publish this recap for everyone?",
                      )
                    )
                      void mutate("/recap/publish", "POST", {});
                  }}
                >
                  {th ? "เผยแพร่สรุป" : "Publish recap"}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ParticipantList({
  title,
  items,
  locale,
}: {
  readonly title: string;
  readonly items: readonly TripEngagementDto["participants"][number][];
  readonly locale: Locale;
}) {
  return (
    <section>
      <h3>
        {title} ({items.length})
      </h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.user.id}>
              <PendingLink
                href={`/users/${encodeURIComponent(item.user.username)}`}
              >
                {item.user.displayName}
              </PendingLink>
              {item.vehicle ? <small>{item.vehicle.label}</small> : null}
              {item.ridingArea ? (
                <small>
                  {locale === "th" ? "พื้นที่: " : "Area: "}
                  {item.ridingArea}
                </small>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{locale === "th" ? "ยังไม่มีคน" : "No riders yet."}</p>
      )}
    </section>
  );
}
