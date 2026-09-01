import type { EventDto, ExploreFeatureDto, PhotographerSpotDto } from "@iride/types";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvent, getPhotographerSpot } from "@/lib/content-api";
import { getRequestLocale } from "@/lib/request-locale";
import { ActivityHub } from "../_components/activity-hub";

export default async function MapsPage({ searchParams }: { readonly searchParams: Promise<{ marker?: string; modal?: string }> }) {
  const [locale, params, session] = await Promise.all([getRequestLocale(), searchParams, getVerifiedWebSession().catch(() => null)]);
  const accessToken = session?.accessToken;
  const selectedContent = params.marker
    ? await getEvent(params.marker, accessToken).catch(() => getPhotographerSpot(params.marker!, accessToken).catch(() => null))
    : null;
  const initialFeature = selectedContent ? toExploreFeature(selectedContent) : null;
  const initialEdit = params.modal === "edit" && selectedContent?.canEdit ? selectedContent : null;
  return <ActivityHub editDenied={params.modal === "edit" && Boolean(params.marker) && !initialEdit} initialEdit={initialEdit} initialFeature={initialFeature} locale={locale} />;
}

function toExploreFeature(content: EventDto | PhotographerSpotDto): ExploreFeatureDto {
  return {
    id: content.id,
    kind: "photographer" in content ? "photographerSpot" : content.kind,
    title: content.title,
    subtitle: content.locationLabel,
    latitude: content.latitude,
    longitude: content.longitude,
    startsAt: content.startsAt,
    endsAt: content.endsAt,
    author: "photographer" in content ? content.photographer : content.organizer,
    canEdit: content.canEdit,
  };
}
