import { createAdminDatabaseClient } from "@iride/database/admin";
import { createServerDatabaseClient } from "@iride/database/server";
import type {
  TripEngagementDto,
  TripParticipationDto,
  TripRecapEntryDto,
  TripStop,
} from "@iride/types";
import type { TripRepository } from "./trip-engagement";
import { TripError } from "./trip-engagement";

type Config = { url: string; publishableKey: string; serviceRoleKey: string };

export function createTripRepository(config: Config): TripRepository {
  const admin = createAdminDatabaseClient(config);
  const owner = (token: string) =>
    createServerDatabaseClient({
      url: config.url,
      publishableKey: config.publishableKey,
      accessToken: token,
    });

  async function get(
    id: string,
    viewerId: string | null,
  ): Promise<TripEngagementDto | null> {
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id,kind,organizer_id,trip_status,completed_at,deleted_at")
      .eq("id", id)
      .maybeSingle();
    ensureRead(eventError);
    if (!event || event.deleted_at || event.kind !== "trip") return null;
    const { data: organizerAccess, error: organizerAccessError } = await admin
      .from("account_access")
      .select("status,transition_id")
      .eq("user_id", event.organizer_id)
      .maybeSingle();
    ensureRead(organizerAccessError);
    if (
      viewerId !== event.organizer_id &&
      (organizerAccess?.status === "suspended" ||
        organizerAccess?.transition_id !== null)
    )
      return null;
    const [
      participationsResult,
      announcementsResult,
      recapResult,
      entriesResult,
    ] = await Promise.all([
      admin
        .from("trip_participations")
        .select("*")
        .eq("event_id", id)
        .order("created_at"),
      admin
        .from("trip_announcements")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false }),
      admin.from("trip_recaps").select("*").eq("event_id", id).maybeSingle(),
      admin
        .from("trip_recap_entries")
        .select("*")
        .eq("event_id", id)
        .order("created_at"),
    ]);
    ensureRead(participationsResult.error);
    ensureRead(announcementsResult.error);
    ensureRead(recapResult.error);
    ensureRead(entriesResult.error);
    const participations = participationsResult.data ?? [];
    const entries = entriesResult.data ?? [];
    const userIds = [
      ...new Set([
        ...participations.map((item) => item.user_id),
        ...entries.map((item) => item.author_id),
      ]),
    ];
    const { data: profiles, error: profileError } = userIds.length
      ? await admin
          .from("profiles")
          .select("id,username,display_name")
          .in("id", userIds)
      : { data: [], error: null };
    ensureRead(profileError);
    const { data: accessRows, error: accessError } = userIds.length
      ? await admin
          .from("account_access")
          .select("user_id,status,transition_id")
          .in("user_id", userIds)
      : { data: [], error: null };
    ensureRead(accessError);
    const visibleUsers = new Set(
      (accessRows ?? [])
        .filter(
          (row) => row.status !== "suspended" && row.transition_id === null,
        )
        .map((row) => row.user_id),
    );
    const people = new Map(
      (profiles ?? [])
        .filter((profile) => visibleUsers.has(profile.id))
        .map((profile) => [profile.id, profile]),
    );
    const vehicleIds = [
      ...new Set(
        participations
          .map((item) => item.vehicle_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const { data: vehicles, error: vehicleError } = vehicleIds.length
      ? await admin
          .from("vehicles")
          .select("id,kind,brand,model,visibility,archived_at")
          .in("id", vehicleIds)
      : { data: [], error: null };
    ensureRead(vehicleError);
    const publicVehicles = new Map(
      (vehicles ?? [])
        .filter(
          (vehicle) => vehicle.visibility === "public" && !vehicle.archived_at,
        )
        .map((vehicle) => [vehicle.id, vehicle]),
    );
    const canOrganize = viewerId === event.organizer_id;
    const viewerStatus = participations.find(
      (item) => item.user_id === viewerId,
    )?.status;
    const canContribute =
      event.trip_status === "completed" &&
      !recapResult.data?.published_at &&
      Boolean(viewerId) &&
      (canOrganize || viewerStatus === "going");
    const participants: TripParticipationDto[] = participations.flatMap(
      (item) => {
        const user = people.get(item.user_id);
        if (!user?.username || !user.display_name) return [];
        const vehicle = item.vehicle_id
          ? publicVehicles.get(item.vehicle_id)
          : null;
        return [
          {
            user: {
              id: user.id,
              username: user.username,
              displayName: user.display_name,
            },
            status: item.status === "going" ? "going" : "interested",
            vehicle: vehicle
              ? {
                  id: vehicle.id,
                  label: `${vehicle.brand} ${vehicle.model}`,
                  kind: vehicle.kind,
                }
              : null,
            ridingArea: item.riding_area,
          },
        ];
      },
    );
    const recapRow = recapResult.data;
    const visibleEntries =
      recapRow?.published_at || canOrganize
        ? entries
        : entries.filter((entry) => entry.author_id === viewerId);
    const recapEntries: TripRecapEntryDto[] = visibleEntries.flatMap(
      (entry) => {
        const author = people.get(entry.author_id);
        return author?.username && author.display_name
          ? [
              {
                id: entry.id,
                author: {
                  id: author.id,
                  username: author.username,
                  displayName: author.display_name,
                },
                stopName: entry.stop_name,
                review: entry.review,
                mediaIds: entry.media_ids,
                createdAt: entry.created_at,
              },
            ]
          : [];
      },
    );
    return {
      eventId: id,
      status: event.trip_status === "completed" ? "completed" : "planned",
      completedAt: event.completed_at,
      canOrganize,
      canContribute,
      viewerStatus:
        viewerStatus === "going" || viewerStatus === "interested"
          ? viewerStatus
          : null,
      participants,
      announcements: (announcementsResult.data ?? []).map((item) => ({
        id: item.id,
        body: item.body,
        createdAt: item.created_at,
      })),
      recap:
        (recapRow && (recapRow.published_at || canOrganize || canContribute)) ||
        (canContribute && recapEntries.length)
          ? {
              summary:
                recapRow && (recapRow.published_at || canOrganize)
                  ? recapRow.summary
                  : "",
              routePoints:
                recapRow && (recapRow.published_at || canOrganize)
                  ? (recapRow.route_points as unknown as TripStop[])
                  : [],
              publishedAt: recapRow?.published_at ?? null,
              entries: recapEntries,
            }
          : null,
    };
  }

  const requireTrip = async (id: string, viewerId: string | null) => {
    const data = await get(id, viewerId);
    if (!data) throw new TripError("TRIP_NOT_FOUND", 404);
    return data;
  };

  return {
    get,
    async saveParticipation(userId, token, id, input) {
      await requireTrip(id, userId);
      const { error } = await owner(token).from("trip_participations").upsert(
        {
          event_id: id,
          user_id: userId,
          status: input.status,
          vehicle_id: input.vehicleId,
          riding_area: input.ridingArea,
        },
        { onConflict: "event_id,user_id" },
      );
      ensureWrite(error);
      return requireTrip(id, userId);
    },
    async removeParticipation(userId, token, id) {
      await requireTrip(id, userId);
      const { error } = await owner(token)
        .from("trip_participations")
        .delete()
        .eq("event_id", id)
        .eq("user_id", userId);
      ensureWrite(error);
      return requireTrip(id, userId);
    },
    async announce(userId, token, id, body) {
      const trip = await requireTrip(id, userId);
      if (!trip.canOrganize) throw new TripError("TRIP_FORBIDDEN", 403);
      const { error } = await owner(token).from("trip_announcements").insert({
        event_id: id,
        author_id: userId,
        body,
      });
      ensureWrite(error);
      return requireTrip(id, userId);
    },
    async complete(userId, token, id) {
      const trip = await requireTrip(id, userId);
      if (!trip.canOrganize) throw new TripError("TRIP_FORBIDDEN", 403);
      if (trip.status === "completed")
        throw new TripError("TRIP_ALREADY_COMPLETED", 409);
      const { data, error } = await owner(token)
        .from("events")
        .update({
          trip_status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organizer_id", userId)
        .eq("trip_status", "planned")
        .select("id")
        .maybeSingle();
      ensureWrite(error);
      if (!data) throw new TripError("TRIP_ALREADY_COMPLETED", 409);
      return requireTrip(id, userId);
    },
    async saveRecap(userId, token, id, input) {
      const trip = await requireTrip(id, userId);
      if (!trip.canOrganize || trip.status !== "completed")
        throw new TripError("TRIP_FORBIDDEN", 403);
      const { error } = await owner(token)
        .from("trip_recaps")
        .upsert(
          {
            event_id: id,
            summary: input.summary,
            route_points: input.routePoints.map((point) => ({ ...point })),
          },
          { onConflict: "event_id" },
        );
      ensureWrite(error);
      return requireTrip(id, userId);
    },
    async publishRecap(userId, token, id) {
      const trip = await requireTrip(id, userId);
      if (!trip.canOrganize || trip.status !== "completed")
        throw new TripError("TRIP_FORBIDDEN", 403);
      const { data, error } = await owner(token)
        .from("trip_recaps")
        .update({ published_at: new Date().toISOString() })
        .eq("event_id", id)
        .is("published_at", null)
        .select("event_id")
        .maybeSingle();
      ensureWrite(error);
      if (!data) throw new TripError("TRIP_RECAP_NOT_FOUND", 404);
      return requireTrip(id, userId);
    },
    async addEntry(userId, token, id, input) {
      const trip = await requireTrip(id, userId);
      if (!trip.canContribute) throw new TripError("TRIP_FORBIDDEN", 403);
      const { error } = await owner(token).from("trip_recap_entries").insert({
        event_id: id,
        author_id: userId,
        stop_name: input.stopName,
        review: input.review,
        media_ids: input.mediaIds,
      });
      ensureWrite(error);
      return requireTrip(id, userId);
    },
    async removeEntry(userId, token, id, entryId) {
      await requireTrip(id, userId);
      const { data, error } = await owner(token)
        .from("trip_recap_entries")
        .delete()
        .eq("event_id", id)
        .eq("id", entryId)
        .select("id")
        .maybeSingle();
      ensureWrite(error);
      if (!data) throw new TripError("TRIP_RECAP_ENTRY_NOT_FOUND", 404);
      return requireTrip(id, userId);
    },
  };
}

function ensureRead(error: { message?: string } | null) {
  if (error) throw new TripError("TRIP_UNAVAILABLE", 503);
}
function ensureWrite(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new TripError("TRIP_FORBIDDEN", 403);
  if (error.code === "23514" || error.code === "23503")
    throw new TripError("TRIP_VALIDATION_FAILED", 400);
  throw new TripError("TRIP_UNAVAILABLE", 503);
}
