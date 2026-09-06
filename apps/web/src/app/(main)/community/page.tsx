import styles from "./community.module.css";
import { PendingLink } from "../_components/pending-link";
import {
  ArrowRightIcon,
  BicycleIcon,
  CarIcon,
  MotorcycleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getRequestLocale } from "@/lib/request-locale";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";

const copy = {
  th: {
    all: "ทั้งหมด",
    car: "รถยนต์",
    motorcycle: "มอเตอร์ไซค์",
    bicycle: "จักรยาน",
    group: "กลุ่ม",
    communityTitle: "เลือกชุมชน",
    viewCommunity: "ดูชุมชน",
  },
  en: {
    all: "All",
    car: "Cars",
    motorcycle: "Motorcycles",
    bicycle: "Bicycles",
    group: "Group",
    communityTitle: "Explore community",
    viewCommunity: "View community",
  },
} as const;

const communityDestinations = [
  { kind: "car", href: "/community/car", icon: CarIcon },
  {
    kind: "motorcycle",
    href: "/community/motorcycle",
    icon: MotorcycleIcon,
  },
  { kind: "bicycle", href: "/community/bicycle", icon: BicycleIcon },
  { kind: "group", href: "/community/groups", icon: UsersThreeIcon },
] as const;

export default async function CommunityPage() {
  const locale = await getRequestLocale();
  const text = copy[locale];
  const breadcrumbs = resolveBreadcrumbs(`/community`, { locale });

  return (
    <main className="community-section-page">
      <Breadcrumbs items={breadcrumbs} locale={locale} />
      <div className={styles.sectionHeading}>
        <h3>{text.communityTitle}</h3>
      </div>
      <div className={styles.groupRail} aria-live="polite">
        {communityDestinations.map(({ kind, href, icon: Icon }) => {
          const label = text[kind];
          const linkLabel =
            locale === "th"
              ? `${text.viewCommunity} ${label}`
              : `View ${label} community`;
          return (
            <article className={styles.groupCard} key={kind}>
              <span className={styles.groupIcon}>
                <Icon aria-hidden size={24} weight="duotone" />
              </span>
              <small>{kind}</small>
              <h3>{label}</h3>
              <div style={{ marginBottom: 16 }} />
              <PendingLink aria-label={linkLabel} href={href}>
                {linkLabel} <ArrowRightIcon aria-hidden size={17} />
              </PendingLink>
            </article>
          );
        })}
      </div>
    </main>
  );
}
