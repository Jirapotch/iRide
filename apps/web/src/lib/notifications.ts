export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly time: string;
}

export const notifications: readonly NotificationItem[] = [];
