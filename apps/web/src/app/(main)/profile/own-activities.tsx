import { getOwnProfile } from "@/lib/profile-api";
import { getProfileActivities } from "@/lib/content-api";
import { captureData } from "@/lib/data-result";
import { SectionError } from "@/features/errors/components/section-error";
import { ProfileActivities } from "@/features/profile/components/profile-panels";
import type { Locale } from "@/lib/locale";

export async function OwnActivities({
  accessToken,
  locale,
}: {
  readonly accessToken: string;
  readonly locale: Locale;
}) {
  const result = await captureData(async () => {
    const profile = await getOwnProfile(accessToken);
    return profile.username
      ? getProfileActivities(profile.username, accessToken)
      : [];
  });
  return result.status === "error" ? (
    <SectionError
      category={result.error.category}
      message={
        locale === "th" ? "โหลดกิจกรรมไม่ได้" : "Could not load activities."
      }
      title={locale === "th" ? "กิจกรรม" : "Activities"}
      retryLabel={locale === "th" ? "ลองอีกครั้ง" : "Retry"}
    />
  ) : (
    <ProfileActivities activities={result.data} locale={locale} />
  );
}
