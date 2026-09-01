export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly time: string;
}

export const notifications: readonly NotificationItem[] = [
  { id: "comment-1", title: "Maya commented on your post", detail: "The light was perfect at that corner.", time: "2m" },
  { id: "event-1", title: "Urban Motion Weekend has new attendees", detail: "Six people you follow are going.", time: "1h" },
  { id: "trip-1", title: "Bangkok to Khao Yai starts soon", detail: "Departure briefing is available.", time: "3h" },
];
