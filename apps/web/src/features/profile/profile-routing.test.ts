import { expect, test } from "vitest";
import { ownProfileRedirect, profileTabHref } from "./profile-routing";

test("own username routes preserve all deep-link search values", () => {
  expect(
    ownProfileRedirect("rider", "rider", {
      tab: "garage",
      vehicle: "v1",
      modal: "report",
      section: "documents",
      extra: ["a", "b"],
    }),
  ).toBe(
    "/profile?tab=garage&vehicle=v1&modal=report&section=documents&extra=a&extra=b",
  );
  expect(ownProfileRedirect("another", "rider", { tab: "garage" })).toBeNull();
  expect(ownProfileRedirect("rider", null, {})).toBeNull();
});

test("owner tabs use profile and public tabs retain the identity route", () => {
  expect(profileTabHref("rider", "garage", true)).toBe("/profile?tab=garage");
  expect(profileTabHref("rider", "overview", true)).toBe("/profile");
  expect(profileTabHref("other rider", "activities", false)).toBe(
    "/users/other%20rider?tab=activities",
  );
});
