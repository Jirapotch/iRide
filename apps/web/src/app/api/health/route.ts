import { createHealthResponse } from "@iride/types";

export function GET() {
  return Response.json(
    createHealthResponse("web", process.env.APP_VERSION ?? "0.1.0"),
  );
}
