import { createRepository } from "@/server/repository";
import { GoogleDriveStorage } from "@/server/google-drive";
import { PhotoService } from "@/server/photo-service";
import { handleGarage } from "@/server/garage-handler";
import { GarageError } from "@/features/garage/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const storage = new GoogleDriveStorage();
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const repo = createRepository();
    await repo.assertReady();
    return await handleGarage(
      request,
      path,
      repo,
      new PhotoService(repo, storage),
    );
  } catch (error) {
    return Response.json(
      {
        error: {
          code:
            error instanceof GarageError ? error.code : "SERVICE_UNAVAILABLE",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
