import type { OwnProfileDto } from "@iride/types";

import { getGarage, getProfileActivities } from "@/lib/content-api";
import { captureData } from "@/lib/data-result";
import type { Locale } from "@/lib/locale";
import { SectionError } from "../../_components/section-error";
import { GaragePanel, ProfileActivities } from "./user-profile-screen";

export interface ProfileTabContentProps {
  readonly accessToken: string | undefined;
  readonly canManage: boolean;
  readonly locale: Locale;
  readonly modal: string | undefined;
  readonly ownerProfile: OwnProfileDto | null;
  readonly selectedVehicleId: string | undefined;
  readonly tab: "overview" | "garage" | "activities";
  readonly username: string;
}

export async function ProfileTabContent(props: ProfileTabContentProps) {
  const text =
    props.locale === "th"
      ? {
          activitiesMessage: "ไม่สามารถโหลดกิจกรรมที่เผยแพร่ได้",
          activitiesTitle: "โหลดกิจกรรมไม่ได้",
          garageMessage: "ไม่สามารถโหลดข้อมูล Vehicle ได้",
          garageTitle: "โหลด Garage ไม่ได้",
          retry: "ลองอีกครั้ง",
        }
      : {
          activitiesMessage: "Published activities could not load.",
          activitiesTitle: "Activities unavailable",
          garageMessage: "Vehicles could not load.",
          garageTitle: "Garage unavailable",
          retry: "Retry",
        };

  if (props.tab === "activities") {
    const result = await captureData(() =>
      getProfileActivities(props.username, props.accessToken),
    );
    return result.status === "error" ? (
      <SectionError
        message={text.activitiesMessage}
        retryLabel={text.retry}
        title={text.activitiesTitle}
      />
    ) : (
      <ProfileActivities activities={result.data} locale={props.locale} />
    );
  }

  if (props.tab === "garage") {
    const result = await captureData(() =>
      getGarage(props.username, props.accessToken),
    );
    return result.status === "error" ? (
      <SectionError
        message={text.garageMessage}
        retryLabel={text.retry}
        title={text.garageTitle}
      />
    ) : (
      <GaragePanel
        canCreate={props.ownerProfile?.canWrite ?? false}
        canManage={props.canManage}
        locale={props.locale}
        modal={props.modal}
        ownerProfile={props.ownerProfile}
        selectedVehicleId={props.selectedVehicleId}
        username={props.username}
        vehicles={result.data}
      />
    );
  }

  return null;
}
