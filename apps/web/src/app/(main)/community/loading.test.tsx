import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CommunityLoading from "./loading";

describe("CommunityLoading", () => {
  it("matches the feed hierarchy with three stable cards", () => {
    const markup = renderToStaticMarkup(<CommunityLoading />);

    expect(markup).toContain('data-ui="community-feed-skeleton"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup.match(/class="skeleton-card"/g)).toHaveLength(3);
  });
});
