import sharp from "sharp";

export const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_STORED_IMAGE_BYTES = 3_000_000;
export const STORED_IMAGE_CONTENT_TYPE = "image/webp";
export const STORED_IMAGE_EXTENSION = "webp";

const allowedImages = new Set(["image/jpeg", "image/png", "image/webp"]);
const qualitySteps = [82, 72, 62, 52, 42];
const dimensionScales = [1, 0.85, 0.7, 0.55];

export type ProcessedImage = {
  data: Buffer;
  contentType: typeof STORED_IMAGE_CONTENT_TYPE;
  extension: typeof STORED_IMAGE_EXTENSION;
};

export async function processUploadedImage(file: File): Promise<ProcessedImage> {
  if (!allowedImages.has(file.type)) {
    throw new Error("Only JPEG, PNG, or WebP images are supported.");
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("The source image must be smaller than 8 MB.");
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Missing image dimensions");

    const swapsDimensions = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
    const orientedWidth = swapsDimensions ? metadata.height : metadata.width;
    const orientedHeight = swapsDimensions ? metadata.width : metadata.height;
    const landscape = orientedWidth >= orientedHeight;
    const maxWidth = landscape ? 1920 : 1080;
    const maxHeight = landscape ? 1080 : 1920;

    for (const scale of dimensionScales) {
      const width = Math.max(1, Math.floor(maxWidth * scale));
      const height = Math.max(1, Math.floor(maxHeight * scale));
      for (const quality of qualitySteps) {
        const output = await sharp(input)
          .rotate()
          .resize({ width, height, fit: "inside", withoutEnlargement: true })
          .webp({ quality, effort: 4 })
          .toBuffer();
        if (output.byteLength < MAX_STORED_IMAGE_BYTES) {
          return { data: output, contentType: STORED_IMAGE_CONTENT_TYPE, extension: STORED_IMAGE_EXTENSION };
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && (
      error.message === "Only JPEG, PNG, or WebP images are supported."
      || error.message === "The source image must be smaller than 8 MB."
    )) throw error;
    throw new Error("The selected image could not be processed. Please choose another JPEG, PNG, or WebP image.");
  }

  throw new Error("The image could not be compressed below 3 MB. Please choose another image.");
}
