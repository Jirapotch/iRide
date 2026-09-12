import { expect, it } from "vitest";
import { routeMediaStorage, type ObjectStorage } from "./index";

function memoryStorage(label: string) {
  const objects = new Map<string, Buffer>([["original", Buffer.from(label)]]);
  const storage: ObjectStorage = {
    get: async (key) => {
      const value = objects.get(key);
      if (!value) throw new Error("missing");
      return value;
    },
    head: async (key) => ({
      bytes: (await storage.get(key)).length,
      contentType: "image/png",
    }),
    put: async (key, body) => {
      objects.set(key, Buffer.from(body));
    },
    remove: async (key) => {
      objects.delete(key);
    },
    signDownload: async (key, expiry) => `${label}/${key}?expiry=${expiry}`,
  };
  return { objects, storage };
}

it("routes mixed-provider reads, writes and deletes without crossing stores", async () => {
  const legacy = memoryStorage("legacy-r2"),
    current = memoryStorage("new-supabase");
  const storage = routeMediaStorage({
    r2: legacy.storage,
    supabase: {
      ...current.storage,
      signUpload: async (key) => ({
        bucketId: "media",
        objectPath: key,
        uploadToken: "upload",
        expiresAt: "2033-05-18T03:33:20.000Z",
      }),
    },
  });
  expect((await storage.get("original")).toString()).toBe("legacy-r2");
  expect((await storage.get("original", "supabase")).toString()).toBe(
    "new-supabase",
  );
  expect(await storage.head("original", "supabase")).toEqual({
    bytes: 12,
    contentType: "image/png",
  });
  expect(
    await storage.signUpload("new-original", "image/png", 10),
  ).toMatchObject({ bucketId: "media", objectPath: "new-original" });
  expect(await storage.signDownload("original", 120)).toBe(
    "legacy-r2/original?expiry=120",
  );
  expect(await storage.signDownload("original", 120, "supabase")).toBe(
    "new-supabase/original?expiry=120",
  );
  await storage.put("variant", Buffer.from("webp"), "image/webp", "supabase");
  expect(current.objects.get("variant")?.toString()).toBe("webp");
  expect(legacy.objects.has("variant")).toBe(false);
  await storage.remove("original");
  expect(legacy.objects.has("original")).toBe(false);
  expect(current.objects.has("original")).toBe(true);
  await storage.remove("original", "supabase");
  expect(current.objects.has("original")).toBe(false);
});
