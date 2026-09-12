"use client";

import { Skeleton } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useReducer,
  useRef,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";

import type { Locale } from "@/lib/locale";

import styles from "./profile-tab-controller.module.css";

export type ProfileTab = "overview" | "garage" | "activities";

export interface ProfileTabState {
  readonly pendingTab: ProfileTab | null;
  readonly selectedTab: ProfileTab;
  readonly serverTab: ProfileTab;
}

type ProfileTabAction =
  | { readonly tab: ProfileTab; readonly type: "select" }
  | { readonly tab: ProfileTab; readonly type: "server-committed" }
  | { readonly type: "transition-settled" };

interface ProfileTabClickDescriptor {
  readonly altKey: boolean;
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly hasDownload: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly target: string | undefined;
}

interface ProfileTabViewProps {
  readonly locale: Locale;
  readonly onSelect: (
    event: MouseEvent<HTMLAnchorElement>,
    tab: ProfileTab,
    href: string,
  ) => void;
  readonly overviewContent: ReactNode;
  readonly state: ProfileTabState;
  readonly tabContent: ReactNode;
  readonly username: string;
}

interface ProfileTabControllerProps extends Omit<
  ProfileTabViewProps,
  "onSelect" | "state"
> {
  readonly initialTab: string | undefined;
}

const PROFILE_TABS: readonly ProfileTab[] = [
  "overview",
  "garage",
  "activities",
];

export function normalizeProfileTab(tab?: string): ProfileTab {
  return tab === "garage" || tab === "activities" ? tab : "overview";
}

export function createProfileTabState(tab?: string): ProfileTabState {
  const selectedTab = normalizeProfileTab(tab);
  return { pendingTab: null, selectedTab, serverTab: selectedTab };
}

export function profileTabReducer(
  state: ProfileTabState,
  action: ProfileTabAction,
): ProfileTabState {
  if (action.type === "select") {
    return {
      ...state,
      pendingTab: action.tab,
      selectedTab: action.tab,
    };
  }

  if (action.type === "server-committed") {
    if (state.pendingTab !== null && action.tab !== state.pendingTab) {
      return { ...state, serverTab: action.tab };
    }

    return {
      pendingTab: null,
      selectedTab: action.tab,
      serverTab: action.tab,
    };
  }

  if (state.pendingTab === null) return state;
  return {
    pendingTab: null,
    selectedTab: state.serverTab,
    serverTab: state.serverTab,
  };
}

export function shouldHandleProfileTabClick({
  altKey,
  button,
  ctrlKey,
  hasDownload,
  metaKey,
  shiftKey,
  target,
}: ProfileTabClickDescriptor) {
  return (
    button === 0 &&
    !altKey &&
    !ctrlKey &&
    !metaKey &&
    !shiftKey &&
    target !== "_blank" &&
    !hasDownload
  );
}

function profileTabHref(username: string, tab: ProfileTab) {
  const profileHref = `/users/${encodeURIComponent(username)}`;
  return tab === "overview" ? profileHref : `${profileHref}?tab=${tab}`;
}

function ProfileTabSkeleton({
  locale,
  tab,
}: {
  readonly locale: Locale;
  readonly tab: ProfileTab;
}) {
  const label =
    locale === "th"
      ? {
          activities: "กำลังโหลดกิจกรรม",
          garage: "กำลังโหลด Garage",
          overview: "กำลังโหลดภาพรวม",
        }[tab]
      : {
          activities: "Loading activities",
          garage: "Loading garage",
          overview: "Loading overview",
        }[tab];
  const skeletonCount = tab === "activities" ? 2 : 1;

  return (
    <div
      aria-label={label}
      className={`${styles.pendingPanel} ${tab === "activities" ? styles.activitiesSkeleton : ""}`}
      data-skeleton-tab={tab}
      data-ui="profile-tab-skeleton"
      role="status"
    >
      {Array.from({ length: skeletonCount }, (_, index) => (
        <Skeleton
          active
          className={styles.skeleton!}
          key={index}
          paragraph={{ rows: tab === "garage" ? 4 : 2 }}
        />
      ))}
    </div>
  );
}

export function ProfileTabView({
  locale,
  onSelect,
  overviewContent,
  state,
  tabContent,
  username,
}: ProfileTabViewProps) {
  const labels =
    locale === "th"
      ? { activities: "กิจกรรม", garage: "Garage", overview: "ภาพรวม" }
      : { activities: "Activities", garage: "Garage", overview: "Overview" };
  const pending = state.pendingTab !== null;

  return (
    <>
      <nav
        aria-label={locale === "th" ? "ส่วนของโปรไฟล์" : "Profile sections"}
        className={styles.tabs}
      >
        {PROFILE_TABS.map((tab) => {
          const href = profileTabHref(username, tab);
          return (
            <Link
              aria-current={state.selectedTab === tab ? "page" : undefined}
              className={styles.tab}
              data-profile-tab={tab}
              href={href}
              key={tab}
              onClick={(event) => onSelect(event, tab, href)}
            >
              {labels[tab]}
            </Link>
          );
        })}
      </nav>
      <div
        aria-busy={pending || undefined}
        className={styles.panel}
        data-navigation-focus-target="profile-panel"
        tabIndex={-1}
      >
        {pending ? (
          <ProfileTabSkeleton locale={locale} tab={state.selectedTab} />
        ) : state.selectedTab === "overview" ? (
          overviewContent
        ) : (
          tabContent
        )}
      </div>
    </>
  );
}

export function ProfileTabController({
  initialTab,
  locale,
  overviewContent,
  tabContent,
  username,
}: ProfileTabControllerProps) {
  const router = useRouter();
  const serverTab = normalizeProfileTab(initialTab);
  const [state, dispatch] = useReducer(
    profileTabReducer,
    serverTab,
    createProfileTabState,
  );
  const [isTransitionPending, startTransition] = useTransition();
  const transitionWasPending = useRef(false);
  const renderedState =
    state.serverTab === serverTab
      ? state
      : profileTabReducer(state, { tab: serverTab, type: "server-committed" });

  useEffect(() => {
    if (state.serverTab !== serverTab) {
      dispatch({ tab: serverTab, type: "server-committed" });
    }
  }, [serverTab, state.serverTab]);

  useEffect(() => {
    if (transitionWasPending.current && !isTransitionPending) {
      dispatch({ type: "transition-settled" });
    }
    transitionWasPending.current = isTransitionPending;
  }, [isTransitionPending]);

  function selectTab(
    event: MouseEvent<HTMLAnchorElement>,
    tab: ProfileTab,
    href: string,
  ) {
    if (
      !shouldHandleProfileTabClick({
        altKey: event.altKey,
        button: event.button,
        ctrlKey: event.ctrlKey,
        hasDownload: event.currentTarget.hasAttribute("download"),
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        target: event.currentTarget.target || undefined,
      })
    ) {
      return;
    }

    event.preventDefault();
    if (
      renderedState.selectedTab === tab &&
      renderedState.pendingTab === null
    ) {
      return;
    }

    dispatch({ tab, type: "select" });
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <ProfileTabView
      locale={locale}
      onSelect={selectTab}
      overviewContent={overviewContent}
      state={renderedState}
      tabContent={tabContent}
      username={username}
    />
  );
}
