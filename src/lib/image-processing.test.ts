import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  MAX_SOURCE_IMAGE_BYTES,
  MAX_STORED_IMAGE_BYTES,
  processUploadedImage,
} from "@/lib/image-processing";

function imageFile(data: Buffer, type: string): File {
  const bytes = Uint8Array.from(data);
  return {
    type,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  } as File;
}

describe("processUploadedImage", () => {
  it("fits landscape images inside 1920x1080 and stores WebP below 3 MB", async () => {
    const source = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#336699" } }).png().toBuffer();
    const result = await processUploadedImage(imageFile(source, "image/png"));
    const metadata = await sharp(result.data).metadata();

    expect(metadata.width).toBeLessThanOrEqual(1920);
    expect(metadata.height).toBeLessThanOrEqual(1080);
    expect(metadata.format).toBe("webp");
    expect(result.contentType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect(result.data.byteLength).toBeLessThan(MAX_STORED_IMAGE_BYTES);
  });

  it("fits portrait images inside 1080x1920", async () => {
    const source = await sharp({ create: { width: 2000, height: 3000, channels: 3, background: "#663399" } }).jpeg().toBuffer();
    const result = await processUploadedImage(imageFile(source, "image/jpeg"));
    const metadata = await sharp(result.data).metadata();

    expect(metadata.width).toBeLessThanOrEqual(1080);
    expect(metadata.height).toBeLessThanOrEqual(1920);
  });

  it("does not enlarge small images", async () => {
    const source = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#112233" } }).webp().toBuffer();
    const result = await processUploadedImage(imageFile(source, "image/webp"));
    const metadata = await sharp(result.data).metadata();

    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(480);
  });

  it("applies EXIF orientation before choosing the resize bounds", async () => {
    const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#224466" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await processUploadedImage(imageFile(source, "image/jpeg"));
    const metadata = await sharp(result.data).metadata();

    expect(metadata.width).toBe(800);
    expect(metadata.height).toBe(1200);
    expect(metadata.orientation).toBeUndefined();
  });

  it("preserves transparency when converting PNG to WebP", async () => {
    const source = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const result = await processUploadedImage(imageFile(source, "image/png"));
    const metadata = await sharp(result.data).metadata();

    expect(metadata.hasAlpha).toBe(true);
  });

  it("rejects unsupported, oversized, and corrupt files with actionable messages", async () => {
    await expect(processUploadedImage(imageFile(Buffer.from("hello"), "image/gif"))).rejects.toThrow("Only JPEG, PNG, or WebP");
    await expect(processUploadedImage(imageFile(Buffer.alloc(MAX_SOURCE_IMAGE_BYTES + 1), "image/jpeg"))).rejects.toThrow("smaller than 8 MB");
    await expect(processUploadedImage(imageFile(Buffer.from("not an image"), "image/jpeg"))).rejects.toThrow("could not be processed");
  });
});
