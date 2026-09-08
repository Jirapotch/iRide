import type { ExploreFeatureKind } from "@iride/types";

import type { Locale } from "@/lib/locale";

export function getActivityKindLabel(
  kind: ExploreFeatureKind,
  locale: Locale,
): string {
  const labels =
    locale === "th"
      ? {
          meeting: "นัดพบ",
          event: "กิจกรรม",
          trip: "ทริป",
        }
      : {
          meeting: "Meeting",
          event: "Event",
          trip: "Trip",
        };
  return labels[kind];
}
