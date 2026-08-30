import type { MarkerTagInput } from "@iride/types";

export interface MarkerMentionQuery {
  readonly start: number;
  readonly end: number;
  readonly query: string;
}

export function findMarkerMentionQuery(
  body: string,
  cursor: number,
): MarkerMentionQuery | null {
  const boundedCursor = Math.max(0, Math.min(cursor, body.length));
  const start = body.lastIndexOf("@", boundedCursor - 1);
  if (start < 0 || (start > 0 && !/\s/.test(body[start - 1] ?? "")))
    return null;
  const query = body.slice(start + 1, boundedCursor);
  if (query.includes("\n") || query.length > 80) return null;
  return { start, end: boundedCursor, query };
}

export function applyMarkerMention(
  body: string,
  mention: MarkerMentionQuery,
  title: string,
) {
  const inserted = `@${title}`;
  return {
    body: `${body.slice(0, mention.start)}${inserted}${body.slice(mention.end)}`,
    cursor: mention.start + inserted.length,
  };
}

export function toggleMarkerTag(
  items: readonly MarkerTagInput[],
  target: MarkerTagInput,
): MarkerTagInput[] {
  const exists = items.some(
    (item) => item.kind === target.kind && item.id === target.id,
  );
  if (exists)
    return items.filter(
      (item) => item.kind !== target.kind || item.id !== target.id,
    );
  if (items.length >= 5) return [...items];
  return [...items, target];
}
