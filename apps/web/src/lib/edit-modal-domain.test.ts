import { describe, expect, it } from "vitest";

import { editModalUrl, legacyEditRedirect } from "./edit-modal-domain";

describe("edit modal routes",()=>{
  it("routes every content type back to its owning screen",()=>{
    expect(editModalUrl("post","p1", undefined, "car")).toBe("/community/car/talk?post=p1&modal=edit");
    expect(editModalUrl("event","e1")).toBe("/maps?marker=e1&modal=edit");
    expect(editModalUrl("market","m1")).toBe("/community/motorcycle/market");
    expect(editModalUrl("vehicle","v1","road_rider")).toBe("/users/road_rider?tab=garage&vehicle=v1&modal=edit");
  });
  it("maps legacy create edit URLs to modal URLs",()=>{
    expect(legacyEditRedirect("photographer-spot","s1")).toBe("/maps?marker=s1&modal=edit");
    expect(legacyEditRedirect("trip","t1")).toBe("/maps?marker=t1&modal=edit");
  });
});
