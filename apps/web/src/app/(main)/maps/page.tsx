import type { EventDto, ExploreFeatureDto } from "@iride/types";

import { getVerifiedWebSession } from "@/lib/auth-session";
import { getEvent } from "@/lib/content-api";
import { getRequestLocale } from "@/lib/request-locale";
import { ActivityHub } from "../_components/activity-hub";
import { captureData } from "@/lib/data-result";

export default async function MapsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ marker?: string; modal?: string }>;
}) {
  const [locale, params, session] = await Promise.all([
    getRequestLocale(),
    searchParams,
    getVerifiedWebSession().catch(() => null),
  ]);
  const accessToken = session?.accessToken;
  const selectedResult = params.marker
    ? await captureData(() => getEvent(params.marker as string, accessToken))
    : null;
  const selectedContent =
    selectedResult?.status === "success" ? selectedResult.data : null;
  const initialFeature = selectedContent
    ? toExploreFeature(selectedContent)
    : null;
  const initialEdit =
    params.modal === "edit" && selectedContent?.canEdit
      ? selectedContent
      : null;
  return (
    <ActivityHub
      editDenied={
        params.modal === "edit" && Boolean(params.marker) && !initialEdit
      }
      initialEdit={initialEdit}
      initialFeature={initialFeature}
      locale={locale}
      selectedFeatureUnavailable={selectedResult?.status === "error"}
    />
  );
}

function toExploreFeature(content: EventDto): ExploreFeatureDto {
  return {
    id: content.id,
    kind: content.kind,
    title: content.title,
    subtitle: content.locationLabel,
    latitude: content.latitude,
    longitude: content.longitude,
    startsAt: content.startsAt,
    endsAt: content.endsAt,
    author: content.organizer,
    canEdit: content.canEdit,
  };
}
